from fastapi import FastAPI, Depends, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from mangum import Mangum
from datetime import datetime

# 内部モジュールのインポート
from db import crud, models
from db.database import engine, get_db
from services.stock_data import get_stock_data_yf
from schemas import StockUpdate, StockCreate

# アプリケーション起動時にテーブルを作成する
# ※ 本番運用ではAlembic等のマイグレーションツール使用を推奨
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Stock Trading System API",
    description="株式売買提案システムのバックエンドAPI",
    version="1.0.0"
)

# CORS設定
# フロントエンド(Next.js)からのアクセスを許可
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    """ヘルスチェック用エンドポイント。"""
    return {"message": "Hello from FastAPI Backend!"}

# ------------------------------------------------------------------
# 株価データ取得 API
# ------------------------------------------------------------------

@app.get("/api/stock/{ticker_symbol}")
def read_stock_data(
    ticker_symbol: str,
    start_date: str = Query(..., description="開始日 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="終了日 (YYYY-MM-DD)")
):
    """指定された銘柄と期間の株価データを取得する。

    Args:
        ticker_symbol (str): 証券コード (例: 7203.T)
        start_date (str): 取得開始日
        end_date (str): 取得終了日

    Returns:
        list[dict]: 日付ごとの株価データリスト
    """
    try:
        dt_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        dt_end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="日付形式エラー。YYYY-MM-DD形式で指定してください。")

    df = get_stock_data_yf(ticker_symbol, dt_start, dt_end)

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"銘柄 {ticker_symbol} のデータが見つかりませんでした。")

    return df.to_dict(orient="records")

# ------------------------------------------------------------------
# 銘柄管理 API (DB操作)
# ------------------------------------------------------------------

@app.get("/api/stocks")
def list_stocks(db: Session = Depends(get_db)):
    """登録されている自動売買対象の銘柄一覧を取得する。"""
    return crud.get_stocks(db)

@app.post("/api/stocks")
def add_stock(
    stock_symbol: str = Body(..., embed=True, description="登録する証券コード"),
    db: Session = Depends(get_db)
):
    """新しい銘柄を自動売買リストに登録する。

    yfinanceから銘柄名を取得し、DBに保存する。
    """
    result = crud.create_stock(db, stock_symbol)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.post("/api/stocks")
def add_stock(
    item: StockCreate, # Pydanticモデルで受け取る形に変更（より堅牢）
    db: Session = Depends(get_db)
):
    """新しい銘柄を自動売買リストに登録する。"""
    result = crud.create_stock(db, item.stock_symbol)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.put("/api/stocks/{stock_symbol}")
def update_stock(
    stock_symbol: str,
    item: StockUpdate,
    db: Session = Depends(get_db)
):
    """
    銘柄情報を更新する。
    売買シミュレーション結果の反映や、手動決済情報の記録に使用する。
    """
    result = crud.update_stock(db, stock_symbol, item)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@app.delete("/api/stocks/{stock_symbol}")
def remove_stock(stock_symbol: str, db: Session = Depends(get_db)):
    """銘柄を自動売買リストから削除する。

    保有中（未決済）の銘柄は削除できない仕様とする。
    """
    result = crud.delete_stock(db, stock_symbol)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

# AWS Lambda用ハンドラ
handler = Mangum(app)