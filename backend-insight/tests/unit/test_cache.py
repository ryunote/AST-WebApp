"""
services/cache.py のユニットテスト。

redisモジュールをモック化し、ネットワーク通信なしで全分岐を検証する。

設計上の重要な保証:
  1. Graceful Degradation: Redis障害時に例外を上位に伝播させず、
     get → None / set → 無視 で続行すること
  2. キャッシュキー形式: "insight:market:{symbol}"
  3. TTL: 10800秒（3時間）= CACHE_TTL定数
  4. cachedフィールドはキャッシュに保存しない（レスポンス時に動的付与）

テストケース対応:
  CA-01: get_insight HIT                              → InsightResponse返却
  CA-02: get_insight MISS                             → None
  CA-03: get_insight Redis停止（client=None）         → None（Graceful Degradation）
  CA-04: get_insight GET例外                          → None（Graceful Degradation）
  CA-05: get_insight HIT / JSON精度                   → 全4フィールド正確に復元
  CA-06: get_insight HIT / JSON破損                   → None（Graceful Degradation）
  CA-07: set_insight 正常 / キー形式検証              → "insight:market:{symbol}"
  CA-08: set_insight 正常 / TTL検証                   → CACHE_TTL (10800)
  CA-09: set_insight 正常 / JSON精度                  → 全4フィールド正確に保存
  CA-10: set_insight Redis停止（client=None）         → 例外を握り潰す
  CA-11: set_insight SET例外                          → 例外を握り潰す
  CA-12: _get_client 接続成功                         → クライアント返却
  CA-13: _get_client from_url例外                     → None
  CA-14: _get_client ping例外                         → None
"""

import json
import pytest
from unittest.mock import MagicMock, call, patch

from schemas.market import InsightResponse
from services.cache import (
    CACHE_TTL,
    _get_client,
    get_insight,
    set_insight,
)

_SYMBOL = "7203.T"

_SAMPLE_INSIGHT = InsightResponse(
    symbol=_SYMBOL,
    sentiment="positive",
    summary="トヨタが好調な決算を発表",
    key_events=["Q1増収増益"],
    risk_factors=["EV競争激化"],
    news_count=1,
    cached=False,
)

# cachedフィールドを除いたキャッシュ保存用データ
_STORED_DATA = _SAMPLE_INSIGHT.model_dump(exclude={"cached"})


# ─── _get_client ─────────────────────────────────────────────────────────────

class TestGetClient:
    # ── CA-12 ──────────────────────────────────────────────────────────────
    def test_ca12_returns_client_on_successful_connection(self):
        """ping成功時はRedisクライアントを返すこと。"""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        with patch("services.cache.redis.from_url", return_value=mock_client):
            result = _get_client()
        assert result is mock_client

    # ── CA-13 ──────────────────────────────────────────────────────────────
    def test_ca13_returns_none_when_from_url_raises(self):
        """redis.from_url()が例外を投げた場合はNoneを返すこと。"""
        with patch("services.cache.redis.from_url", side_effect=Exception("conn refused")):
            result = _get_client()
        assert result is None

    # ── CA-14 ──────────────────────────────────────────────────────────────
    def test_ca14_returns_none_when_ping_fails(self):
        """ping()失敗時はNoneを返すこと。"""
        mock_client = MagicMock()
        mock_client.ping.side_effect = Exception("ping timeout")
        with patch("services.cache.redis.from_url", return_value=mock_client):
            result = _get_client()
        assert result is None


# ─── get_insight ─────────────────────────────────────────────────────────────

