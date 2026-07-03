"""
銘柄CRUD APIの網羅的テスト。
テスト用インメモリDB（conftest.py提供）にテストデータを直接挿入し、
バリデーション・正常系・異常系をMECEに検証する。
"""

import pytest
from unittest.mock import patch, MagicMock
from db.models import StockInTrade


# ─── ヘルパー ────────────────────────────────────────────────────────────────

def _insert_stock(
    db_session,
    symbol: str = "7203",
    name: str = "テスト株式会社",
    order_id: str = "---",
    order_datetime: str = "未取得",
):
    """テストDBに直接レコードを挿入する"""
    stock = StockInTrade(
        stock_symbol=symbol,
        stock_name=name,
        order_id=order_id,
        order_datetime=order_datetime,
    )
    db_session.add(stock)
    db_session.commit()
    return stock


def _make_yf_mock(short_name: str = "テスト株式会社", price: float = 1500.0):
    """yfinance.Ticker のモックを返す"""
    mock = MagicMock()
    mock.info = {"shortName": short_name, "regularMarketPrice": price}
    return mock


# ─── GET /api/stocks ─────────────────────────────────────────────────────────

class TestListStocks:
    def test_returns_empty_list_when_no_stocks(self, client):
        """銘柄未登録時は空リストを返すこと"""
        response = client.get("/api/stocks")
        assert response.status_code == 200
        assert response.json() == []

    def test_returns_registered_stocks(self, client, db_session):
        """登録済み銘柄が一覧に含まれること"""
        _insert_stock(db_session, "7203", "トヨタ自動車")
        _insert_stock(db_session, "9984", "ソフトバンクグループ")

        response = client.get("/api/stocks")
        assert response.status_code == 200
        symbols = [s["stock_symbol"] for s in response.json()]
        assert "7203" in symbols
        assert "9984" in symbols

    def test_response_contains_required_fields(self, client, db_session):
        """レスポンスに必須フィールドが含まれること"""
        _insert_stock(db_session, "7203", "トヨタ自動車")

        stock = client.get("/api/stocks").json()[0]
        for field in ["stock_symbol", "stock_name", "order_id", "order_datetime"]:
            assert field in stock, f"フィールド '{field}' がレスポンスに存在しない"


# ─── POST /api/stocks ────────────────────────────────────────────────────────

