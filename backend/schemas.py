from pydantic import BaseModel, ConfigDict
from typing import Optional

# ------------------------------------------------------------------
# 銘柄管理 (CRUD) 用スキーマ
# ------------------------------------------------------------------

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
    
    # 分析結果の永続化用フィールド
    last_analyzed_at: Optional[str] = None
    current_price: Optional[float] = None
    ai_prediction: Optional[str] = None
    ai_suggestion: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

# ------------------------------------------------------------------
# 分析・シミュレーション用スキーマ
# ------------------------------------------------------------------

class StockAnalysisResult(BaseModel):
    """
    銘柄の分析結果・売買提案を表すモデル。
    """
    stock_symbol: str
    prediction: str         # "up" (上昇予測) or "down" (下落予測) or "unknown"
    suggestion: str         # "BUY", "SELL", "STAY", "WAIT", "HOLD"
    current_price: float    # 現在株価
    reason: str             # 提案の理由（画面表示用）
    last_analyzed_at: str   # 分析実行日時刻
    
    model_config = ConfigDict(from_attributes=True)