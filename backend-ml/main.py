"""
ML Service Entrypoint
=====================

機械学習(ML)とデータ取得を担当するマイクロサービスのメインエントリーポイントです。
FastAPIを使用して構築されており、Core Serviceからのリクエストに応じて
株価データの取得、加工、およびXGBoostモデルによる予測を実行します。

本サービスはステートレスであり、データベースへの書き込みは行いません。
"""

import sys
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ビジネスロジックモジュールのインポート
from services.market_data import fetch_historical_data
from services.ml_engine import predict_stock_movement

app = FastAPI(
    title="AST-Web ML Service",
    description="株価予測およびデータ取得を行うマイクロサービス API",
    version="1.0.0"
)

class PredictionResponse(BaseModel):
    """予測APIのレスポンススキーマ定義"""
    stock_symbol: str
    current_price: float
    prediction: str  # "up", "down", "unknown"

@app.get("/predict/{stock_symbol}", response_model=PredictionResponse)
def predict(stock_symbol: str) -> PredictionResponse:
    """
    指定された銘柄の株価データを取得し、AIモデルによる予測を実行します。

    Args:
        stock_symbol (str): 証券コード (例: "7203.T")

    Returns:
        PredictionResponse: 以下のフィールドを含むオブジェクト
            - stock_symbol: リクエストされた証券コード
            - current_price: 直近の終値
            - prediction: "up"(上昇予測), "down"(下落予測), または "unknown"(判定不能)

    Raises:
        HTTPException(500): データ取得失敗、データ不足、または予測ロジック内でエラーが発生した場合
    """
    print(f"--- [ML Service] Analyzing {stock_symbol} ---", file=sys.stdout)

    # 1. データ取得
    try:
        # yfinanceを用いて過去データを取得
        df = fetch_historical_data(stock_symbol)
    except Exception as e:
        print(f"[Error] Data fetch failed: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Data fetch error: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=500, detail="No data found (データが取得できませんでした)")

    # 取得データの最終行から現在価格を抽出
    current_price = float(df["Close"].iloc[-1])

    # 2. AI予測実行
    try:
        # XGBoostモデルによる推論
        prediction = predict_stock_movement(df)
    except Exception as e:
        print(f"[Error] Prediction failed: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

    return PredictionResponse(
        stock_symbol=stock_symbol,
        current_price=current_price,
        prediction=prediction
    )

@app.get("/health")
def health_check() -> dict:
    """
    サービスの稼働状況を確認するためのヘルスチェックエンドポイント。
    KubernetesのLiveness Probe等で使用されます。
    """
    return {"status": "ok", "service": "ml-service"}