class TestAddStock:
    def test_invalid_special_chars_returns_400(self, client):
        """記号を含む証券コードは400を返すこと"""
        response = client.post("/api/stocks", json={"stock_symbol": "7203!"})
        assert response.status_code == 400

    def test_invalid_too_long_returns_400(self, client):
        """7文字超の証券コードは400を返すこと（正規表現 {1,6} 違反）"""
        response = client.post("/api/stocks", json={"stock_symbol": "TOOLONG1"})
        assert response.status_code == 400

    def test_invalid_empty_returns_400(self, client):
        """空文字は400を返すこと"""
        response = client.post("/api/stocks", json={"stock_symbol": ""})
        assert response.status_code == 400

    def test_lowercase_normalized_to_uppercase(self, client):
        """小文字入力は大文字に正規化されてDBに登録されること"""
        with patch("db.crud.yf.Ticker", return_value=_make_yf_mock()):
            response = client.post("/api/stocks", json={"stock_symbol": "aapl"})

        assert response.status_code == 200
        # "aapl" → "AAPL" に正規化されていること
        assert response.json()["data"]["stock_symbol"] == "AAPL"

    def test_duplicate_registration_returns_400(self, client, db_session):
        """同一コードの2回目登録は400かつ「既に登録」メッセージを返すこと"""
        _insert_stock(db_session, "7203")
        response = client.post("/api/stocks", json={"stock_symbol": "7203"})
        assert response.status_code == 400
        assert "既に登録" in response.json()["detail"]

    def test_yfinance_returns_no_data_returns_400(self, client):
        """yfinanceが情報を返さない銘柄は400を返すこと"""
        with patch("db.crud.yf.Ticker") as mock:
            mock.return_value.info = {}
            response = client.post("/api/stocks", json={"stock_symbol": "FAKE"})
        assert response.status_code == 400

    def test_yfinance_raises_exception_returns_400(self, client):
        """yfinance通信エラー時は400を返すこと"""
        with patch("db.crud.yf.Ticker", side_effect=Exception("network error")):
            response = client.post("/api/stocks", json={"stock_symbol": "AAPL"})
        assert response.status_code == 400

    def test_success_returns_stock_data(self, client):
        """正常登録時にDBレコードが含まれたレスポンスを返すこと"""
        with patch("db.crud.yf.Ticker", return_value=_make_yf_mock("Apple Inc.")):
            response = client.post("/api/stocks", json={"stock_symbol": "AAPL"})

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "success"
        assert body["data"]["stock_symbol"] == "AAPL"
        assert body["data"]["stock_name"] == "Apple Inc."

    def test_success_stores_current_price(self, client):
        """正常登録時に yfinance から取得した現在株価が保存されること"""
        with patch("db.crud.yf.Ticker", return_value=_make_yf_mock("Apple Inc.", price=1500.0)):
            response = client.post("/api/stocks", json={"stock_symbol": "AAPL"})

        assert response.status_code == 200
        assert response.json()["data"]["current_price"] == 1500.0

    def test_success_visible_in_list(self, client):
        """登録後にGET /api/stocks で確認できること"""
        with patch("db.crud.yf.Ticker", return_value=_make_yf_mock()):
            client.post("/api/stocks", json={"stock_symbol": "AAPL"})

        symbols = [s["stock_symbol"] for s in client.get("/api/stocks").json()]
        assert "AAPL" in symbols

    def test_valid_japanese_stock_with_market_suffix(self, client):
        """日本株フォーマット（XXXX.T）が登録できること"""
        with patch("db.crud.yf.Ticker", return_value=_make_yf_mock("トヨタ自動車")):
            response = client.post("/api/stocks", json={"stock_symbol": "7203.T"})

        assert response.status_code == 200
        assert response.json()["data"]["stock_symbol"] == "7203.T"


# ─── DELETE /api/stocks/{symbol} ────────────────────────────────────────────

class TestDeleteStock:
    def test_not_found_returns_400(self, client):
        """未登録銘柄の削除は400を返すこと"""
        response = client.delete("/api/stocks/NOTEXIST")
        assert response.status_code == 400

    def test_held_stock_returns_400(self, client, db_session):
        """保有中（order_datetimeが注文日時）銘柄の削除は400かつ「保有中」メッセージ"""
        _insert_stock(db_session, "7203", order_datetime="2024/01/15 10:00:00")
        response = client.delete("/api/stocks/7203")
        assert response.status_code == 400
        assert "保有中" in response.json()["detail"]

    def test_unordered_stock_can_be_deleted(self, client, db_session):
        """未発注（order_datetime='未取得'）銘柄は削除可能"""
        _insert_stock(db_session, "7203", order_datetime="未取得")
        response = client.delete("/api/stocks/7203")
        assert response.status_code == 200
        assert response.json()["status"] == "success"

    def test_sold_stock_can_be_deleted(self, client, db_session):
        """売却済み（order_datetimeが '売却済' 始まり）銘柄は削除可能"""
        _insert_stock(db_session, "7203", order_datetime="売却済: 2024/01/15 10:00:00")
        response = client.delete("/api/stocks/7203")
        assert response.status_code == 200

    def test_deleted_stock_absent_from_list(self, client, db_session):
        """削除後にGET /api/stocks の結果に含まれないこと"""
        _insert_stock(db_session, "7203", order_datetime="未取得")
        client.delete("/api/stocks/7203")

        symbols = [s["stock_symbol"] for s in client.get("/api/stocks").json()]
        assert "7203" not in symbols


