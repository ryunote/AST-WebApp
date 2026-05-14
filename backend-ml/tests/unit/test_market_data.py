"""
市場データ取得関数のテスト。
yfinance への外部通信はモックで代替し、正常系・異常系・エッジケースを検証する。
"""

import pandas as pd
import pytest
from unittest.mock import patch

from services.market_data import fetch_historical_data


# ─── ヘルパー ────────────────────────────────────────────────────────────────

def _make_valid_df(rows: int = 20) -> pd.DataFrame:
    """必須カラムを持つ正常な株価DataFrameを返す"""
    close = [100.0 + i for i in range(rows)]
    return pd.DataFrame({
        "Date":      pd.date_range("2024-01-01", periods=rows),
        "Open":      close,
        "High":      [p + 1 for p in close],
        "Low":       [p - 1 for p in close],
        "Close":     close,
        "Adj Close": close,
        "Volume":    [1_000_000] * rows,
    })


# ─── 正常系 ──────────────────────────────────────────────────────────────────

class TestFetchSuccess:
    def test_returns_dataframe_on_success(self):
        """yfinance が正常データを返す場合、非空のDataFrameを返すこと"""
        with patch("services.market_data.yf.download", return_value=_make_valid_df()):
            result = fetch_historical_data("7203.T")

        assert isinstance(result, pd.DataFrame)
        assert not result.empty

    def test_required_columns_present(self):
        """返却DataFrameに必須カラムが全て含まれること"""
        with patch("services.market_data.yf.download", return_value=_make_valid_df()):
            result = fetch_historical_data("AAPL")

        required = {"Date", "Open", "High", "Low", "Close", "Adj Close", "Volume"}
        assert required.issubset(set(result.columns))

    def test_nan_rows_are_removed(self):
        """欠損値を含む行はdropnaで除去されること"""
        import numpy as np
        df = _make_valid_df(10)
        df.loc[3, "Close"] = np.nan  # 1行にNaNを混入
        with patch("services.market_data.yf.download", return_value=df):
            result = fetch_historical_data("7203.T")

        assert result["Close"].isna().sum() == 0

    def test_handles_multiindex_columns(self):
        """yfinance のMultiIndex形式カラムを正規化すること"""
        normal_df = _make_valid_df()
        multi_cols = pd.MultiIndex.from_tuples(
            [(c, "7203.T") for c in normal_df.columns]
        )
        multiindex_df = normal_df.copy()
        multiindex_df.columns = multi_cols

        with patch("services.market_data.yf.download", return_value=multiindex_df):
            result = fetch_historical_data("7203.T")

        assert not result.empty
        assert "Close" in result.columns


# ─── 異常系・エラーハンドリング ──────────────────────────────────────────────

class TestFetchErrors:
    def test_returns_empty_df_when_no_data(self):
        """yfinance が空DataFrameを返す場合、空DataFrameを返すこと（リトライ後）"""
        with patch("services.market_data.yf.download", return_value=pd.DataFrame()), \
             patch("services.market_data.time.sleep"):  # リトライの待機をスキップ
            result = fetch_historical_data("INVALID")

        assert isinstance(result, pd.DataFrame)
        assert result.empty

    def test_returns_empty_df_on_missing_columns(self):
        """必須カラムが欠けている場合、空DataFrameを返すこと"""
        incomplete_df = pd.DataFrame({
            "Date":  pd.date_range("2024-01-01", periods=5),
            "Close": [100.0] * 5,
            # Open, High, Low, Adj Close, Volume が欠落
        })
        with patch("services.market_data.yf.download", return_value=incomplete_df), \
             patch("services.market_data.time.sleep"):
            result = fetch_historical_data("PARTIAL")

        assert isinstance(result, pd.DataFrame)
        assert result.empty

    def test_returns_empty_df_on_exception(self):
        """yfinance が例外を送出した場合、空DataFrameを返すこと"""
        with patch("services.market_data.yf.download", side_effect=Exception("network error")), \
             patch("services.market_data.time.sleep"):
            result = fetch_historical_data("ERROR")

        assert isinstance(result, pd.DataFrame)
        assert result.empty

    def test_retries_on_empty_data(self):
        """データ空の場合は3回リトライすること"""
        with patch("services.market_data.yf.download", return_value=pd.DataFrame()) as mock_dl, \
             patch("services.market_data.time.sleep"):
            fetch_historical_data("RETRY")

        # max_retries = 3
        assert mock_dl.call_count == 3
