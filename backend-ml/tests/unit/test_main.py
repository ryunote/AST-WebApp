"""ML Service ヘルスチェック・基本テスト"""


def test_health_check(client):
    """GET /health ヘルスチェック"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "ml-service"
