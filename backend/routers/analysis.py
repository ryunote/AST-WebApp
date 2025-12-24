from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from db.database import get_db
from db.models import StockInTrade
from services.market_data import fetch_historical_data
from services.ml_engine import predict_stock_movement
from schemas import StockAnalysisResult

router = APIRouter()

# 再購入禁止期間 (設定値: 3日)
REPURCHASE_PROHIBITING_DAYS = 3

def check_repurchase_prohibition(stock: StockInTrade) -> bool:
    """売却済みの銘柄が再購入禁止期間内かどうかを確認する"""
    if not stock.order_datetime or not str(stock.order_datetime).startswith('売却済:'):
        return False
        
    try:
        # '売却済: YYYY/MM/DD HH:MM:SS' 形式をパース
        sold_time_str = stock.order_datetime.split('売却済: ')[1]
        sold_datetime = datetime.strptime(sold_time_str, "%Y/%m/%d %H:%M:%S")
        
        delta = datetime.now() - sold_datetime
        return delta.days < REPURCHASE_PROHIBITING_DAYS
    except (IndexError, ValueError):
        return False

@router.get("/api/analysis/{stock_symbol}", response_model=StockAnalysisResult)
def analyze_stock(stock_symbol: str, db: Session = Depends(get_db)):
    """
    指定された銘柄に対して、株価取得・AI予測・売買判断を行う。
    デスクトップ版の自動売買ロジックをシミュレーションとして実行し、結果を返す。
    """
    
    # 1. DBから銘柄情報を取得（保有状況の確認）
    db_stock = db.query(StockInTrade).filter(StockInTrade.stock_symbol == stock_symbol).first()
    
    if not db_stock:
        raise HTTPException(status_code=404, detail="銘柄が登録されていません。先に登録してください。")

    # 2. データの取得 (Market Data Service)
    df = fetch_historical_data(stock_symbol)
    if df.empty:
        raise HTTPException(status_code=500, detail="株価データの取得に失敗しました。")
    
    current_price = df["Close"].iloc[-1]

    # 3. AI予測 (ML Engine Service)
    prediction = predict_stock_movement(df)

    # 4. 売買判断ロジック (Business Logic)
    suggestion = "STAY"
    reason = "判断保留"

    # 現在、未保有の場合 (order_id が '---')
    if db_stock.order_id == '---':
        if prediction == "up":
            if check_repurchase_prohibition(db_stock):
                suggestion = "WAIT"
                reason = f"AIは上昇予測ですが、再購入禁止期間({REPURCHASE_PROHIBITING_DAYS}日以内)のため待機推奨です。"
            else:
                suggestion = "BUY"
                reason = "AIが上昇を予測しました。新規購入を提案します。"
        else:
            suggestion = "STAY"
            reason = "AIは下落または横ばいを予測しています。"
    
    # 現在、保有中の場合
    else:
        if prediction == "down":
            suggestion = "SELL"
            reason = "AIが下落を予測しました。利益確定または損切りを提案します。"
        else:
            suggestion = "HOLD"
            reason = "AIは上昇継続を予測しています。保有継続を提案します。"

    return StockAnalysisResult(
        stock_symbol=stock_symbol,
        prediction=prediction,
        suggestion=suggestion,
        current_price=float(current_price),
        reason=reason
    )