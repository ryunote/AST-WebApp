"""
取引履歴ルーター
================
売買取引の記録・取得・決済エンドポイント。
BUY 記録時は加重平均コスト法で average_acquisition_price を再計算し StockInTrade に同期する。
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import StockInTrade, TradeHistory
from schemas import TradeCreate, TradeResponse

router = APIRouter()


@router.get("/api/stocks/{stock_symbol}/trades", response_model=List[TradeResponse])
def get_trades(stock_symbol: str, db: Session = Depends(get_db)) -> List[TradeResponse]:
    """
    指定銘柄の取引履歴を新しい順に取得する。

    Args:
        stock_symbol (str): 証券コード
        db (Session): DBセッション

    Returns:
        List[TradeResponse]: 取引履歴リスト

    Raises:
        HTTPException: 銘柄未登録(404)
    """
    if not db.query(StockInTrade).filter(StockInTrade.stock_symbol == stock_symbol).first():
        raise HTTPException(status_code=404, detail=f"銘柄 {stock_symbol} が登録されていません")

    return (
        db.query(TradeHistory)
        .filter(TradeHistory.stock_symbol == stock_symbol)
        .order_by(TradeHistory.trade_datetime.desc())
        .all()
    )


@router.post("/api/stocks/{stock_symbol}/trades", response_model=TradeResponse)
def add_trade(
    stock_symbol: str,
    item: TradeCreate,
    db: Session = Depends(get_db),
) -> TradeResponse:
    """
    取引を記録し、average_acquisition_price を加重平均コスト法で再計算・同期する。

    BUY: (現在総コスト + 新規購入コスト) / 新総株数 で average_acquisition_price を更新し shares_held を増加
    SELL: average_acquisition_price は据え置き、shares_held を減少（全売却時のみ 0.0 にリセット）

    Args:
        stock_symbol (str): 証券コード
        item (TradeCreate): 取引情報
        db (Session): DBセッション

    Returns:
        TradeResponse: 作成された取引レコード

    Raises:
        HTTPException: 銘柄未登録(404)、DB保存失敗(500)
    """
    db_stock = db.query(StockInTrade).filter(
        StockInTrade.stock_symbol == stock_symbol
    ).first()
    if not db_stock:
        raise HTTPException(status_code=404, detail=f"銘柄 {stock_symbol} が登録されていません")

    trade_datetime = item.trade_datetime or datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    trade = TradeHistory(
        stock_symbol=stock_symbol,
        trade_type=item.trade_type,
        quantity=item.quantity,
        price=item.price,
        trade_datetime=trade_datetime,
        note=item.note,
    )
    db.add(trade)

    current_shares = db_stock.shares_held or 0.0
    current_avg = db_stock.average_acquisition_price or 0.0

    if item.trade_type == "BUY":
        total_cost = current_avg * current_shares + item.price * item.quantity
        new_shares = current_shares + item.quantity
        db_stock.average_acquisition_price = round(total_cost / new_shares, 2) if new_shares > 0 else 0.0
        db_stock.shares_held = round(new_shares, 2)
    elif item.trade_type == "SELL":
        new_shares = max(0.0, current_shares - item.quantity)
        db_stock.shares_held = round(new_shares, 2)
        if new_shares == 0.0:
            # 全売却: average_acquisition_price と AI ロジックを同時にリセット
            db_stock.average_acquisition_price = 0.0
            db_stock.order_id = "---"
            db_stock.order_datetime = f"売却済: {trade_datetime}"
            db_stock.order_settlement_datetime = trade_datetime

    try:
        db.commit()
        db.refresh(trade)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB保存エラー: {str(e)}")

    return trade


@router.post("/api/stocks/{stock_symbol}/settle")
def settle_stock(stock_symbol: str, db: Session = Depends(get_db)) -> dict:
    """
    銘柄を全売却決済する。

    現在の shares_held と current_price で SELL 記録を作成し、
    order_id / shares_held / average_acquisition_price をリセットする。

    Args:
        stock_symbol (str): 証券コード
        db (Session): DBセッション

    Returns:
        dict: {"message": str}

    Raises:
        HTTPException: 銘柄未登録(404)
    """
    db_stock = db.query(StockInTrade).filter(
        StockInTrade.stock_symbol == stock_symbol
    ).first()
    if not db_stock:
        raise HTTPException(status_code=404, detail=f"銘柄 {stock_symbol} が登録されていません")

    now = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    shares = db_stock.shares_held or 0.0
    price = db_stock.current_price or 0.0

    if shares > 0:
        trade = TradeHistory(
            stock_symbol=stock_symbol,
            trade_type="SELL",
            quantity=shares,
            price=price,
            trade_datetime=now,
            note="手動決済",
        )
        db.add(trade)

    db_stock.order_id = "---"
    db_stock.order_datetime = f"売却済: {now}"
    db_stock.order_settlement_datetime = now
    db_stock.shares_held = 0.0
    db_stock.average_acquisition_price = 0.0

    db.commit()
    return {"message": f"{stock_symbol} を決済しました"}
