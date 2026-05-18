"""
services/symbol_resolver.py のユニットテスト。

yfinanceをモック化し、ネットワーク通信なしで全分岐を検証する。

テストケース対応:
  SR-01: 有効な国内株シンボル → 社名返却
  SR-02: 有効な米国株シンボル → 社名返却
  SR-03: 無効シンボル（longName/shortName欠損）→ SymbolNotFoundError
  SR-04: yfinanceネットワークエラー → SymbolResolverError
"""

import pytest
from unittest.mock import MagicMock, patch

from services.symbol_resolver import (
    SymbolNotFoundError,
    SymbolResolverError,
    resolve_company_name,
)


class TestResolveCompanyName:
    # ── SR-01 ──────────────────────────────────────────────────────────────
    def test_sr01_domestic_symbol_returns_company_name(self):
        """国内株シンボル（例: 7203.T）から社名を取得できること。"""
        mock_ticker = MagicMock()
        mock_ticker.info = {"longName": "Toyota Motor Corp", "shortName": "Toyota"}

        with patch("services.symbol_resolver.yf.Ticker", return_value=mock_ticker):
            result = resolve_company_name("7203.T")

        assert result == "Toyota Motor Corp"

    # ── SR-02 ──────────────────────────────────────────────────────────────
    def test_sr02_us_symbol_returns_company_name(self):
        """米国株シンボル（例: AAPL）から社名を取得できること。"""
        mock_ticker = MagicMock()
        mock_ticker.info = {"longName": "Apple Inc.", "shortName": "Apple"}

        with patch("services.symbol_resolver.yf.Ticker", return_value=mock_ticker):
            result = resolve_company_name("AAPL")

        assert result == "Apple Inc."

    # ── SR-03 ──────────────────────────────────────────────────────────────
    def test_sr03_invalid_symbol_raises_symbol_not_found(self):
        """longNameもshortNameも存在しない場合はSymbolNotFoundErrorを送出すること。"""
        mock_ticker = MagicMock()
        mock_ticker.info = {}

        with patch("services.symbol_resolver.yf.Ticker", return_value=mock_ticker):
            with pytest.raises(SymbolNotFoundError):
                resolve_company_name("XXXXXXXX")

    # ── SR-04 ──────────────────────────────────────────────────────────────
    def test_sr04_yfinance_network_error_raises_symbol_resolver_error(self):
        """yfinanceがネットワークエラーを投げた場合はSymbolResolverErrorを送出すること。"""
        with patch("services.symbol_resolver.yf.Ticker",
                   side_effect=Exception("network error")):
            with pytest.raises(SymbolResolverError):
                resolve_company_name("7203.T")
