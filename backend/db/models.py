from sqlalchemy import Column, String, Float
from db.database import Base

class StockInTrade(Base):
    """自動売買対象の銘柄情報を管理するテーブルモデル。

    Attributes:
        stock_symbol (str): 証券コード（主キー）。
        stock_name (str): 企業名。
        order_id (str): 証券会社の注文ID。未発注時は '---'。
        order_datetime (str): 注文日時。未取得時は '未取得'。
        order_settlement_datetime (str): 決済日時。
        average_acquisition_price (float): 平均取得単価。
    """
    __tablename__ = "stocks_in_trade"

    stock_symbol = Column(String, primary_key=True, index=True)
    stock_name = Column(String, nullable=True)
    order_id = Column(String, default="---")
    order_datetime = Column(String, default="未取得")
    order_settlement_datetime = Column(String, default="未取得")
    average_acquisition_price = Column(Float, default=0.0)