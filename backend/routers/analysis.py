"""
Analysis Router
===============

銘柄分析機能のエンドポイント定義です。
以下の役割を担います。
1. フロントエンドからの分析リクエストの受信
2. ML Service (Microservice) への予測計算リクエスト
3. 予測結果に基づく売買判断（ビジネスロジック）
4. 結果のデータベース保存

Microservices Architectureへの移行に伴い、計算ロジックはML Serviceへ委譲されています。
"""

import sys
from datetime import datetime
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import StockInTrade
from schemas import StockAnalysisResult

router = APIRouter()

# MLサービスの接続先URL
# Docker Compose等のサービスディスカバリ名を使用
# TODO: 環境変数から読み込むよう修正することを推奨
ML_SERVICE_URL = "http://ml-service:8000"

# 再購入禁止期間 (日)
# 短期売買による損失拡大を防ぐためのルール設定値
REPURCHASE_PROHIBITING_DAYS = 3

def check_repurchase_prohibition(stock: StockInTrade) -> bool:
    """
    売却済みの銘柄が再購入禁止期間内かどうかを判定します。

    Args:
        stock (StockInTrade): DBから取得した銘柄モデルインスタンス

    Returns:
        bool: 禁止期間内であれば True、それ以外は False
    """
    # 注文日時情報がない、または「売却済」ステータスでない場合はチェック不要
    if not stock.order_datetime or not str(stock.order_datetime).startswith('売却済:'):
        return False

    try:
        # 文字列 "売却済: YYYY/MM/DD HH:MM:SS" から日時を抽出
        sold_time_str = stock.order_datetime.split('売却済: ')[1]
        sold_datetime = datetime.strptime(sold_time_str, "%Y/%m/%d %H:%M:%S")
        
        # 経過日数を計算
        delta = datetime.now() - sold_datetime
        return delta.days < REPURCHASE_PROHIBITING_DAYS
    except (IndexError, ValueError):
        # フォーマット異常等の場合は安全側に倒してFalse（禁止しない）とする
        return False

@router.get("/api/analysis/{stock_symbol}", response_model=StockAnalysisResult)
async def analyze_stock(stock_symbol: str, db: Session = Depends(get_db)) -> StockAnalysisResult:
    """
    指定銘柄の分析を実行し、結果を保存します。
    
    ML Serviceと連携して予測値を取得し、現在の保有状況と組み合わせて
    最終的な投資判断（BUY/SELL/WAIT/STAY/HOLD）を決定します。

    Args:
        stock_symbol (str): 証券コード
        db (Session): データベースセッション

    Returns:
        StockAnalysisResult: 分析結果および売買提案を含むレスポンスモデル

    Raises:
        HTTPException(404): 銘柄がDBに未登録の場合
        HTTPException(503): ML Serviceへの接続に失敗した場合
        HTTPException(500): ML Serviceからのエラー応答またはDB保存エラー
    """
    print(f"--- [Analysis Start (Microservices)] {stock_symbol} ---", file=sys.stdout)
    
    # 1. DBから銘柄情報を取得（保有状態の確認のため必要）
    db_stock = db.query(StockInTrade).filter(StockInTrade.stock_symbol == stock_symbol).first()
    
    if not db_stock:
        raise HTTPException(status_code=404, detail="銘柄が登録されていません。")

    # 2. ML Service へのリクエスト (非同期通信)
    prediction = "unknown"
    current_price = 0.0

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ML_SERVICE_URL}/predict/{stock_symbol}", timeout=20.0)
            
            if resp.status_code != 200:
                print(f"[Error] ML Service returned {resp.status_code}: {resp.text}", file=sys.stderr)
                raise HTTPException(status_code=500, detail=f"ML Service Error: {resp.text}")
            
            data = resp.json()
            prediction = data["prediction"]
            
            # 【修正点】 受け取った値を丸める
            # 日本株(東証)は0.1円単位が基本のため、
            # 安全をとって「小数点第2位」で丸める。
            raw_price = data["current_price"]
            current_price = round(raw_price, 2)
            
            print(f"[Info] ML Service Result: {data} -> Rounded Price: {current_price}", file=sys.stdout)

    except httpx.RequestError as exc:
        print(f"[Error] Failed to connect to ML Service: {exc}", file=sys.stderr)
        raise HTTPException(status_code=503, detail="分析サービスに接続できませんでした。")

    # 3. 売買判断ロジック (Business Logic)
    # MLの予測結果(prediction)と現在の保有状況(db_stock.order_id)を組み合わせて判断
    suggestion = "STAY"
    reason = "判断保留"

    if db_stock.order_id == '---': # 未保有（新規購入検討）
        if prediction == "up":
            if check_repurchase_prohibition(db_stock):
                suggestion = "WAIT"
                reason = "AI上昇予測ですが、再購入禁止期間中のため待機推奨。"
            else:
                suggestion = "BUY"
                reason = "AI上昇予測。新規購入を提案。"
        else:
            suggestion = "STAY"
            reason = "AI下落または横ばい予測。"
    else: # 保有中（決済検討）
        if prediction == "down":
            suggestion = "SELL"
            reason = "AI下落予測。決済を提案。"
        else:
            suggestion = "HOLD"
            reason = "AI上昇継続予測。保有継続を提案。"

    # 4. 結果をDBに保存 (Persistence)
    now_str = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
    
    # モデルのフィールドを更新
    db_stock.current_price = current_price
    db_stock.ai_prediction = prediction
    db_stock.ai_suggestion = suggestion
    db_stock.last_analyzed_at = now_str
    
    try:
        db.add(db_stock)
        db.commit()
        db.refresh(db_stock)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB保存エラー: {str(e)}")

    return StockAnalysisResult(
        stock_symbol=stock_symbol,
        prediction=prediction,
        suggestion=suggestion,
        current_price=current_price,
        reason=reason,
        last_analyzed_at=now_str
    )