from fastapi import FastAPI

from routers.market import router as market_router

app = FastAPI(
    title="AST-Web Insight Service",
    description="LLMを用いたニュース感情分析・ユーザー売買傾向分析を行うマイクロサービス API",
    version="1.0.0",
)

app.include_router(market_router)


@app.get("/health")
def health_check() -> dict:
    """
    サービスの稼働状況確認エンドポイント。
    KubernetesのLiveness Probe等で使用される。
    """
    return {"status": "ok", "service": "insight-service"}
