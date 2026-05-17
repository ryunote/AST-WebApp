"""
/insight/market/{symbol} エンドポイントのユニットテスト。

全外部依存（cache / symbol_resolver / NewsFetcher / LLMClient）をモック化し、
ルーターのオーケストレーションロジックのみを検証する。

テストケース対応:
  EP-01: シンボル不正形式     → 422
  EP-02: キャッシュHIT        → 200 / 外部呼び出しゼロ
  EP-03: Redis read失敗       → 200 / Graceful Degradation
  EP-04: NewsAPI障害          → 503
  EP-05: ニュース0件          → 200 / news_count=0
  EP-06: Gemini APIエラー     → 503
  EP-07: Gemini 不正JSON      → 503
  EP-08: 正常フロー全成功     → 200 / cached=false
  EP-09: Redis write失敗      → 200 / Graceful Degradation
  EP-10: SymbolNotFoundError  → 404
  EP-11: SymbolResolverError  → 503
"""

import pytest
from unittest.mock import MagicMock, patch

from schemas.market import Article, InsightResponse
from services.llm_client import LLMError, LLMParseError
from services.news_fetcher import NewsAPIError
from services.symbol_resolver import SymbolNotFoundError, SymbolResolverError

_SYMBOL = "7203.T"
_COMPANY_NAME = "Toyota Motor Corp"

_SAMPLE_ARTICLES = [
    Article(
        title="Toyota beats Q1 forecast",
        description="Strong EV sales drove revenue.",
        url="http://example.com/1",
        published_at="2026-05-17T00:00:00Z",
    )
]

_SAMPLE_INSIGHT = InsightResponse(
    symbol=_SYMBOL,
    sentiment="positive",
    summary="トヨタが好調な決算を発表",
    key_events=["Q1増収増益"],
    risk_factors=["EV競争激化"],
    news_count=1,
    cached=False,
)


