"""
XGBoost 予測エンジンのユニットテスト。
yfinance への外部通信は発生しない（DataFrameを直接渡す純粋関数テスト）。
"""

import numpy as np
import pandas as pd
import pytest

from services.ml_engine import predict_stock_movement


# ─── ヘルパー ────────────────────────────────────────────────────────────────

def _make_trending_df(n_rows: int, trend: str) -> pd.DataFrame:
    """
    テスト用の株価DataFrameを生成する。
    強いトレンドの中に少数の逆方向日を挿入し、y_train に 0/1 両方が含まれるよう設計。
    XGBoost は binary classification で全ラベルが単一クラスだと ValueError になるため。
    """
    if trend == "up":
        main_step, exception_step = 5.0, -1.0
        start = 100.0
    else:
        main_step, exception_step = -5.0, 1.0
        start = 200.0

    # 5, 15, 25日目だけ逆方向（n_rows に収まる範囲）
    exception_days = {d for d in (5, 15, 25) if d < n_rows}

    close = [start]
    for i in range(1, n_rows):
        delta = exception_step if i in exception_days else main_step
        close.append(close[-1] + delta)

    return pd.DataFrame({
        "Date": pd.date_range("2024-01-01", periods=n_rows),
        "Open": [p - 1.0 for p in close],
        "High": [p + 2.0 for p in close],
        "Low":  [p - 3.0 for p in close],
        "Close": close,
        "Adj Close": close,
        "Volume": [1_000_000] * n_rows,
    })


# ─── データ不足ケース ────────────────────────────────────────────────────────

class TestInsufficientData:
    def test_empty_dataframe_returns_unknown(self):
        """空DataFrame は 'unknown' を返すこと"""
        assert predict_stock_movement(pd.DataFrame()) == "unknown"

    def test_9_rows_returns_unknown(self):
        """9行以下は 'unknown' を返すこと（閾値は10行）"""
        df = _make_trending_df(9, "up")
        assert predict_stock_movement(df) == "unknown"

    def test_10_rows_does_not_return_unknown(self):
        """10行以上はデータ不足による 'unknown' を返さないこと"""
        df = _make_trending_df(10, "up")
        result = predict_stock_movement(df)
        assert result in ("up", "down"), f"unexpected result: {result}"

    def test_all_nan_returns_unknown(self):
        """dropna で全行削除されるデータは 'unknown' を返すこと"""
        df = pd.DataFrame({
            "Date": pd.date_range("2024-01-01", periods=15),
            "Open":      [np.nan] * 15,
            "High":      [np.nan] * 15,
            "Low":       [np.nan] * 15,
            "Close":     [np.nan] * 15,
            "Adj Close": [np.nan] * 15,
            "Volume":    [np.nan] * 15,
        })
        assert predict_stock_movement(df) == "unknown"


# ─── 予測値の正当性 ──────────────────────────────────────────────────────────

class TestPredictionAccuracy:
    def test_strong_uptrend_predicts_up(self):
        """一貫した上昇トレンド（30日）は 'up' を予測すること"""
        df = _make_trending_df(30, "up")
        assert predict_stock_movement(df) == "up"

    def test_strong_downtrend_predicts_down(self):
        """一貫した下落トレンド（30日）は 'down' を予測すること"""
        df = _make_trending_df(30, "down")
        assert predict_stock_movement(df) == "down"

    def test_return_value_is_valid_label(self):
        """戻り値は 'up' / 'down' / 'unknown' のいずれかであること"""
        df = _make_trending_df(20, "up")
        result = predict_stock_movement(df)
        assert result in ("up", "down", "unknown"), f"不正な戻り値: {result}"

    def test_does_not_mutate_input_dataframe(self):
        """入力DataFrameを変更しないこと（副作用なし）"""
        df = _make_trending_df(20, "up")
        original_shape = df.shape
        original_cols = list(df.columns)

        predict_stock_movement(df)

        assert df.shape == original_shape
        assert list(df.columns) == original_cols
