# Frontend Test Suite

テストはこのディレクトリに集約されます。

## ディレクトリ構成

```
__tests__/
├── page.test.tsx                # ページコンポーネント
├── components.test.tsx          # (Phase 2) UI コンポーネント
├── hooks.test.ts                # (Phase 3) Custom Hooks
└── integration.test.tsx         # (Phase 3) ユーザーフロー
```

## 実行方法

### 全テスト実行
```bash
cd frontend
npm test
```

### Watch モード（開発時）
```bash
npm run test:watch
```

### カバレッジレポート
```bash
npm test -- --coverage
```

## 命名規則

- **テストファイル**: `<対象>.test.tsx` または `<対象>.test.ts`
- **テストケース**: `it('should ...')` で記述

例:
```typescript
// __tests__/page.test.tsx
describe('Home Page', () => {
  it('should render main title', () => {
    render(<Home />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })
})
```

## Jest Setup

- **jest.config.js**: Next.js 統合設定
- **jest.setup.js**: テスト環境初期化（@testing-library/jest-dom ロード）

## Mock について

`__mocks__/` ディレクトリで API/Hook の mock を集約（Phase 2 以降）：

```
__tests__/
├── __mocks__/
│   ├── hooks.ts           # useStocks のモック
│   └── api.ts             # Backend API のモック
└── page.test.tsx
```
