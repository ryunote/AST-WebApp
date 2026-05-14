"""
Redis キャッシュサービスのユニットテスト。

設計上の重要な保証:
  1. Graceful Degradation: Redis障害時に例外を上に伝播させず、キャッシュミス扱いで続行
  2. キャッシュキー形式: "predict:{stock_symbol}"
  3. TTL: 3600秒（モジュール定数）

redisモジュールはモックで代替し、ネットワーク通信なしで検証する。
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from services.cache import get_prediction, set_prediction, _get_client, CACHE_TTL


SAMPLE_DATA = {
    "stock_symbol": "7203.T",
    "current_price": 2850.0,
    "prediction": "up",
}


# ─── _get_client ─────────────────────────────────────────────────────────────

class TestGetClient:
    def test_returns_client_on_successful_connection(self):
        """ping成功時はRedisクライアントを返すこと"""
        mock_client = MagicMock()
        mock_client.ping.return_value = True
        with patch("services.cache.redis.from_url", return_value=mock_client):
            result = _get_client()
        assert result is mock_client

    def test_returns_none_when_from_url_raises(self):
        """redis.from_url()が例外を投げた場合はNoneを返すこと"""
        with patch("services.cache.redis.from_url", side_effect=Exception("connection refused")):
            result = _get_client()
        assert result is None

    def test_returns_none_when_ping_fails(self):
        """ping()失敗時はNoneを返すこと（接続はできてもサーバーが応答しない場合）"""
        mock_client = MagicMock()
        mock_client.ping.side_effect = Exception("ping timeout")
        with patch("services.cache.redis.from_url", return_value=mock_client):
            result = _get_client()
        assert result is None


# ─── get_prediction ──────────────────────────────────────────────────────────

class TestGetPrediction:
    def test_returns_dict_on_cache_hit(self):
        """Redisにデータが存在する場合、dictを返すこと"""
        mock_redis = MagicMock()
        mock_redis.get.return_value = json.dumps(SAMPLE_DATA)
        with patch("services.cache._get_client", return_value=mock_redis):
            result = get_prediction("7203.T")
        assert result == SAMPLE_DATA

    def test_returns_none_on_cache_miss(self):
        """Redisにキーが存在しない場合、Noneを返すこと"""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        with patch("services.cache._get_client", return_value=mock_redis):
            result = get_prediction("7203.T")
        assert result is None

    def test_returns_none_when_redis_is_down(self):
        """Redis接続不可時はNoneを返すこと（Graceful Degradation）"""
        with patch("services.cache._get_client", return_value=None):
            result = get_prediction("7203.T")
        assert result is None

    def test_uses_correct_cache_key_format(self):
        """キャッシュキーが 'predict:{symbol}' 形式で呼ばれること"""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        with patch("services.cache._get_client", return_value=mock_redis):
            get_prediction("7203.T")
        mock_redis.get.assert_called_once_with("predict:7203.T")

    def test_different_symbols_use_different_keys(self):
        """銘柄コードが異なれば異なるキーを使うこと"""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        with patch("services.cache._get_client", return_value=mock_redis):
            get_prediction("AAPL")
        mock_redis.get.assert_called_once_with("predict:AAPL")

    def test_returns_none_on_client_get_exception(self):
        """client.get()が例外を投げた場合、例外を上げずNoneを返すこと"""
        mock_redis = MagicMock()
        mock_redis.get.side_effect = Exception("Redis read error")
        with patch("services.cache._get_client", return_value=mock_redis):
            result = get_prediction("7203.T")
        assert result is None

    def test_deserializes_json_correctly(self):
        """JSON文字列が正しくdictにデシリアライズされること"""
        data = {"stock_symbol": "AAPL", "current_price": 150.5, "prediction": "down"}
        mock_redis = MagicMock()
        mock_redis.get.return_value = json.dumps(data)
        with patch("services.cache._get_client", return_value=mock_redis):
            result = get_prediction("AAPL")
        assert result["current_price"] == 150.5
        assert result["prediction"] == "down"


# ─── set_prediction ──────────────────────────────────────────────────────────

class TestSetPrediction:
    def test_calls_setex_with_correct_key(self):
        """setexが 'predict:{symbol}' キーで呼ばれること"""
        mock_redis = MagicMock()
        with patch("services.cache._get_client", return_value=mock_redis):
            set_prediction("7203.T", SAMPLE_DATA)
        args = mock_redis.setex.call_args[0]
        assert args[0] == "predict:7203.T"

    def test_calls_setex_with_correct_ttl(self):
        """setexがモジュール定数CACHE_TTL（3600秒）で呼ばれること"""
        mock_redis = MagicMock()
        with patch("services.cache._get_client", return_value=mock_redis):
            set_prediction("7203.T", SAMPLE_DATA)
        args = mock_redis.setex.call_args[0]
        assert args[1] == CACHE_TTL

    def test_calls_setex_with_json_serialized_data(self):
        """setexにJSONシリアライズされたデータが渡されること"""
        mock_redis = MagicMock()
        with patch("services.cache._get_client", return_value=mock_redis):
            set_prediction("7203.T", SAMPLE_DATA)
        args = mock_redis.setex.call_args[0]
        assert json.loads(args[2]) == SAMPLE_DATA

    def test_does_nothing_when_redis_is_down(self):
        """Redis接続不可時は例外を投げずに処理が続行されること"""
        with patch("services.cache._get_client", return_value=None):
            set_prediction("7203.T", SAMPLE_DATA)  # 例外が起きないこと

    def test_silently_handles_setex_exception(self):
        """client.setex()が例外を投げた場合、例外を握りつぶして続行すること"""
        mock_redis = MagicMock()
        mock_redis.setex.side_effect = Exception("Redis write error")
        with patch("services.cache._get_client", return_value=mock_redis):
            set_prediction("7203.T", SAMPLE_DATA)  # 例外が上に来ないこと
