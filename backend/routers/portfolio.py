"""
Portfolio Router
================

ポートフォリオ集計エンドポイント。
shares_held > 0 の銘柄を対象に、総評価額・含み損益・銘柄別配分を返す。
"""

from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import StockInTrade
from schemas import PortfolioHolding, PortfolioResponse

router = APIRouter()


@router.get("/api/portfolio", response_model=PortfolioResponse)
def get_portfolio(db: Session = Depends(get_db)) -> PortfolioResponse:
    """
    ポートフォリオの現在評価額を集計して返す。

    shares_held > 0 かつ current_price > 0 の銘柄のみを集計対象とする。
    current_price は最後に分析を実行した時点の値を使用する（リアルタイムではない）。

    Returns:
        PortfolioResponse: 銘柄別評価情報・総評価額・総含み損益・集計日時
    """
    stocks = db.query(StockInTrade).filter(StockInTrade.shares_held > 0).all()

    total_market_value = sum(
        (s.shares_held or 0) * (s.current_price or 0) for s in stocks
    )

    holdings = []
    for s in stocks:
        shares = s.shares_held or 0
        price = s.current_price or 0
        acq = s.average_acquisition_price or 0

        market_value = shares * price
        unrealized_pnl = round((price - acq) * shares, 2)
        weight = round(market_value / total_market_value * 100, 2) if total_market_value > 0 else 0.0

        holdings.append(PortfolioHolding(
            stock_symbol=s.stock_symbol,
            stock_name=s.stock_name or "",
            shares_held=shares,
            current_price=price,
            acquisition_price=acq,
            market_value=round(market_value, 2),
            unrealized_pnl=unrealized_pnl,
            weight=weight,
        ))

    return PortfolioResponse(
        holdings=holdings,
        total_market_value=round(total_market_value, 2),
        total_unrealized_pnl=round(sum(h.unrealized_pnl for h in holdings), 2),
        as_of=datetime.now().strftime("%Y/%m/%d %H:%M:%S"),
    )