# ─── PUT /api/stocks/{symbol} ────────────────────────────────────────────────

class TestUpdateStock:
    def test_not_found_returns_400(self, client):
        """未登録銘柄の更新は400を返すこと"""
        response = client.put("/api/stocks/NOTEXIST", json={"order_id": "12345"})
        assert response.status_code == 400

    def test_partial_update_persists(self, client, db_session):
        """order_idのみ更新した場合、レスポンスに新しい値が反映されること"""
        _insert_stock(db_session, "7203")
        response = client.put("/api/stocks/7203", json={"order_id": "ORDER123"})
        assert response.status_code == 200
        assert response.json()["data"]["order_id"] == "ORDER123"

    def test_unset_fields_not_overwritten(self, client, db_session):
        """更新リクエストに含まないフィールドは上書きされないこと"""
        _insert_stock(db_session, "7203", name="トヨタ自動車")
        client.put("/api/stocks/7203", json={"order_id": "ORDER123"})

        stocks = client.get("/api/stocks").json()
        stock = next(s for s in stocks if s["stock_symbol"] == "7203")
        assert stock["stock_name"] == "トヨタ自動車"

    def test_update_analysis_fields(self, client, db_session):
        """AI分析結果フィールドの更新が正しく反映されること"""
        _insert_stock(db_session, "7203")
        response = client.put("/api/stocks/7203", json={
            "current_price": 2850.5,
            "ai_prediction": "up",
            "ai_suggestion": "BUY",
        })

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["current_price"] == 2850.5
        assert data["ai_prediction"] == "up"
        assert data["ai_suggestion"] == "BUY"


# ─── DB 例外ハンドリング ──────────────────────────────────────────────────────

class TestDBErrors:
    """各 CRUD 関数の except ブロックを網羅するテスト。
    db.commit() をモックして例外を発生させ、ロールバックとエラーレスポンスを検証する。
    """

    def test_create_stock_db_commit_error_returns_400(self, client, db_session):
        """create_stock で db.commit() 失敗時は400を返すこと"""
        with patch("db.crud.yf.Ticker", return_value=_make_yf_mock()), \
             patch.object(db_session, "commit", side_effect=Exception("DB down")):
            response = client.post("/api/stocks", json={"stock_symbol": "AAPL"})
        assert response.status_code == 400
        assert "保存エラー" in response.json()["detail"]

    def test_delete_stock_db_commit_error_returns_400(self, client, db_session):
        """delete_stock で db.commit() 失敗時は400を返すこと"""
        _insert_stock(db_session, "7203", order_datetime="未取得")
        with patch.object(db_session, "commit", side_effect=Exception("DB down")):
            response = client.delete("/api/stocks/7203")
        assert response.status_code == 400
        assert "削除処理中" in response.json()["detail"]

    def test_update_stock_db_commit_error_returns_400(self, client, db_session):
        """update_stock で db.commit() 失敗時は400を返すこと"""
        _insert_stock(db_session, "7203")
        with patch.object(db_session, "commit", side_effect=Exception("DB down")):
            response = client.put("/api/stocks/7203", json={"order_id": "ORDER123"})
        assert response.status_code == 400
        assert "更新中" in response.json()["detail"]

    def test_update_stock_pydantic_v1_fallback(self, db_session):
        """model_dump() が AttributeError を投げる場合、dict() フォールバックが動作すること
        (Pydantic V1 互換性ブランチ)"""
        from db.crud import update_stock
        _insert_stock(db_session, "7203")

        mock_update = MagicMock()
        mock_update.model_dump.side_effect = AttributeError("Pydantic V1 env")
        mock_update.dict.return_value = {"order_id": "ORDER_V1"}

        result = update_stock(db_session, "7203", mock_update)
        assert result["status"] == "success"
        assert result["data"].order_id == "ORDER_V1"
