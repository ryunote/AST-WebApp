/**
 * @jest-environment jsdom
 *
 * AnalysisPanel コンポーネントのユニットテスト。
 *
 * テスト対象の分岐:
 *   - ボタン disabled/enabled (stocks.length === 0 / isAnalyzing)
 *   - 正常分析フロー: onLog の各メッセージ / onAnalysisComplete 呼び出し
 *   - current_price の toFixed(1) フォーマット
 *   - エラーハンドリング: catch 分岐 / エラー後も onAnalysisComplete が呼ばれること
 *   - 複数銘柄の全件処理
 *   - 分析中の UI 状態 (ボタンテキスト / プログレスバー)
 *
 * apiClient は jest.mock でモック化し、ネットワーク通信なしで検証する。
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import AnalysisPanel from '@/components/AnalysisPanel'
import { StockInTrade } from '@/types'

jest.mock('@/lib/api')
import { apiClient } from '@/lib/api'
const mockApiClient = jest.mocked(apiClient)

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function makeStock(symbol = '7203.T'): StockInTrade {
  return {
    stock_symbol: symbol,
    stock_name: 'テスト株式会社',
    order_id: '---',
    order_datetime: '未取得',
    order_settlement_datetime: '',
    average_acquisition_price: 0,
  }
}

function makeProps(stocks: StockInTrade[], overrides: Record<string, unknown> = {}) {
  return {
    stocks,
    onAnalysisComplete: jest.fn(),
    onLog: jest.fn(),
    ...overrides,
  }
}

function makeApiResult(overrides: Record<string, unknown> = {}) {
  return { prediction: 'up', suggestion: 'BUY', current_price: 2850.0, ...overrides }
}

beforeEach(() => {
  mockApiClient.mockReset()
})

// ─── 初期状態 ────────────────────────────────────────────────────────────────

describe('AnalysisPanel - 初期状態', () => {
  it('銘柄が 0 件のときボタンが disabled になること', () => {
    render(<AnalysisPanel {...makeProps([])} />)
    expect(screen.getByRole('button', { name: '一括判断を実行' })).toBeDisabled()
  })

  it('銘柄が 1 件以上あるときボタンが enabled になること', () => {
    render(<AnalysisPanel {...makeProps([makeStock()])} />)
    expect(screen.getByRole('button', { name: '一括判断を実行' })).not.toBeDisabled()
  })

  it('初期状態でプログレスバーが表示されないこと', () => {
    render(<AnalysisPanel {...makeProps([makeStock()])} />)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })
})

// ─── 正常分析フロー ──────────────────────────────────────────────────────────

describe('AnalysisPanel - 正常分析フロー', () => {
  it('分析完了後に onAnalysisComplete が 1 回呼ばれること', async () => {
    mockApiClient.mockResolvedValueOnce(makeApiResult())
    const props = makeProps([makeStock()])
    render(<AnalysisPanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    await waitFor(() => expect(props.onAnalysisComplete).toHaveBeenCalledTimes(1))
  })

  it('分析開始時に onLog へ [Orchestrator] メッセージが渡されること', async () => {
    mockApiClient.mockResolvedValueOnce(makeApiResult())
    const onLog = jest.fn()
    render(<AnalysisPanel {...makeProps([makeStock()], { onLog })} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    await waitFor(() =>
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('[Orchestrator]'))
    )
  })

  it('ML Service 委譲メッセージが onLog に渡されること', async () => {
    mockApiClient.mockResolvedValueOnce(makeApiResult())
    const onLog = jest.fn()
    render(<AnalysisPanel {...makeProps([makeStock('9984.T')], { onLog })} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    await waitFor(() =>
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('[Core Service]'))
    )
  })

  it('結果受信ログに予測値・提案が含まれること', async () => {
    mockApiClient.mockResolvedValueOnce(makeApiResult({ prediction: 'up', suggestion: 'BUY' }))
    const onLog = jest.fn()
    render(<AnalysisPanel {...makeProps([makeStock('7203.T')], { onLog })} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    await waitFor(() =>
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('予測=up'))
    )
    expect(onLog).toHaveBeenCalledWith(expect.stringContaining('提案=BUY'))
  })

  it('current_price が toFixed(1) でフォーマットされてログに出力されること', async () => {
    mockApiClient.mockResolvedValueOnce(makeApiResult({ current_price: 2850.567 }))
    const onLog = jest.fn()
    render(<AnalysisPanel {...makeProps([makeStock()], { onLog })} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    // 2850.567 → toFixed(1) → "2850.6"
    await waitFor(() =>
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('2850.6'))
    )
  })

  it('全ジョブ完了後に onLog へ [System] 完了メッセージが渡されること', async () => {
    mockApiClient.mockResolvedValueOnce(makeApiResult())
    const onLog = jest.fn()
    render(<AnalysisPanel {...makeProps([makeStock()], { onLog })} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    await waitFor(() =>
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('[System]'))
    )
  })
})

// ─── エラーハンドリング ──────────────────────────────────────────────────────

describe('AnalysisPanel - エラーハンドリング', () => {
  it('API エラー時に onLog へ [Error] メッセージが渡されること', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('network failure'))
    const onLog = jest.fn()
    render(<AnalysisPanel {...makeProps([makeStock()], { onLog })} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    await waitFor(() =>
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('[Error]'))
    )
  })

  it('API エラーが発生しても onAnalysisComplete が呼ばれること', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('timeout'))
    const props = makeProps([makeStock()])
    render(<AnalysisPanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    await waitFor(() => expect(props.onAnalysisComplete).toHaveBeenCalledTimes(1))
  })

  it('エラーメッセージが error.message として onLog に渡されること', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('具体的なエラー内容'))
    const onLog = jest.fn()
    render(<AnalysisPanel {...makeProps([makeStock()], { onLog })} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    await waitFor(() =>
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('具体的なエラー内容'))
    )
  })
})

// ─── 複数銘柄 / 分析中状態 ──────────────────────────────────────────────────

describe('AnalysisPanel - 複数銘柄', () => {
  it('複数銘柄を全て処理した後に onAnalysisComplete が 1 回呼ばれること', async () => {
    mockApiClient
      .mockResolvedValueOnce(makeApiResult({ prediction: 'up' }))
      .mockResolvedValueOnce(makeApiResult({ prediction: 'down', suggestion: 'SELL' }))
    const props = makeProps([makeStock('7203.T'), makeStock('9984.T')])
    render(<AnalysisPanel {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))
    await waitFor(() => expect(props.onAnalysisComplete).toHaveBeenCalledTimes(1))
    expect(mockApiClient).toHaveBeenCalledTimes(2)
  })
})

describe('AnalysisPanel - 分析中 UI 状態', () => {
  it('分析中はボタンテキストが「連携処理中...」になること', async () => {
    // 解決を手動制御するプロミスで isAnalyzing=true の状態を観測する
    let resolveApi!: (v: unknown) => void
    mockApiClient.mockReturnValue(new Promise(r => { resolveApi = r }))

    render(<AnalysisPanel {...makeProps([makeStock()])} />)
    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('連携処理中...')
    )

    // クリーンアップ: プロミスを解決してコンポーネントを正常終了させる
    await act(async () => {
      resolveApi(makeApiResult())
    })
  })

  it('分析中はプログレスバーが表示されること', async () => {
    let resolveApi!: (v: unknown) => void
    mockApiClient.mockReturnValue(new Promise(r => { resolveApi = r }))

    render(<AnalysisPanel {...makeProps([makeStock()])} />)
    fireEvent.click(screen.getByRole('button', { name: '一括判断を実行' }))

    await waitFor(() =>
      expect(screen.getByText('0%')).toBeInTheDocument()
    )

    await act(async () => {
      resolveApi(makeApiResult())
    })
  })
})
