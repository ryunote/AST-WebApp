/**
 * @jest-environment jsdom
 */
import { apiClient, getMarketInsight } from '@/lib/api'
import { InsightResponse } from '@/types'

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('apiClient', () => {
  beforeEach(() => mockFetch.mockClear())

  // ─── リクエスト構築 ────────────────────────────────────────────────────────

  it('エンドポイントに Base URL を結合して fetch を呼ぶこと', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] })
    await apiClient('/api/stocks')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/stocks'),
      expect.any(Object)
    )
  })

  it('Content-Type: application/json ヘッダーが自動付与されること', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await apiClient('/api/test')
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Content-Type']).toBe('application/json')
  })

  it('呼び出し側が指定した method・body が fetch に渡されること', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    await apiClient('/api/stocks', {
      method: 'POST',
      body: JSON.stringify({ stock_symbol: 'AAPL' }),
    })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.body).toBe(JSON.stringify({ stock_symbol: 'AAPL' }))
  })

  // ─── 正常レスポンス ────────────────────────────────────────────────────────

  it('200 レスポンスはパースされたデータをそのまま返すこと', async () => {
    const expected = [{ stock_symbol: '7203', stock_name: 'トヨタ' }]
    mockFetch.mockResolvedValue({ ok: true, json: async () => expected })
    const result = await apiClient('/api/stocks')
    expect(result).toEqual(expected)
  })

  it('空オブジェクトレスポンスも正常に返すこと', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    const result = await apiClient('/api/noop')
    expect(result).toEqual({})
  })

  // ─── エラーレスポンス ──────────────────────────────────────────────────────

  it('400 レスポンスは FastAPI の detail フィールドで例外をスローすること', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ detail: '証券コードが無効です' }),
    })
    await expect(apiClient('/api/stocks')).rejects.toThrow('証券コードが無効です')
  })

  it('detail がない場合は statusText で例外をスローすること', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    })
    await expect(apiClient('/api/stocks')).rejects.toThrow('Internal Server Error')
  })

  it('404 レスポンスも例外をスローすること', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ detail: '銘柄が見つかりません' }),
    })
    await expect(apiClient('/api/stocks/NOTEXIST')).rejects.toThrow('銘柄が見つかりません')
  })

  // ─── ネットワークエラー ────────────────────────────────────────────────────

  it('ネットワークエラーは例外として再スローされること', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiClient('/api/stocks')).rejects.toThrow('Failed to fetch')
  })
})

describe('getMarketInsight', () => {
  beforeEach(() => mockFetch.mockClear())

  // ─── 正常レスポンス ────────────────────────────────────────────────────────

  it('GM-01: 200 レスポンスは InsightResponse データを返すこと', async () => {
    const expectedInsight: InsightResponse = {
      symbol: '7203.T',
      sentiment: 'positive',
      summary: 'テスト',
      key_events: [],
      risk_factors: [],
      news_count: 3,
      cached: false,
    }
    mockFetch.mockResolvedValue({ ok: true, json: async () => expectedInsight })
    const result = await getMarketInsight('7203.T')
    expect(result).toEqual(expectedInsight)
  })

  it('GM-02: 正しい URL が構築されること (/insight/market/7203.T を含む)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        symbol: '7203.T',
        sentiment: 'positive',
        summary: '',
        key_events: [],
        risk_factors: [],
        news_count: 0,
        cached: false,
      }),
    })
    await getMarketInsight('7203.T')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/insight/market/7203.T'),
      expect.any(Object)
    )
  })

  // ─── エラーレスポンス ──────────────────────────────────────────────────────

  it('GM-03: non-ok レスポンスで detail あり → detail メッセージで例外をスローすること', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ detail: '銘柄が見つかりません' }),
    })
    await expect(getMarketInsight('7203.T')).rejects.toThrow('銘柄が見つかりません')
  })

  it('GM-04: non-ok レスポンスで detail なし → statusText で例外をスローすること', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({}),
    })
    await expect(getMarketInsight('7203.T')).rejects.toThrow('Service Unavailable')
  })

  // ─── ネットワークエラー ────────────────────────────────────────────────────

  it('GM-05: ネットワークエラー (TypeError) は再スローされること', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getMarketInsight('7203.T')).rejects.toThrow('Failed to fetch')
  })
})
