from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db import crud
from db.database import get_db
from schemas import StockCreate, StockUpdate

router = APIRouter()

@router.get("/api/stocks")
def list_stocks(db: Session = Depends(get_db)):
    """
    登録済みの監視銘柄一覧を取得する。
    """
    return crud.get_stocks(db)

@router.post("/api/stocks")
def add_stock(
    item: StockCreate,
    db: Session = Depends(get_db)
):
    """
    新しい銘柄を登録する。
    yfinanceによる実在チェックを行い、存在しない銘柄は400エラーを返す。
    """
    result = crud.create_stock(db, item.stock_symbol)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.put("/api/stocks/{stock_symbol}")
def update_stock(
    stock_symbol: str,
    item: StockUpdate,
    db: Session = Depends(get_db)
):
    """
    銘柄情報を更新する（手動決済情報の記録など）。
    """
    result = crud.update_stock(db, stock_symbol, item)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.delete("/api/stocks/{stock_symbol}")
def remove_stock(stock_symbol: str, db: Session = Depends(get_db)):
    """
    銘柄を削除する。
    保有中（未決済）の銘柄は削除できない。
    """
    result = crud.delete_stock(db, stock_symbol)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result