class TestGetInsight:
    # ── CA-01 ──────────────────────────────────────────────────────────────
    def test_ca01_returns_insight_on_cache_hit(self):
        """キャッシュHIT時はInsightResponseを返すこと。"""
        mock_redis = MagicMock()
        mock_redis.get.return_value = json.dumps(_STORED_DATA)
        with patch("services.cache._get_client", return_value=mock_redis):
            result = get_insight(_SYMBOL)
        assert isinstance(result, InsightResponse)

    # ── CA-02 ──────────────────────────────────────────────────────────────
    def test_ca02_returns_none_on_cache_miss(self):
        """キャッシュMISS時はNoneを返すこと。"""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        with patch("services.cache._get_client", return_value=mock_redis):
            result = get_insight(_SYMBOL)
        assert result is None

    # ── CA-03 ──────────────────────────────────────────────────────────────
    def test_ca03_returns_none_when_redis_is_down(self):
        """Redis接続不可時はNoneを返すこと（Graceful Degradation）。"""
        with patch("services.cache._get_client", return_value=None):
            result = get_insight(_SYMBOL)
        assert result is None

    # ── CA-04 ──────────────────────────────────────────────────────────────
    def test_ca04_returns_none_when_get_raises(self):
        """client.get()が例外を投げた場合はNoneを返すこと（Graceful Degradation）。"""
        mock_redis = MagicMock()
        mock_redis.get.side_effect = Exception("GET error")
        with patch("services.cache._get_client", return_value=mock_redis):
            result = get_insight(_SYMBOL)
        assert result is None

    # ── CA-05 ──────────────────────────────────────────────────────────────
    def test_ca05_deserialization_accuracy(self):
        """HIT時のJSONデシリアライズで全フィールドが型・値ともに正確に復元されること。"""
        mock_redis = MagicMock()
        mock_redis.get.return_value = json.dumps(_STORED_DATA)
        with patch("services.cache._get_client", return_value=mock_redis):
            result = get_insight(_SYMBOL)
        assert result.symbol == _SAMPLE_INSIGHT.symbol
        assert result.sentiment == _SAMPLE_INSIGHT.sentiment
        assert result.summary == _SAMPLE_INSIGHT.summary
        assert result.key_events == _SAMPLE_INSIGHT.key_events
        assert result.risk_factors == _SAMPLE_INSIGHT.risk_factors
        assert result.news_count == _SAMPLE_INSIGHT.news_count

    # ── CA-06 ──────────────────────────────────────────────────────────────
    def test_ca06_returns_none_when_stored_json_is_corrupted(self):
        """Redis保存データが不正JSONの場合はNoneを返すこと（Graceful Degradation）。"""
        mock_redis = MagicMock()
        mock_redis.get.return_value = "CORRUPTED_JSON{{{"
        with patch("services.cache._get_client", return_value=mock_redis):
            result = get_insight(_SYMBOL)
        assert result is None


# ─── set_insight ─────────────────────────────────────────────────────────────

class TestSetInsight:
    # ── CA-07 ──────────────────────────────────────────────────────────────
    def test_ca07_uses_correct_key_format(self):
        """キャッシュキーが 'insight:market:{symbol}' 形式であること。"""
        mock_redis = MagicMock()
        with patch("services.cache._get_client", return_value=mock_redis):
            set_insight(_SYMBOL, _SAMPLE_INSIGHT)
        call_args = mock_redis.setex.call_args
        assert call_args[0][0] == f"insight:market:{_SYMBOL}"

    # ── CA-08 ──────────────────────────────────────────────────────────────
    def test_ca08_uses_correct_ttl(self):
        """TTLがCACHE_TTL定数（10800秒）で設定されること。"""
        mock_redis = MagicMock()
        with patch("services.cache._get_client", return_value=mock_redis):
            set_insight(_SYMBOL, _SAMPLE_INSIGHT)
        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == CACHE_TTL
        assert CACHE_TTL == 10800

    # ── CA-09 ──────────────────────────────────────────────────────────────
    def test_ca09_serialization_accuracy(self):
        """保存されるJSONが全4フィールドを正確に含むこと（cachedは除外）。"""
        mock_redis = MagicMock()
        with patch("services.cache._get_client", return_value=mock_redis):
            set_insight(_SYMBOL, _SAMPLE_INSIGHT)
        call_args = mock_redis.setex.call_args
        stored = json.loads(call_args[0][2])
        assert stored["sentiment"] == _SAMPLE_INSIGHT.sentiment
        assert stored["summary"] == _SAMPLE_INSIGHT.summary
        assert stored["key_events"] == _SAMPLE_INSIGHT.key_events
        assert stored["risk_factors"] == _SAMPLE_INSIGHT.risk_factors
        assert "cached" not in stored  # cachedはキャッシュに保存しない

    # ── CA-10 ──────────────────────────────────────────────────────────────
    def test_ca10_silently_ignores_when_redis_is_down(self):
        """Redis接続不可時は例外を握り潰すこと（Graceful Degradation）。"""
        with patch("services.cache._get_client", return_value=None):
            set_insight(_SYMBOL, _SAMPLE_INSIGHT)  # 例外が出なければOK

    # ── CA-11 ──────────────────────────────────────────────────────────────
    def test_ca11_silently_ignores_when_setex_raises(self):
        """client.setex()が例外を投げても握り潰すこと（Graceful Degradation）。"""
        mock_redis = MagicMock()
        mock_redis.setex.side_effect = Exception("SET error")
        with patch("services.cache._get_client", return_value=mock_redis):
            set_insight(_SYMBOL, _SAMPLE_INSIGHT)  # 例外が出なければOK
