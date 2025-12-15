from pydantic import BaseModel
from typing import Optional

class StockCreate(BaseModel):
    """銘柄登録時のリクエストボディ定義"""
    stock_symbol: str

class StockUpdate(BaseModel):
    """
    銘柄情報の更新用リクエストボディ定義。
    注文状態や価格など、更新したいフィールドのみを受け取る。
    """
    order_id: Optional[str] = None
    order_datetime: Optional[str] = None
    order_settlement_datetime: Optional[str] = None
    average_acquisition_price: Optional[float] = None
    
    class Config:
        orm_mode = True