from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from datetime import datetime
# pandasのインポートは不要になりました（main.pyでは操作しないため）

from services.stock_data import get_stock_data_yf

app = FastAPI()

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
    return {"message": "Hello from FastAPI Backend!"}

@app.get("/api/stock/{ticker_symbol}")
def read_stock_data(
    ticker_symbol: str,
    start_date: str = Query(..., description="開始日 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="終了日 (YYYY-MM-DD)")
):
    try:
        dt_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        dt_end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="日付形式エラー")

    # データ取得（ここで既にDateは文字列化されている）
    df = get_stock_data_yf(ticker_symbol, dt_start, dt_end)

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"銘柄 {ticker_symbol} のデータなし")

    # DataFrameを辞書のリスト [{'Date': '2024-01-01', ...}, ...] に変換して返す
    # FastAPIはこれを自動的にJSONレスポンスに変換する
    return df.to_dict(orient="records")

handler = Mangum(app)