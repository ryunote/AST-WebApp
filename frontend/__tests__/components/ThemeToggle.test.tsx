/**
 * @jest-environment jsdom
 *
 * ThemeToggle コンポーネントのユニットテスト。
 *
 * テスト対象の分岐:
 *   - theme === "dark"   → 月アイコン表示 / ライトモードに切り替え
 *   - theme !== "dark"   → 太陽アイコン表示 / ダークモードに切り替え
 *   - クリック時の setTheme 呼び出し先
 *
 * 注: !mounted ブランチ（SSR Hydration Mismatch 防止用の placeholder div）は
 * jsdom 環境では useEffect が同期実行されるため到達不能。
 * これは意図的なトレードオフであり、SSR 挙動は E2E テストで担保する。
 *
 * next-themes の useTheme はモック化してネットワーク不要で検証する。
 */

jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from 'next-themes'

const mockUseTheme = jest.mocked(useTheme)

function setupTheme(theme: string) {
  const setTheme = jest.fn()
  mockUseTheme.mockReturnValue({ theme, setTheme } as unknown as ReturnType<typeof useTheme>)
  return setTheme
}

beforeEach(() => {
  mockUseTheme.mockReset()
})

// ─── ライトモード ─────────────────────────────────────────────────────────────

describe('ThemeToggle - ライトモード', () => {
  it('テーマ切り替えボタンが存在すること', () => {
    setupTheme('light')
    render(<ThemeToggle />)
    expect(screen.getByRole('button', { name: 'テーマを切り替える' })).toBeInTheDocument()
  })

  it('title が「ダークモードに切り替え」であること', () => {
    setupTheme('light')
    render(<ThemeToggle />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'ダークモードに切り替え')
  })

  it('クリックすると setTheme("dark") が呼ばれること', () => {
    const setTheme = setupTheme('light')
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })
})

// ─── ダークモード ─────────────────────────────────────────────────────────────

describe('ThemeToggle - ダークモード', () => {
  it('title が「ライトモードに切り替え」であること', () => {
    setupTheme('dark')
    render(<ThemeToggle />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'ライトモードに切り替え')
  })

  it('クリックすると setTheme("light") が呼ばれること', () => {
    const setTheme = setupTheme('dark')
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
