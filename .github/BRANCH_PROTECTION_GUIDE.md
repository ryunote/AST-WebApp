# Branch Protection Rules ガイド

このドキュメントは、GitHub リポジトリの `main` ブランチに対して、自動テスト（CI）を必須化するための設定手順です。

## 概要

CI/CD パイプラインが整備されたため、以下のルールを設定することで、**テストに失敗した PR のマージを禁止**できます。

| 項目 | 効果 |
|:---|:---|
| **Require status checks to pass before merging** | CI 実行結果が SUCCESS 以外ではマージ不可 |
| **Require code reviews** | 最低1名のレビュー承認が必要 |
| **Dismiss stale pull request approvals** | PR に新しいコミットがあれば既存の承認を無効化 |

---

## GitHub UI での設定手順

### 1. リポジトリの Settings ページを開く
- GitHub → リポジトリ → **Settings** → **Branches**

### 2. "Add rule" をクリック

### 3. Branch name pattern を入力
```
main
```

### 4. Require status checks to pass before merging
✅ **有効化** する

#### 4-1. 必須の status checks を追加
以下のチェックをすべて選択：
- `test-backend` (Test Suite ワークフロー)
- `test-frontend` (Test Suite ワークフロー)

```
Require branches to be up to date before merging ✅ (推奨)
  → PR がマージ前に main の最新を取り込むことを強制
```

### 5. Require code reviews
✅ **有効化** する
- **Required number of reviews**: `1`
- ✅ **Dismiss stale pull request approvals**
- ✅ **Require review from code owners** （CODEOWNERS ファイル設定後）

### 6. Require status checks to pass before merging
✅ 有効化（既に 4. で設定）

### 7. Save changes をクリック

---

## CLI での設定（GitHub CLI を使用する場合）

```bash
# リポジトリのルートで実行

# 保護ルールを追加
gh api repos/{owner}/{repo}/branches/main/protection \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "test-backend",
      "test-frontend"
    ]
  },
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "enforce_admins": false,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

---

## 確認方法

### Web UI での確認
1. **Settings** → **Branches** → **Branch protection rules**
2. **main** ルールをクリック
3. 以下が表示されているか確認：
   - ✅ Require status checks to pass
   - ✅ Status checks (test-backend, test-frontend)
   - ✅ Require code reviews
   - ✅ Require branch to be up to date

### CLI での確認
```bash
gh api repos/{owner}/{repo}/branches/main/protection
```

---

## ルール適用の流れ

```
1. 開発者が feature ブランチでコミット
   ↓
2. GitHub に push → PR 作成
   ↓
3. GitHub Actions 自動実行
   ├─ test-backend: ✅ (pytest 実行)
   ├─ test-frontend: ✅ (jest 実行)
   └─ build: ✅ (ビルド成功確認)
   ↓
4. CI SUCCESS → "Ready for review" 状態
   ↓
5. コードレビュー (最低1名)
   ↓
6. Review Approved + すべての CI パス
   ↓
7. Merge to main ✅ (可能)
```

---

## よくある質問

### Q. CI が失敗しているのに、マージボタンが出ている
**A.** ルール設定が反映されるまで最大数分かかります。リポジトリをリロードしてください。

### Q. Admin override したい（やむを得ない場合）
**A.** Settings → Branches で `Restrict who can push to matching branches` を無効化している限り、Admin はマージ可能です。ただし、**監査ログに記録される**ため、本番運用ではこの操作は避けてください。

### Q. マージ前にローカルテストを実行すべき？
**A.** **はい。推奨**します。CI は自動ゲートですが、開発者自身が `pytest` / `npm test` を先に実行すれば、無駄な CI 実行を減らせます。

```bash
# マージ前にローカルで実行
cd backend && pytest
cd frontend && npm test
```

### Q. emergency branch（例：hotfix）はルール外にしたい
**A.** Settings → Branches で複数の保護ルールを作成可能です。
- Rule 1: `main` → 厳密なチェック
- Rule 2: `hotfix/*` → チェック軽減 or なし

---

## Phase 2 以降の拡張

| 拡張項目 | 時期 | 内容 |
|:---|:---|:---|
| **Coverage Requirements** | Week 6-7 | `--cov-fail-under=70` で最小カバレッジを強制 |
| **Performance Benchmarks** | Week 8 | `k6` ベースラインとの比較テスト |
| **Semantic PR Titles** | Week 5 | PR title に conventional commit を強制 |
| **Automatic Changelog** | Week 9 | マージ時に CHANGELOG.md を自動生成 |