class TestMarketEndpoint:
    # ── EP-01 ──────────────────────────────────────────────────────────────
    def test_ep01_invalid_symbol_format_returns_422(self, client):
        """小文字を含むシンボルはパスバリデーションで422を返すこと。"""
        response = client.get("/insight/market/aapl")
        assert response.status_code == 422

    # ── EP-02 ──────────────────────────────────────────────────────────────
    def test_ep02_cache_hit_returns_200_without_external_calls(self, client):
        """キャッシュHIT時は外部サービスを一切呼ばず200を返すこと。"""
        with patch("routers.market.cache.get_insight", return_value=_SAMPLE_INSIGHT), \
             patch("routers.market.resolve_company_name") as mock_resolver, \
             patch("routers.market.NewsFetcher") as mock_fetcher_cls, \
             patch("routers.market.LLMClient") as mock_llm_cls:

            response = client.get(f"/insight/market/{_SYMBOL}")

        assert response.status_code == 200
        mock_resolver.assert_not_called()
        mock_fetcher_cls.assert_not_called()
        mock_llm_cls.assert_not_called()
        assert response.json()["cached"] is True

    # ── EP-03 ──────────────────────────────────────────────────────────────
    def test_ep03_redis_read_failure_continues_gracefully(self, client):
        """Redisのread失敗時はキャッシュなしで処理を続行し200を返すこと。"""
        mock_fetcher = MagicMock()
        mock_fetcher.fetch.return_value = _SAMPLE_ARTICLES
        mock_llm = MagicMock()
        mock_llm.analyze.return_value = _SAMPLE_INSIGHT

        with patch("routers.market.cache.get_insight", return_value=None), \
             patch("routers.market.cache.set_insight"), \
             patch("routers.market.resolve_company_name", return_value=_COMPANY_NAME), \
             patch("routers.market.NewsFetcher", return_value=mock_fetcher), \
             patch("routers.market.LLMClient", return_value=mock_llm):

            response = client.get(f"/insight/market/{_SYMBOL}")

        assert response.status_code == 200

    # ── EP-04 ──────────────────────────────────────────────────────────────
    def test_ep04_news_api_error_returns_503(self, client):
        """NewsAPI障害時は503を返すこと。"""
        mock_fetcher = MagicMock()
        mock_fetcher.fetch.side_effect = NewsAPIError("connection failed")

        with patch("routers.market.cache.get_insight", return_value=None), \
             patch("routers.market.resolve_company_name", return_value=_COMPANY_NAME), \
             patch("routers.market.NewsFetcher", return_value=mock_fetcher):

            response = client.get(f"/insight/market/{_SYMBOL}")

        assert response.status_code == 503

    # ── EP-05 ──────────────────────────────────────────────────────────────
    def test_ep05_zero_news_returns_200_with_no_data_fields(self, client):
        """ニュース0件時は200を返し、news_count=0・sentiment=neutralであること。"""
        no_news_insight = InsightResponse(
            symbol=_SYMBOL,
            sentiment="neutral",
            summary="該当するニュースが見つかりませんでした",
            key_events=[],
            risk_factors=[],
            news_count=0,
            cached=False,
        )
        mock_fetcher = MagicMock()
        mock_fetcher.fetch.return_value = []
        mock_llm = MagicMock()
        mock_llm.analyze.return_value = no_news_insight

        with patch("routers.market.cache.get_insight", return_value=None), \
             patch("routers.market.cache.set_insight"), \
             patch("routers.market.resolve_company_name", return_value=_COMPANY_NAME), \
             patch("routers.market.NewsFetcher", return_value=mock_fetcher), \
             patch("routers.market.LLMClient", return_value=mock_llm):

            response = client.get(f"/insight/market/{_SYMBOL}")

        assert response.status_code == 200
        body = response.json()
        assert body["news_count"] == 0
        assert body["sentiment"] == "neutral"
        assert body["key_events"] == []
        assert body["risk_factors"] == []

    # ── EP-06 ──────────────────────────────────────────────────────────────
    def test_ep06_gemini_api_error_returns_503(self, client):
        """Gemini APIエラー時は503を返すこと。"""
        mock_fetcher = MagicMock()
        mock_fetcher.fetch.return_value = _SAMPLE_ARTICLES
        mock_llm = MagicMock()
        mock_llm.analyze.side_effect = LLMError("gemini unavailable")

        with patch("routers.market.cache.get_insight", return_value=None), \
             patch("routers.market.resolve_company_name", return_value=_COMPANY_NAME), \
             patch("routers.market.NewsFetcher", return_value=mock_fetcher), \
             patch("routers.market.LLMClient", return_value=mock_llm):

            response = client.get(f"/insight/market/{_SYMBOL}")

        assert response.status_code == 503

    # ── EP-07 ──────────────────────────────────────────────────────────────
    def test_ep07_gemini_invalid_json_returns_503(self, client):
        """GeminiがJSONパース不能なレスポンスを返した場合は503を返すこと。"""
        mock_fetcher = MagicMock()
        mock_fetcher.fetch.return_value = _SAMPLE_ARTICLES
        mock_llm = MagicMock()
        mock_llm.analyze.side_effect = LLMParseError("malformed JSON")

        with patch("routers.market.cache.get_insight", return_value=None), \
             patch("routers.market.resolve_company_name", return_value=_COMPANY_NAME), \
             patch("routers.market.NewsFetcher", return_value=mock_fetcher), \
             patch("routers.market.LLMClient", return_value=mock_llm):

            response = client.get(f"/insight/market/{_SYMBOL}")

        assert response.status_code == 503

    # ── EP-08 ──────────────────────────────────────────────────────────────
    def test_ep08_full_success_returns_200_with_all_fields(self, client):
        """全サービス正常時は200を返し、4フィールドすべて存在しcached=falseであること。"""
        mock_fetcher = MagicMock()
        mock_fetcher.fetch.return_value = _SAMPLE_ARTICLES
        mock_llm = MagicMock()
        mock_llm.analyze.return_value = _SAMPLE_INSIGHT

        with patch("routers.market.cache.get_insight", return_value=None), \
             patch("routers.market.cache.set_insight") as mock_set, \
             patch("routers.market.resolve_company_name", return_value=_COMPANY_NAME), \
             patch("routers.market.NewsFetcher", return_value=mock_fetcher), \
             patch("routers.market.LLMClient", return_value=mock_llm):

            response = client.get(f"/insight/market/{_SYMBOL}")

        assert response.status_code == 200
        body = response.json()
        assert body["cached"] is False
        assert "sentiment" in body
        assert "summary" in body
        assert "key_events" in body
        assert "risk_factors" in body
        mock_set.assert_called_once()

    # ── EP-09 ──────────────────────────────────────────────────────────────
    def test_ep09_redis_write_failure_still_returns_200(self, client):
        """Redisのwrite失敗時もレスポンスは正常に返すこと（Graceful Degradation）。"""
        mock_fetcher = MagicMock()
        mock_fetcher.fetch.return_value = _SAMPLE_ARTICLES
        mock_llm = MagicMock()
        mock_llm.analyze.return_value = _SAMPLE_INSIGHT

        with patch("routers.market.cache.get_insight", return_value=None), \
             patch("routers.market.cache.set_insight", side_effect=Exception("redis down")), \
             patch("routers.market.resolve_company_name", return_value=_COMPANY_NAME), \
             patch("routers.market.NewsFetcher", return_value=mock_fetcher), \
             patch("routers.market.LLMClient", return_value=mock_llm):

            response = client.get(f"/insight/market/{_SYMBOL}")

        assert response.status_code == 200

    # ── EP-10 ──────────────────────────────────────────────────────────────
    def test_ep10_symbol_not_found_returns_404(self, client):
        """yfinanceが社名を解決できないシンボルは404を返すこと。"""
        with patch("routers.market.cache.get_insight", return_value=None), \
             patch("routers.market.resolve_company_name",
                   side_effect=SymbolNotFoundError("UNKNOWN")):

            response = client.get("/insight/market/UNKNOWN")

        assert response.status_code == 404

    # ── EP-11 ──────────────────────────────────────────────────────────────
    def test_ep11_symbol_resolver_network_error_returns_503(self, client):
        """yfinanceのネットワーク障害時は503を返すこと。"""
        with patch("routers.market.cache.get_insight", return_value=None), \
             patch("routers.market.resolve_company_name",
                   side_effect=SymbolResolverError("network error")):

            response = client.get(f"/insight/market/{_SYMBOL}")

        assert response.status_code == 503
