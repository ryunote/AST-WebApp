# Backend Test Suite

テストはこのディレクトリに集約されます。

## ディレクトリ構成

```
tests/
├── conftest.py              # 全テスト共通の fixture
├── unit/                    # 単体テスト
│   ├── __init__.py
│   ├── test_main.py        # ヘルスチェック、DB接続
│   ├── test_stocks.py      # (Phase 2)
│   └── test_schemas.py     # (Phase 2)
├── integration/            # 統合テスト (Phase 3)
│   ├── test_api_contracts.py
│   └── test_ml_service.py
└── e2e/                    # E2E テスト (Phase 4)
    └── test_user_flows.py
```

## 実行方法

### 全テスト実行
```bash
cd backend
pytest tests/ -v
```

### 特定のカテゴリのみ実行
```bash
# Unit テストのみ
pytest tests/unit/ -v

# Integration テストのみ (Phase 3)
pytest tests/integration/ -v

# 特定のテストファイル
pytest tests/unit/test_main.py -v
```

### カバレッジレポート
```bash
pytest tests/ --cov=. --cov-report=html
# htmlcov/index.html で確認
```

## 命名規則

- **テストファイル**: `test_<対象モジュール>.py`
- **テスト関数**: `test_<機能>_<状態>`

例:
```python
# tests/unit/test_stocks.py
def test_create_stock_with_valid_symbol(client):
    """有効なシンボルで銘柄を作成できることを確認"""
    pass

def test_create_stock_with_invalid_symbol_raises_error(client):
    """無効なシンボルでエラーが発生することを確認"""
    pass
```

## Fixture について

`conftest.py` で以下が定義されています：

- **db_engine** (session scope): テスト用 SQLite インメモリDB
- **db_session** (function scope): 各テスト毎にロールバック対応のセッション
- **client** (function scope): FastAPI TestClient（DB 依存性注入済み）

例:
```python
def test_api_endpoint(client):
    """client fixture を使用"""
    response = client.get("/stocks")
    assert response.status_code == 200

def test_db_operation(db_session):
    """db_session fixture を使用"""
    result = db_session.query(Stock).all()
    assert len(result) == 0
```
