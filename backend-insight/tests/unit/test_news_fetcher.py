"""
services/news_fetcher.py のユニットテスト。

httpxをモック化し、ネットワーク通信なしで全分岐を検証する。

テストケース対応:
  NF-01: APIキー未設定           → ValueError
  NF-02: HTTP 200 / 複数記事     → Articleリスト返却
  NF-03: HTTP 200 / 0件          → 空リスト返却
  NF-04: 記事本文2000文字超      → 500文字でトリム
  NF-05: HTTP 401                 → NewsAPIAuthError
  NF-06: HTTP 429                 → NewsAPIRateLimitError
  NF-07: HTTP 5xx                 → NewsAPIError
  NF-08: Connection timeout       → NewsAPIError
  NF-09: レスポンスJSON構造異常  → NewsAPIError
  NF-10: HTTP 400（その他4xx）   → NewsAPIError
"""

import pytest
from unittest.mock import MagicMock, patch

import httpx

from services.news_fetcher import (
    MAX_DESCRIPTION_LENGTH,
    NewsAPIAuthError,
    NewsAPIError,
    NewsAPIRateLimitError,
    NewsFetcher,
)


def _make_response(status_code: int, json_data: dict | None = None) -> MagicMock:
    """httpx.Responseのモックを生成するヘルパー。"""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = status_code
    if json_data is not None:
        mock_response.json.return_value = json_data
    return mock_response


def _make_articles_payload(articles: list) -> dict:
    return {"status": "ok", "totalResults": len(articles), "articles": articles}


_SAMPLE_ARTICLE_PAYLOAD = {
    "title": "Test Title",
    "description": "Test description",
    "url": "http://example.com",
    "publishedAt": "2026-05-17T00:00:00Z",
}


class TestNewsFetcherInit:
    # ── NF-01 ──────────────────────────────────────────────────────────────
    def test_nf01_empty_api_key_raises_value_error(self):
        """APIキーが空文字の場合はValueErrorを送出すること。"""
        with pytest.raises(ValueError, match="API key"):
            NewsFetcher(api_key="")


class TestNewsFetcherFetch:
    @pytest.fixture
    def fetcher(self):
        return NewsFetcher(api_key="test-api-key")

    # ── NF-02 ──────────────────────────────────────────────────────────────
    def test_nf02_success_returns_article_list(self, fetcher):
        """HTTP 200で複数記事が返る場合、Articleリストを返すこと。"""
        payload = _make_articles_payload([_SAMPLE_ARTICLE_PAYLOAD, _SAMPLE_ARTICLE_PAYLOAD])
        mock_response = _make_response(200, payload)

        with patch("services.news_fetcher.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_response
            articles = fetcher.fetch("Toyota Motor Corp")

        assert len(articles) == 2
        assert articles[0].title == "Test Title"
        assert articles[0].description == "Test description"
        assert articles[0].url == "http://example.com"
        assert articles[0].published_at == "2026-05-17T00:00:00Z"

    # ── NF-03 ──────────────────────────────────────────────────────────────
    def test_nf03_zero_articles_returns_empty_list(self, fetcher):
        """記事0件のレスポンスに対して空リストを返すこと。"""
        payload = _make_articles_payload([])
        mock_response = _make_response(200, payload)

        with patch("services.news_fetcher.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_response
            articles = fetcher.fetch("NonexistentCompany")

        assert articles == []

    # ── NF-04 ──────────────────────────────────────────────────────────────
    def test_nf04_long_description_is_truncated(self, fetcher):
        """2000文字の本文が500文字（MAX_DESCRIPTION_LENGTH）にトリムされること。"""
        long_description = "a" * 2000
        article_payload = {**_SAMPLE_ARTICLE_PAYLOAD, "description": long_description}
        payload = _make_articles_payload([article_payload])
        mock_response = _make_response(200, payload)

        with patch("services.news_fetcher.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_response
            articles = fetcher.fetch("Toyota Motor Corp")

        assert len(articles[0].description) == MAX_DESCRIPTION_LENGTH

    # ── NF-05 ──────────────────────────────────────────────────────────────
    def test_nf05_http_401_raises_auth_error(self, fetcher):
        """HTTP 401レスポンスに対してNewsAPIAuthErrorを送出すること。"""
        mock_response = _make_response(401)

        with patch("services.news_fetcher.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_response
            with pytest.raises(NewsAPIAuthError):
                fetcher.fetch("Toyota Motor Corp")

    # ── NF-06 ──────────────────────────────────────────────────────────────
    def test_nf06_http_429_raises_rate_limit_error(self, fetcher):
        """HTTP 429レスポンスに対してNewsAPIRateLimitErrorを送出すること。"""
        mock_response = _make_response(429)

        with patch("services.news_fetcher.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_response
            with pytest.raises(NewsAPIRateLimitError):
                fetcher.fetch("Toyota Motor Corp")

    # ── NF-07 ──────────────────────────────────────────────────────────────
    def test_nf07_http_500_raises_news_api_error(self, fetcher):
        """HTTP 5xxレスポンスに対してNewsAPIErrorを送出すること。"""
        mock_response = _make_response(500)

        with patch("services.news_fetcher.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_response
            with pytest.raises(NewsAPIError):
                fetcher.fetch("Toyota Motor Corp")

    # ── NF-08 ──────────────────────────────────────────────────────────────
    def test_nf08_connection_timeout_raises_news_api_error(self, fetcher):
        """接続タイムアウト時にNewsAPIErrorを送出すること。"""
        with patch("services.news_fetcher.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.side_effect = (
                httpx.TimeoutException("timeout")
            )
            with pytest.raises(NewsAPIError):
                fetcher.fetch("Toyota Motor Corp")

    # ── NF-09 ──────────────────────────────────────────────────────────────
    def test_nf09_missing_articles_key_raises_news_api_error(self, fetcher):
        """レスポンスJSONに'articles'キーが存在しない場合NewsAPIErrorを送出すること。"""
        mock_response = _make_response(200, {"status": "ok"})

        with patch("services.news_fetcher.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_response
            with pytest.raises(NewsAPIError):
                fetcher.fetch("Toyota Motor Corp")

    # ── NF-10 ──────────────────────────────────────────────────────────────
    def test_nf10_http_400_raises_news_api_error(self, fetcher):
        """HTTP 400（401/429以外の4xx）に対してNewsAPIErrorを送出すること。"""
        mock_response = _make_response(400)

        with patch("services.news_fetcher.httpx.Client") as MockClient:
            MockClient.return_value.__enter__.return_value.get.return_value = mock_response
            with pytest.raises(NewsAPIError):
                fetcher.fetch("Toyota Motor Corp")
