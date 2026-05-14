/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import StockInputForm from '@/components/StockInputForm'
import { StockActionResult } from '@/types'

// ─── ヘルパー ────────────────────────────────────────────────────────────────

const SUCCESS_RESULT: StockActionResult = { success: true, message: '7203.T を登録しました。' }
const ERROR_RESULT: StockActionResult = { success: false, message: '銘柄が見つかりません。' }

function makeProps(overrides: Partial<Parameters<typeof StockInputForm>[0]> = {}) {
  return {
    onAdd: jest.fn().mockResolvedValue(SUCCESS_RESULT),
    onDelete: jest.fn().mockResolvedValue(SUCCESS_RESULT),
    onSettle: jest.fn().mockResolvedValue(SUCCESS_RESULT),
    onLog: jest.fn(),
    ...overrides,
  }
}

// ─── レンダリング ─────────────────────────────────────────────────────────────

describe('StockInputForm - レンダリング', () => {
  it('入力フィールドと3つのボタンが存在すること', () => {
    render(<StockInputForm {...makeProps()} />)
    expect(screen.getByPlaceholderText('7203')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '追加' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '手動決済' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '削除' })).toBeInTheDocument()
  })
})

// ─── バリデーション ──────────────────────────────────────────────────────────

describe('StockInputForm - バリデーション', () => {
  it('空入力で追加ボタンを押すとエラーメッセージが表示されること', async () => {
    render(<StockInputForm {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => {
      expect(screen.getByText('証券コードを入力してください。')).toBeInTheDocument()
    })
  })

  it('英字入力で追加ボタンを押すと数字入力要求エラーが表示されること', async () => {
    render(<StockInputForm {...makeProps()} />)
    fireEvent.change(screen.getByPlaceholderText('7203'), { target: { value: 'AAPL' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => {
      expect(screen.getByText('証券コードは半角数字で入力してください。')).toBeInTheDocument()
    })
  })

  it('バリデーション失敗時は onAdd が呼ばれないこと', async () => {
    const onAdd = jest.fn()
    render(<StockInputForm {...makeProps({ onAdd })} />)
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => screen.getByText('証券コードを入力してください。'))
    expect(onAdd).not.toHaveBeenCalled()
  })
})

// ─── 正常系 ──────────────────────────────────────────────────────────────────

describe('StockInputForm - 正常系', () => {
  it('4桁数字コード入力で onAdd が ".T" サフィックス付きで呼ばれること', async () => {
    const onAdd = jest.fn().mockResolvedValue(SUCCESS_RESULT)
    render(<StockInputForm {...makeProps({ onAdd })} />)
    fireEvent.change(screen.getByPlaceholderText('7203'), { target: { value: '7203' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('7203.T'))
  })

  it('登録成功後に入力フィールドがクリアされること', async () => {
    render(<StockInputForm {...makeProps()} />)
    const input = screen.getByPlaceholderText('7203')
    fireEvent.change(input, { target: { value: '7203' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => expect(input).toHaveValue(''))
  })

  it('登録成功時に onLog がリクエスト開始・結果の2回呼ばれること', async () => {
    const onLog = jest.fn()
    render(<StockInputForm {...makeProps({ onLog })} />)
    fireEvent.change(screen.getByPlaceholderText('7203'), { target: { value: '7203' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => expect(onLog).toHaveBeenCalledTimes(2))
  })

  it('登録成功メッセージが画面に表示されること', async () => {
    render(<StockInputForm {...makeProps()} />)
    fireEvent.change(screen.getByPlaceholderText('7203'), { target: { value: '7203' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => {
      expect(screen.getByText('7203.T を登録しました。')).toBeInTheDocument()
    })
  })
})

// ─── エラー表示 ───────────────────────────────────────────────────────────────

describe('StockInputForm - API エラー表示', () => {
  it('API 失敗時にエラーメッセージが表示されること', async () => {
    const onAdd = jest.fn().mockResolvedValue(ERROR_RESULT)
    render(<StockInputForm {...makeProps({ onAdd })} />)
    fireEvent.change(screen.getByPlaceholderText('7203'), { target: { value: '7203' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => {
      expect(screen.getByText('銘柄が見つかりません。')).toBeInTheDocument()
    })
  })

  it('API 失敗時は入力フィールドがクリアされないこと', async () => {
    const onAdd = jest.fn().mockResolvedValue(ERROR_RESULT)
    render(<StockInputForm {...makeProps({ onAdd })} />)
    const input = screen.getByPlaceholderText('7203')
    fireEvent.change(input, { target: { value: '7203' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalled())
    expect(input).toHaveValue('7203')
  })
})
