import { renderHook, waitFor, act } from '@testing-library/react'
import { useStocks } from '@/hooks/useStocks'
import * as api from '@/lib/api'

jest.mock('@/lib/api')
const mockApiClient = api.apiClient as jest.MockedFunction<typeof api.apiClient>

const sampleStock = {
  stock_symbol: '7203',
  stock_name: 'トヨタ自動車',
  order_id: '---',
  order_datetime: '未取得',
  order_settlement_datetime: '未取得',
  average_acquisition_price: 0.0,
  last_analyzed_at: null,
  current_price: 0.0,
  ai_prediction: null,
  ai_suggestion: null,
}

describe('useStocks', () => {
  beforeEach(() => jest.clearAllMocks())

  // ─── 初期ロード ──────────────────────────────────────────────────────────

  it('マウント時に GET /api/stocks を呼ぶこと', async () => {
    mockApiClient.mockResolvedValue([])
    renderHook(() => useStocks())
    await waitFor(() => expect(mockApiClient).toHaveBeenCalledWith('/api/stocks'))
  })

  it('空レスポンス時は stocks が空配列になること', async () => {
    mockApiClient.mockResolvedValue([])
    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stocks).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('銘柄データが返された場合 stocks に反映されること', async () => {
    mockApiClient.mockResolvedValue([sampleStock])
    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.stocks).toHaveLength(1))
    expect(result.current.stocks[0].stock_symbol).toBe('7203')
  })

  it('API 失敗時は error にメッセージがセットされること', async () => {
    mockApiClient.mockRejectedValue(new Error('Network Error'))
    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.error).toBe('Network Error'))
    expect(result.current.loading).toBe(false)
  })

  // ─── addStock ────────────────────────────────────────────────────────────

  it('addStock は POST /api/stocks を正しい body で呼ぶこと', async () => {
    mockApiClient
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ message: '追加成功', status: 'success', data: sampleStock })
      .mockResolvedValueOnce([sampleStock])

    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.addStock('7203.T')
    })

    expect(mockApiClient).toHaveBeenCalledWith(
      '/api/stocks',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ stock_symbol: '7203.T' }),
      })
    )
  })

  it('addStock 成功後に stocks がリフレッシュされること', async () => {
    mockApiClient
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ message: '追加成功', status: 'success', data: sampleStock })
      .mockResolvedValueOnce([sampleStock])

    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.addStock('7203.T')
    })

    expect(result.current.stocks).toHaveLength(1)
  })

  it('addStock 成功時は { success: true } を返すこと', async () => {
    mockApiClient
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ message: '追加成功', status: 'success', data: sampleStock })
      .mockResolvedValueOnce([])

    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let addResult: any
    await act(async () => {
      addResult = await result.current.addStock('7203.T')
    })

    expect(addResult.success).toBe(true)
  })

  it('addStock 失敗時は { success: false, message } を返すこと', async () => {
    mockApiClient
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('銘柄が見つかりません'))

    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let addResult: any
    await act(async () => {
      addResult = await result.current.addStock('INVALID')
    })

    expect(addResult.success).toBe(false)
    expect(addResult.message).toBe('銘柄が見つかりません')
  })

  // ─── deleteStock ──────────────────────────────────────────────────────────

  it('deleteStock は DELETE /api/stocks/:ticker を呼ぶこと', async () => {
    mockApiClient
      .mockResolvedValueOnce([sampleStock])
      .mockResolvedValueOnce({ message: '削除成功' })
      .mockResolvedValueOnce([])

    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.stocks).toHaveLength(1))

    await act(async () => {
      await result.current.deleteStock('7203')
    })

    expect(mockApiClient).toHaveBeenCalledWith(
      '/api/stocks/7203',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  // ─── settleStock ─────────────────────────────────────────────────────────

  it('settleStock は POST /api/stocks/:ticker/settle を呼ぶこと', async () => {
    mockApiClient
      .mockResolvedValueOnce([sampleStock])
      .mockResolvedValueOnce({ message: '決済成功' })
      .mockResolvedValueOnce([])

    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.stocks).toHaveLength(1))

    await act(async () => {
      await result.current.settleStock('7203')
    })

    expect(mockApiClient).toHaveBeenCalledWith(
      '/api/stocks/7203/settle',
      expect.objectContaining({ method: 'POST' })
    )
  })

  // ─── markAsBought ─────────────────────────────────────────────────────────

  it('markAsBought は PUT でAIロジックを切り替えた後 POST /trades で BUY を記録すること', async () => {
    const tradeRecord = {
      id: 1, stock_symbol: '7203', trade_type: 'BUY',
      quantity: 100, price: 2850, trade_datetime: '2026/01/01 00:00:00', note: null,
    }
    mockApiClient
      .mockResolvedValueOnce([sampleStock])           // fetchStocks (マウント時)
      .mockResolvedValueOnce({ message: '更新成功' }) // PUT /api/stocks/7203
      .mockResolvedValueOnce(tradeRecord)              // POST /api/stocks/7203/trades
      .mockResolvedValueOnce([sampleStock])            // fetchStocks (アクション後)

    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.markAsBought('7203', 2850, 100)
    })

    expect(mockApiClient).toHaveBeenCalledWith(
      '/api/stocks/7203',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('MANUAL'),
      })
    )
    expect(mockApiClient).toHaveBeenCalledWith(
      '/api/stocks/7203/trades',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('BUY'),
      })
    )
  })

  // ─── recordSell ──────────────────────────────────────────────────────────

  it('recordSell は POST /api/stocks/:ticker/trades で SELL を記録すること', async () => {
    const tradeRecord = {
      id: 2, stock_symbol: '7203', trade_type: 'SELL',
      quantity: 50, price: 3500, trade_datetime: '2026/01/01 00:00:00', note: null,
    }
    mockApiClient
      .mockResolvedValueOnce([sampleStock])  // fetchStocks (マウント時)
      .mockResolvedValueOnce(tradeRecord)     // POST /api/stocks/7203/trades
      .mockResolvedValueOnce([sampleStock])  // fetchStocks (アクション後)

    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.recordSell('7203', 3500, 50)
    })

    expect(mockApiClient).toHaveBeenCalledWith(
      '/api/stocks/7203/trades',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('SELL'),
      })
    )
  })

  // ─── refreshStocks ────────────────────────────────────────────────────────

  it('refreshStocks は再度 GET /api/stocks を呼ぶこと', async () => {
    mockApiClient.mockResolvedValue([])
    const { result } = renderHook(() => useStocks())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refreshStocks()
    })

    // マウント時 + 手動refresh = 計2回
    expect(mockApiClient.mock.calls.filter(c => c[0] === '/api/stocks')).toHaveLength(2)
  })
})
