"""
分析API のビジネスロジック網羅テスト。
httpx の AsyncClient をモックして ML Service との通信を切り離し、
保有状態 × ML予測 の全組み合わせと外部エラーハンドリングを検証する。
"""

import pytest
import httpx
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock, MagicMock

from db.models import StockInTrade


# ─── ヘルパー ────────────────────────────────────────────────────────────────

def _insert_stock(
    db_session,
    symbol: str = "7203",
    order_id: str = "---",
    order_datetime: str = "未取得",
):
    stock = StockInTrade(
        stock_symbol=symbol,
        stock_name="テスト株式会社",
        order_id=order_id,
        order_datetime=order_datetime,
    )
    db_session.add(stock)
    db_session.commit()
    return stock


def _make_ml_mock(prediction: str, current_price: float = 1500.0):
    """
    httpx.AsyncClient() のコンテキストマネージャをモックする。
    analysis.py の `async with httpx.AsyncClient() as client:` パターンに対応。
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"prediction": prediction, "current_price": current_price}

    mock_http = AsyncMock()
    mock_http.get = AsyncMock(return_value=mock_resp)

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_http)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_cm


def _make_ml_error_response_mock(status: int = 500):
    """ML Service がエラーステータスを返すケースのモック"""
    mock_resp = MagicMock()
    mock_resp.status_code = status
    mock_resp.text = "Internal Server Error"

    mock_http = AsyncMock()
    mock_http.get = AsyncMock(return_value=mock_resp)

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_http)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_cm


def _make_ml_connection_error_mock():
    """ML Service への接続が失敗するケースのモック"""
    mock_http = AsyncMock()
    mock_http.get = AsyncMock(
        side_effect=httpx.RequestError("connection failed", request=MagicMock())
    )

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_http)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_cm


# ─── 前提条件: 銘柄未登録 ───────────────────────────────────────────────────

def test_stock_not_registered_returns_404(client, db_session):
    """DBに未登録の銘柄の分析リクエストは404を返すこと"""
    response = client.get("/api/analysis/NOTEXIST")
    assert response.status_code == 404


# ─── 売買判断ロジック: 未保有（order_id == '---'）────────────────────────────

class TestBuyDecision:
    def test_up_prediction_returns_buy(self, client, db_session):
        """未保有 + 上昇予測 → BUY"""
        _insert_stock(db_session, "7203", order_id="---")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("up")):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 200
        body = response.json()
        assert body["suggestion"] == "BUY"
        assert body["prediction"] == "up"

    def test_down_prediction_returns_stay(self, client, db_session):
        """未保有 + 下落予測 → STAY"""
        _insert_stock(db_session, "7203", order_id="---")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("down")):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 200
        assert response.json()["suggestion"] == "STAY"

    def test_unknown_prediction_returns_stay(self, client, db_session):
        """未保有 + unknown予測 → STAY"""
        _insert_stock(db_session, "7203", order_id="---")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("unknown")):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 200
        assert response.json()["suggestion"] == "STAY"


# ─── 売買判断ロジック: 保有中（order_id != '---'）───────────────────────────

class TestSellDecision:
    def test_down_prediction_returns_sell(self, client, db_session):
        """保有中 + 下落予測 → SELL"""
        _insert_stock(db_session, "7203", order_id="ORDER001")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("down")):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 200
        assert response.json()["suggestion"] == "SELL"

    def test_up_prediction_returns_hold(self, client, db_session):
        """保有中 + 上昇予測 → HOLD"""
        _insert_stock(db_session, "7203", order_id="ORDER001")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("up")):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 200
        assert response.json()["suggestion"] == "HOLD"


# ─── 再購入禁止期間ロジック ──────────────────────────────────────────────────

class TestRepurchaseProhibition:
    def test_within_3_days_returns_wait(self, client, db_session):
        """売却済み1日後 + 上昇予測 → WAIT（禁止期間3日以内）"""
        sold_time = (datetime.now() - timedelta(days=1)).strftime("%Y/%m/%d %H:%M:%S")
        _insert_stock(db_session, "7203", order_id="---", order_datetime=f"売却済: {sold_time}")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("up")):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 200
        assert response.json()["suggestion"] == "WAIT"

    def test_after_3_days_returns_buy(self, client, db_session):
        """売却済み4日後 + 上昇予測 → BUY（禁止期間外）"""
        sold_time = (datetime.now() - timedelta(days=4)).strftime("%Y/%m/%d %H:%M:%S")
        _insert_stock(db_session, "7203", order_id="---", order_datetime=f"売却済: {sold_time}")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("up")):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 200
        assert response.json()["suggestion"] == "BUY"

    def test_within_3_days_down_prediction_returns_stay(self, client, db_session):
        """売却済み1日後 + 下落予測 → STAY（禁止期間内だが下落予測なのでWAITにならない）"""
        sold_time = (datetime.now() - timedelta(days=1)).strftime("%Y/%m/%d %H:%M:%S")
        _insert_stock(db_session, "7203", order_id="---", order_datetime=f"売却済: {sold_time}")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("down")):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 200
        # 下落予測 → STAY（禁止期間チェックはupの場合のみ発動する）
        assert response.json()["suggestion"] == "STAY"


# ─── 外部依存エラーハンドリング ──────────────────────────────────────────────

class TestMLServiceErrors:
    def test_connection_error_returns_503(self, client, db_session):
        """ML Service が応答しない場合は503を返すこと"""
        _insert_stock(db_session, "7203")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_connection_error_mock()):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 503

    def test_error_status_response_returns_500(self, client, db_session):
        """ML Service がエラーステータスを返す場合は500を返すこと"""
        _insert_stock(db_session, "7203")
        with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_error_response_mock(500)):
            response = client.get("/api/analysis/7203")
        assert response.status_code == 500


# ─── レスポンスの値の正当性 ──────────────────────────────────────────────────

def test_response_contains_required_fields(client, db_session):
    """レスポンスに必須フィールドが全て含まれること"""
    _insert_stock(db_session, "7203", order_id="---")
    with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("up", 2850.0)):
        response = client.get("/api/analysis/7203")

    assert response.status_code == 200
    body = response.json()
    for field in ["stock_symbol", "prediction", "suggestion", "current_price", "reason", "last_analyzed_at"]:
        assert field in body, f"フィールド '{field}' がレスポンスに存在しない"


def test_current_price_rounded_to_2_decimal_places(client, db_session):
    """current_price は浮動小数点誤差対策で小数点第2位に丸められること"""
    _insert_stock(db_session, "7203")
    with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("up", 1500.123456789)):
        response = client.get("/api/analysis/7203")

    assert response.status_code == 200
    assert response.json()["current_price"] == round(1500.123456789, 2)


def test_stock_symbol_in_response_matches_request(client, db_session):
    """レスポンスの stock_symbol がリクエストのパスパラメータと一致すること"""
    _insert_stock(db_session, "7203")
    with patch("routers.analysis.httpx.AsyncClient", return_value=_make_ml_mock("up")):
        response = client.get("/api/analysis/7203")

    assert response.json()["stock_symbol"] == "7203"
