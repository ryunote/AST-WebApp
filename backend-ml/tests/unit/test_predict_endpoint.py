"""
ML Service /predict/{stock_symbol} エンドポイントの網羅的テスト。

テスト対象のフロー:
  キャッシュ確認 → データ取得(yfinance) → ML予測(XGBoost) → キャッシュ保存 → レスポンス返却

外部依存（yfinance・Redis・XGBoost）は全てモックで代替し、
フロー制御ロジックとレスポンス値の正当性を検証する。
"""

import pandas as pd
import pytest
from unittest.mock import patch, MagicMock


# ─── ヘルパー ────────────────────────────────────────────────────────────────

def _make_df(n: int = 30) -> pd.DataFrame:
    """テスト用の株価DataFrame（Close最終値 = 100 + n - 1）"""
    close = [100.0 + i for i in range(n)]
    return pd.DataFrame({
        "Date":      pd.date_range("2024-01-01", periods=n),
        "Open":      [p - 1.0 for p in close],
        "High":      [p + 1.0 for p in close],
        "Low":       [p - 2.0 for p in close],
        "Close":     close,
        "Adj Close": close,
        "Volume":    [1_000_000] * n,
    })


def _cached(symbol: str, price: float, prediction: str) -> dict:
    return {"stock_symbol": symbol, "current_price": price, "prediction": prediction}


# ─── キャッシュ HIT ──────────────────────────────────────────────────────────

class TestCacheHit:
    def test_returns_cached_data(self, client):
        """キャッシュHIT時はキャッシュの値をそのまま返すこと"""
        cached = _cached("7203.T", 2850.0, "up")
        with patch("main.get_prediction", return_value=cached):
            response = client.get("/predict/7203.T")

        assert response.status_code == 200
        assert response.json() == cached

    def test_does_not_call_yfinance_on_cache_hit(self, client):
        """キャッシュHIT時はyfinanceを呼ばないこと（コスト削減）"""
        with patch("main.get_prediction", return_value=_cached("AAPL", 150.0, "up")), \
             patch("main.fetch_historical_data") as mock_fetch:
            client.get("/predict/AAPL")

        mock_fetch.assert_not_called()

    def test_does_not_call_ml_engine_on_cache_hit(self, client):
        """キャッシュHIT時はMLエンジンを呼ばないこと"""
        with patch("main.get_prediction", return_value=_cached("AAPL", 150.0, "down")), \
             patch("main.predict_stock_movement") as mock_ml:
            client.get("/predict/AAPL")

        mock_ml.assert_not_called()


# ─── キャッシュ MISS → 正常フロー ────────────────────────────────────────────

class TestCacheMissNormalFlow:
    def test_returns_200_with_prediction(self, client):
        """キャッシュMISS時に予測結果が返ること"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=_make_df()), \
             patch("main.predict_stock_movement", return_value="up"), \
             patch("main.set_prediction"):
            response = client.get("/predict/7203.T")

        assert response.status_code == 200
        assert response.json()["prediction"] == "up"

    def test_stock_symbol_in_response_matches_request(self, client):
        """レスポンスのstock_symbolがリクエストパスと一致すること"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=_make_df()), \
             patch("main.predict_stock_movement", return_value="down"), \
             patch("main.set_prediction"):
            response = client.get("/predict/9984.T")

        assert response.json()["stock_symbol"] == "9984.T"

    def test_current_price_is_last_row_close(self, client):
        """current_priceがDataFrameの最終行Close値であること"""
        df = _make_df(20)
        expected_price = float(df["Close"].iloc[-1])  # 119.0

        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=df), \
             patch("main.predict_stock_movement", return_value="up"), \
             patch("main.set_prediction"):
            response = client.get("/predict/7203.T")

        assert response.json()["current_price"] == expected_price

    def test_response_contains_all_required_fields(self, client):
        """レスポンスにstock_symbol・current_price・predictionが含まれること"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=_make_df()), \
             patch("main.predict_stock_movement", return_value="unknown"), \
             patch("main.set_prediction"):
            body = client.get("/predict/AAPL").json()

        assert "stock_symbol" in body
        assert "current_price" in body
        assert "prediction" in body

    def test_set_prediction_called_after_success(self, client):
        """正常予測後にset_predictionが呼ばれること（キャッシュ保存）"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=_make_df()), \
             patch("main.predict_stock_movement", return_value="up"), \
             patch("main.set_prediction") as mock_set:
            client.get("/predict/7203.T")

        mock_set.assert_called_once()

    def test_set_prediction_receives_correct_symbol_and_prediction(self, client):
        """set_predictionに正しいsymbolと予測値が渡されること"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=_make_df()), \
             patch("main.predict_stock_movement", return_value="down"), \
             patch("main.set_prediction") as mock_set:
            client.get("/predict/9984.T")

        symbol, data = mock_set.call_args[0]
        assert symbol == "9984.T"
        assert data["prediction"] == "down"
        assert data["stock_symbol"] == "9984.T"


# ─── エラーハンドリング ──────────────────────────────────────────────────────

class TestErrorHandling:
    def test_empty_dataframe_returns_500(self, client):
        """yfinanceが空DataFrameを返す場合は500を返すこと"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=pd.DataFrame()):
            response = client.get("/predict/INVALID")

        assert response.status_code == 500

    def test_empty_dataframe_error_message_in_detail(self, client):
        """空DataFrame時のエラーdetailにメッセージが含まれること"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=pd.DataFrame()):
            response = client.get("/predict/INVALID")

        assert "detail" in response.json()

    def test_fetch_exception_returns_500(self, client):
        """データ取得で例外が発生した場合は500を返すこと"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", side_effect=Exception("network error")):
            response = client.get("/predict/ERROR")

        assert response.status_code == 500

    def test_prediction_exception_returns_500(self, client):
        """MLエンジンで例外が発生した場合は500を返すこと"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=_make_df()), \
             patch("main.predict_stock_movement", side_effect=ValueError("model error")):
            response = client.get("/predict/7203.T")

        assert response.status_code == 500

    def test_set_prediction_not_called_on_error(self, client):
        """エラー時はset_predictionが呼ばれないこと（不完全データをキャッシュしない）"""
        with patch("main.get_prediction", return_value=None), \
             patch("main.fetch_historical_data", return_value=pd.DataFrame()), \
             patch("main.set_prediction") as mock_set:
            client.get("/predict/INVALID")

        mock_set.assert_not_called()
