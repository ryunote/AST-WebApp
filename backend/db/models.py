from sqlalchemy import Column, Integer, String, Float
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

    # カラム定義 銘柄の基本情報 ---
    stock_symbol = Column(String, primary_key=True, index=True)
    stock_name = Column(String, nullable=True)
    order_id = Column(String, default="---")
    order_datetime = Column(String, default="未取得")
    order_settlement_datetime = Column(String, default="未取得")
    average_acquisition_price = Column(Float, default=0.0)
    shares_held = Column(Float, default=0.0)
    
    # カラム定義 AI分析結果の永続化用 ---
    # 分析を行った日時
    last_analyzed_at = Column(String, nullable=True)
    
    # 現在株価（分析時点）
    current_price = Column(Float, default=0.0)
    
    # AI予測結果 ("up", "down", "unknown")
    ai_prediction = Column(String, nullable=True)
    
    # 売買提案 ("BUY", "SELL", "STAY", "WAIT", "HOLD")
    ai_suggestion = Column(String, nullable=True)


class TradeHistory(Base):
    """売買取引履歴テーブル。

    average_acquisition_price の根拠となる売買ログを保持する。
    BUY 記録時に加重平均コスト法で StockInTrade.average_acquisition_price を再計算・同期する。

    Attributes:
        id (int): 自動採番の主キー。
        stock_symbol (str): 証券コード。
        trade_type (str): 取引種別。"BUY" または "SELL"。
        quantity (float): 株数。
        price (float): 1株あたりの単価。
        trade_datetime (str): 取引日時。
        note (str): 備考（任意）。
    """
    __tablename__ = "trade_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_symbol = Column(String, nullable=False, index=True)
    trade_type = Column(String, nullable=False)  # "BUY" or "SELL"
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    trade_datetime = Column(String, nullable=False)
    note = Column(String, nullable=True)