from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import sys

from db.database import get_db
from db.models import StockInTrade
from services.market_data import fetch_historical_data
from services.ml_engine import predict_stock_movement
from schemas import StockAnalysisResult

router = APIRouter()

# 再購入禁止期間 (設定値)
REPURCHASE_PROHIBITING_DAYS = 3

def check_repurchase_prohibition(stock: StockInTrade) -> bool:
    """売却済みの銘柄が再購入禁止期間内かどうかを確認する"""
    if not stock.order_datetime or not str(stock.order_datetime).startswith('売却済:'):
        return False
    try:
        sold_time_str = stock.order_datetime.split('売却済: ')[1]
        sold_datetime = datetime.strptime(sold_time_str, "%Y/%m/%d %H:%M:%S")
        delta = datetime.now() - sold_datetime
        return delta.days < REPURCHASE_PROHIBITING_DAYS
    except (IndexError, ValueError):
        return False

@router.get("/api/analysis/{stock_symbol}", response_model=StockAnalysisResult)
def analyze_stock(stock_symbol: str, db: Session = Depends(get_db)):
    """
    指定された銘柄に対して、株価取得・AI予測・売買判断を行い、結果をDBに保存する。
    """
    print(f"--- [Analysis Start] {stock_symbol} ---", file=sys.stdout)
    
    # 1. DBから銘柄情報を取得
    db_stock = db.query(StockInTrade).filter(StockInTrade.stock_symbol == stock_symbol).first()
    
    if not db_stock:
        print(f"[Error] Stock {stock_symbol} not found in DB.", file=sys.stderr)
        raise HTTPException(status_code=404, detail="銘柄が登録されていません。先に登録してください。")

    # 2. データの取得
    try:
        df = fetch_historical_data(stock_symbol)
    except Exception as e:
        print(f"[Error] fetch_historical_data failed: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"データ取得エラー: {str(e)}")

    if df.empty:
        print(f"[Error] Fetched data is empty for {stock_symbol}.", file=sys.stderr)
        raise HTTPException(status_code=500, detail="株価データの取得に失敗しました（データなし）。")
    
    current_price = float(df["Close"].iloc[-1])
    print(f"[Info] Current price for {stock_symbol}: {current_price}", file=sys.stdout)

    # 3. AI予測
    try:
        prediction = predict_stock_movement(df)
        print(f"[Info] Prediction for {stock_symbol}: {prediction}", file=sys.stdout)
    except Exception as e:
        print(f"[Error] ML prediction failed: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"AI予測エラー: {str(e)}")

    # 4. 売買判断ロジック
    suggestion = "STAY"
    reason = "判断保留"

    if db_stock.order_id == '---': # 未保有
        if prediction == "up":
            if check_repurchase_prohibition(db_stock):
                suggestion = "WAIT"
                reason = f"AI上昇予測ですが、再購入禁止期間中のため待機推奨。"
            else:
                suggestion = "BUY"
                reason = "AI上昇予測。新規購入を提案。"
        else:
            suggestion = "STAY"
            reason = "AI下落または横ばい予測。"
    else: # 保有中
        if prediction == "down":
            suggestion = "SELL"
            reason = "AI下落予測。決済を提案。"
        else:
            suggestion = "HOLD"
            reason = "AI上昇継続予測。保有継続を提案。"

    # 5. 結果をDBに保存
    now_str = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    
    # 属性の更新
    db_stock.current_price = current_price
    db_stock.ai_prediction = prediction
    db_stock.ai_suggestion = suggestion
    db_stock.last_analyzed_at = now_str
    
    try:
        # 明示的にaddしてからcommit (Updateの場合もaddは安全策として有効)
        db.add(db_stock)
        db.commit()
        db.refresh(db_stock)
        print(f"[Success] DB updated for {stock_symbol}", file=sys.stdout)
    except Exception as e:
        db.rollback()
        print(f"[Error] DB commit failed: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=f"DB保存エラー: {str(e)}")

    return StockAnalysisResult(
        stock_symbol=stock_symbol,
        prediction=prediction,
        suggestion=suggestion,
        current_price=current_price,
        reason=reason,
        last_analyzed_at=now_str
    )