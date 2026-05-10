# 集約型テスト構成ガイド

## 概要

プロジェクトのすべてのテストが集約型で統一されました。各サービスの tests/ ディレクトリに集約されます。

## ディレクトリ構成

```
AST-WebApp/
├── backend/
│   ├── tests/              ← 全テスト集約
│   │   ├── conftest.py
│   │   ├── unit/
│   │   ├── integration/    (Phase 3)
│   │   └── README.md
│   ├── main.py
│   └── requirements.txt    (pytest 依存)
│
├── backend-ml/
│   ├── tests/              ← 全テスト集約
│   │   ├── conftest.py
│   │   ├── unit/
│   │   └── README.md
│   ├── main.py
│   └── requirements.txt    (pytest 依存)
│
├── frontend/
│   ├── __tests__/          ← 全テスト集約
│   │   ├── page.test.tsx
│   │   └── README.md
│   ├── jest.config.js
│   ├── jest.setup.js
│   └── package.json        (jest 依存)
│
└── .github/
    └── workflows/
        ├── test.yml        (Backend 3つ + Frontend)
        └── deploy.yml
```

## ローカルテスト実行方法

### Backend Core
```bash
cd backend
pytest tests/ -v
```

### Backend-ML
```bash
cd backend-ml
pytest tests/ -v
```

### Frontend
```bash
cd frontend
npm test
```

### 全テスト実行（リポジトリルート）
```bash
# Backend Core
cd backend && pytest tests/ -v && cd ..

# Backend-ML
cd backend-ml && pytest tests/ -v && cd ..

# Frontend
cd frontend && npm test && cd ..
```

## CI/CD での実行

GitHub Actions（`.github/workflows/test.yml`）にて自動実行：
- ✅ test-backend: `pytest tests/`
- ✅ test-backend-ml: `pytest tests/`
- ✅ test-frontend: `npm test`

すべての CI チェックが SUCCESS の場合のみ、main ブランチへのマージが可能。

## 各サービスの詳細ガイド

### Backend
→ `backend/tests/README.md` を参照

### Backend-ML
→ `backend-ml/tests/README.md` を参照

### Frontend
→ `frontend/__tests__/README.md` を参照

## Phase 別の拡張計画

| Phase | Backend | Backend-ML | Frontend |
|:---|:---|:---|:---|
| **2** | unit テスト充実 | unit テスト充実 | jest 初期化 |
| **3** | integration テスト | integration テスト | component テスト |
| **4** | e2e テスト | - | e2e (Playwright) |
| **5** | カバレッジ要件化 | - | coverage report |

---

## トラブルシューティング

### Q. CI が通らない場合
**A.** ローカルで以下を実行して、同じエラーが出るか確認：
```bash
# Backend
cd backend && pytest tests/ -v

# Backend-ML
cd backend-ml && pytest tests/ -v

# Frontend
cd frontend && npm test
```

### Q. インポートパスエラーが出る場合
**A.** `conftest.py` で `sys.path.insert()` を行っているので、他のテストでもパスが正しいか確認。必要に応じて pytest.ini を作成：

```ini
[pytest]
pythonpath = .
testpaths = tests
python_files = test_*.py
```

### Q. fixture が見つからないエラー
**A.** conftest.py が `tests/` ディレクトリのルート（各サービス直下）にあるか確認：
```bash
ls -la backend/tests/conftest.py
ls -la backend-ml/tests/conftest.py
```

---

## メリット（集約型採用による効果）

| 効果 | 詳細 |
|:---|:---|
| **運用効率** | CI/CD で `pytest tests/` 一発で全テスト実行 |
| **可視化** | 各サービスの `tests/` を見れば全テスト一覧 |
| **拡張性** | Phase 3 以降の integration/e2e テスト追加が直感的 |
| **チーム** | オンボーディング時に「tests/ に全テストがある」で明確 |

