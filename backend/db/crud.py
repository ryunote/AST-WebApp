from typing import Dict, Any, List
from sqlalchemy.orm import Session
import yfinance as yf

# 相対インポート
from .models import StockInTrade
# スキーマ（型定義）のインポート。パス解決のため親ディレクトリからのインポートになる点に注意
# main.py から実行されるため、backendディレクトリがパスに含まれる前提
from schemas import StockUpdate

def get_stocks(db: Session) -> List[StockInTrade]:
    """
    登録されている全ての監視銘柄を取得する。
    証券コード順（昇順）でソートして返却する。
    """
    return db.query(StockInTrade).order_by(StockInTrade.stock_symbol).all()


def create_stock(db: Session, stock_symbol: str) -> Dict[str, Any]:
    """
    新しい銘柄を監視リストに登録する。
    """
    # 既に登録済みかチェック
    existing_stock = db.query(StockInTrade).filter(StockInTrade.stock_symbol == stock_symbol).first()
    if existing_stock:
        return {
            "status": "error", 
            "message": f"証券番号 {stock_symbol} は既に登録されています。"
        }

    # yfinanceを使用して銘柄情報を取得
    stock_name = "名称不明"
    try:
        ticker = yf.Ticker(f"{stock_symbol}.T")
        info = ticker.info
        stock_name = info.get('shortName') or info.get('longName') or "名称不明"
    except Exception as e:
        print(f"[Warning] Failed to fetch stock name for {stock_symbol}: {e}")

    # 新規レコード作成
    new_stock = StockInTrade(
        stock_symbol=stock_symbol, 
        stock_name=stock_name
    )
    
    try:
        db.add(new_stock)
        db.commit()
        db.refresh(new_stock)
        return {
            "status": "success", 
            "message": f"{stock_name} ({stock_symbol}) を登録しました。", 
            "data": new_stock
        }
    except Exception as e:
        db.rollback()
        return {
            "status": "error", 
            "message": f"データベースへの保存中にエラーが発生しました: {str(e)}"
        }


def delete_stock(db: Session, stock_symbol: str) -> Dict[str, Any]:
    """
    指定された銘柄を削除する。
    """
    stock = db.query(StockInTrade).filter(StockInTrade.stock_symbol == stock_symbol).first()
    
    if not stock:
        return {"status": "error", "message": "指定された銘柄が見つかりません。"}
    
    # 削除可否の判定ロジック
    is_deletable = (stock.order_datetime == "未取得") or ("売却済" in str(stock.order_datetime))

    if is_deletable:
        try:
            db.delete(stock)
            db.commit()
            return {"status": "success", "message": f"{stock_symbol} を削除しました。"}
        except Exception as e:
            db.rollback()
            return {"status": "error", "message": f"削除処理中にエラーが発生しました: {str(e)}"}
    else:
        return {
            "status": "error", 
            "message": "現在保有中の銘柄のため削除できません。先に手動決済を行ってください。"
        }


def update_stock(db: Session, stock_symbol: str, stock_update: StockUpdate) -> Dict[str, Any]:
    """
    指定された銘柄の情報を更新する。
    主に注文状況（order_id, date, price）の更新に使用される。
    """
    # 更新対象を検索
    db_stock = db.query(StockInTrade).filter(StockInTrade.stock_symbol == stock_symbol).first()
    
    if not db_stock:
        return {
            "status": "error",
            "message": f"証券番号 {stock_symbol} が見つかりません。"
        }

    # リクエストに含まれているフィールドのみを更新する (PATCH相当の処理)
    # Pydantic v2: model_dump(exclude_unset=True) を使用推奨だが
    # 互換性のため dict() でも動く。警告回避のため model_dump 推奨。
    try:
        # Pydantic V2
        update_data = stock_update.model_dump(exclude_unset=True)
    except AttributeError:
        # Pydantic V1 (念のためフォールバック)
        update_data = stock_update.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_stock, key, value)

    try:
        db.add(db_stock)
        db.commit()
        db.refresh(db_stock)
        return {
            "status": "success",
            "message": f"{stock_symbol} の情報を更新しました。",
            "data": db_stock
        }
    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "message": f"更新中にエラーが発生しました: {str(e)}"
        }