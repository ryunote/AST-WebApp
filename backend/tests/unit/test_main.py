"""基本的なヘルスチェック・DB接続テスト"""


def test_read_root(client):
    """GET / ヘルスチェック"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "Hello from FastAPI Backend!"


def test_db_connection(db_session):
    """DB セッション接続確認"""
    assert db_session is not None
    # セッションが有効（操作可能）であることを確認
    assert db_session.connection() is not None
