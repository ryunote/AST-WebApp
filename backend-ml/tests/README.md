# Backend-ML Test Suite

テストはこのディレクトリに集約されます。

## ディレクトリ構成

```
tests/
├── conftest.py              # 全テスト共通の fixture
├── unit/                    # 単体テスト
│   ├── __init__.py
│   ├── test_main.py        # ヘルスチェック
│   ├── test_market_data.py # (Phase 2) データ取得
│   └── test_ml_engine.py   # (Phase 2) ML エンジン
└── integration/            # 統合テスト (Phase 3)
    └── test_prediction.py  # Backend Core との契約テスト
```

## 実行方法

### 全テスト実行
```bash
cd backend-ml
pytest tests/ -v
```

### 特定のカテゴリのみ実行
```bash
# Unit テストのみ
pytest tests/unit/ -v

# Integration テストのみ (Phase 3)
pytest tests/integration/ -v
```

### カバレッジレポート
```bash
pytest tests/ --cov=services --cov-report=html
```

## 命名規則

- **テストファイル**: `test_<対象モジュール>.py`
- **テスト関数**: `test_<機能>_<状態>`

例:
```python
# tests/unit/test_market_data.py
def test_fetch_historical_data_returns_valid_dataframe(client):
    """有効なデータフレームが返されることを確認"""
    pass

def test_fetch_historical_data_invalid_symbol_raises_error(client):
    """無効なシンボルでエラーが発生することを確認"""
    pass
```

## Fixture について

`conftest.py` で以下が定義されています：

- **client** (function scope): FastAPI TestClient

例:
```python
def test_health_check(client):
    """client fixture を使用"""
    response = client.get("/health")
    assert response.status_code == 200
```
