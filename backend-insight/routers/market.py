import os

from fastapi import APIRouter, HTTPException, Path

from schemas.market import InsightResponse
from services import cache
from services.llm_client import (
    LLMAuthError,
    LLMClient,
    LLMError,
    LLMParseError,
    LLMRateLimitError,
)
from services.news_fetcher import (
    NewsAPIAuthError,
    NewsAPIError,
    NewsAPIRateLimitError,
    NewsFetcher,
)
from services.symbol_resolver import (
    SymbolNotFoundError,
    SymbolResolverError,
    resolve_company_name,
)

router = APIRouter(prefix="/insight", tags=["insight"])

# 大文字英数字・ドット・ハイフン・キャレットのみ許可（例: "7203.T", "AAPL", "^GSPC"）
_SYMBOL_PATTERN = r"^[A-Z0-9.\^-]+$"


@router.get("/market/{symbol}", response_model=InsightResponse)
def get_market_insight(
    symbol: str = Path(..., min_length=1, pattern=_SYMBOL_PATTERN),
) -> InsightResponse:
    """
    指定した証券コードのニュース感情分析を返す。

    Args:
        symbol: 証券コード (例: "7203.T", "AAPL")

    Returns:
        InsightResponse: ニュース感情分析結果

    Raises:
        HTTPException 422: シンボルが不正形式
        HTTPException 404: yfinanceで社名を解決できないシンボル
        HTTPException 503: 外部サービス（yfinance/NewsAPI/Gemini）障害
    """
    # 1. キャッシュ確認
    cached_data = cache.get_insight(symbol)
    if cached_data is not None:
        return cached_data.model_copy(update={"cached": True})

    # 2. 証券コード → 社名変換
    try:
        company_name = resolve_company_name(symbol)
    except SymbolNotFoundError:
        raise HTTPException(status_code=404, detail=f"Symbol not found: {symbol}")
    except SymbolResolverError:
        raise HTTPException(status_code=503, detail="Symbol resolution service unavailable")

    # 3. ニュース取得
    try:
        fetcher = NewsFetcher(api_key=os.environ.get("NEWSAPI_KEY", ""))
        articles = fetcher.fetch(company_name)
    except (NewsAPIError, NewsAPIAuthError, NewsAPIRateLimitError) as e:
        raise HTTPException(status_code=503, detail=f"News service unavailable: {e}")

    # 4. LLM分析
    try:
        llm = LLMClient(api_key=os.environ.get("GEMINI_API_KEY", ""))
        insight = llm.analyze(articles)
    except (LLMError, LLMAuthError, LLMRateLimitError, LLMParseError) as e:
        raise HTTPException(status_code=503, detail=f"AI analysis service unavailable: {e}")

    insight.symbol = symbol

    # 5. キャッシュ書き込み（Graceful Degradation: write失敗でもレスポンスは返す）
    try:
        cache.set_insight(symbol, insight)
    except Exception:
        pass

    return insight
