import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from db.database import engine
from db import models
# 作成したルーターをインポート
from routers import stocks, analysis

# アプリケーション起動時にDBテーブルを作成（Phase 1用簡易マイグレーション）
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Stock Trading System API",
    description="株式売買提案システムのバックエンドAPI (Phase 1)",
    version="1.0.0"
)

# CORS設定
# ALLOWED_ORIGINS: カンマ区切りで複数 origin を指定可能
# 例（本番）: ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
origins = [o.strip() for o in _raw_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

# ルーターの登録
# 機能ごとにエンドポイントを分割して管理
app.include_router(stocks.router)
app.include_router(analysis.router)

@app.get("/")
def read_root():
    """ヘルスチェック用エンドポイント"""
    return {"message": "Hello from FastAPI Backend!"}

# AWS Lambda実行用ハンドラ
handler = Mangum(app)