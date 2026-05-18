import yfinance as yf


class SymbolNotFoundError(Exception):
    """yfinanceが証券コードに対応する社名を返せない場合。"""


class SymbolResolverError(Exception):
    """yfinanceのネットワーク障害等、内部エラーの場合。"""


def resolve_company_name(symbol: str) -> str:
    """
    証券コードから会社名を取得する。

    Args:
        symbol: 証券コード (例: "7203.T", "AAPL")

    Returns:
        str: 会社名 (例: "Toyota Motor Corp")

    Raises:
        SymbolNotFoundError: yfinanceがlongName/shortNameを返せない場合
        SymbolResolverError: yfinanceのネットワーク障害等
    """
    try:
        info = yf.Ticker(symbol).info
        name = info.get("longName") or info.get("shortName")
        if not name:
            raise SymbolNotFoundError(f"Company name not found for symbol: {symbol}")
        return name
    except SymbolNotFoundError:
        raise
    except Exception as e:
        raise SymbolResolverError(f"Failed to resolve {symbol}: {e}") from e
