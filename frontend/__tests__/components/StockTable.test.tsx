/**
 * @jest-environment jsdom
 *
 * StockTable コンポーネントのユニットテスト。
 *
 * テスト対象の分岐:
 *   - ローディング状態 (loading && stocks.length === 0)
 *   - 空リスト表示
 *   - 各セルの値 / null フォールバック
 *   - SuggestionBadge の全 5 パターン (null / BUY / SELL / WAIT / その他)
 *   - Insight 機能 (getMarketInsight 呼び出し / 展開 / 折りたたみ)
 */
import { render, screen, fireEvent } from '@testing-library/react'
import StockTable from '@/components/StockTable'
import { StockInTrade, InsightResponse } from '@/types'
import { getMarketInsight, getCachedInsight, getTrades } from '@/lib/api'

jest.mock('@/lib/api', () => ({
  getMarketInsight: jest.fn(),
  getCachedInsight: jest.fn(),
  getTrades: jest.fn(),
}))

const mockGetMarketInsight = getMarketInsight as jest.MockedFunction<typeof getMarketInsight>
const mockGetCachedInsight = getCachedInsight as jest.MockedFunction<typeof getCachedInsight>
const mockGetTrades = getTrades as jest.MockedFunction<typeof getTrades>
const mockOnSell = jest.fn().mockResolvedValue(undefined)
const mockOnChangeStatus = jest.fn().mockResolvedValue(undefined)
const mockOnBuy = jest.fn().mockResolvedValue(undefined)

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function makeStock(overrides: Partial<StockInTrade> = {}): StockInTrade {
  return {
    stock_symbol: '7203.T',
    stock_name: 'トヨタ自動車',
    order_id: '---',
    order_datetime: '未取得',
    order_settlement_datetime: '',
    average_acquisition_price: 0,
    ...overrides,
  }
}

function makeInsight(overrides: Partial<InsightResponse> = {}): InsightResponse {
  return {
    symbol: '7203.T',
    sentiment: 'positive',
    summary: 'テスト分析サマリー',
    key_events: [],
    risk_factors: [],
    news_count: 5,
    cached: false,
    ...overrides,
  }
}

beforeEach(() => {
  // キャッシュ未存在 (404) をデフォルト挙動とする
  mockGetCachedInsight.mockRejectedValue(new Error('Not cached'))
  mockGetTrades.mockResolvedValue([])
})

// ─── ローディング状態 ─────────────────────────────────────────────────────────

describe('StockTable - ローディング状態', () => {
  it('loading=true かつ stocks が空のときローディング表示になること', () => {
    render(<StockTable stocks={[]} loading={true} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('データを読み込み中...')).toBeInTheDocument()
  })

  it('loading=true でも stocks が存在すればテーブルが表示されること', () => {
    render(<StockTable stocks={[makeStock()]} loading={true} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('自動売買中の銘柄一覧')).toBeInTheDocument()
  })

  it('loading=false のときテーブルが表示されること', () => {
    render(<StockTable stocks={[]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('自動売買中の銘柄一覧')).toBeInTheDocument()
  })
})

// ─── 空リスト ─────────────────────────────────────────────────────────────────

describe('StockTable - 空リスト', () => {
  it('stocks が空のとき「登録された銘柄はありません。」が表示されること', () => {
    render(<StockTable stocks={[]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('登録された銘柄はありません。')).toBeInTheDocument()
  })

  it('全テーブルヘッダー 11 件が表示されること', () => {
    render(<StockTable stocks={[]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    ;['証券番号', '企業名', 'AI提案', '現在株価', 'AI予測', '取得株価(均)', '含み損益', '最終分析', '保有状況', '保有株数', 'ニュース'].forEach(h =>
      expect(screen.getByText(h)).toBeInTheDocument()
    )
  })
})

// ─── 銘柄行のレンダリング ─────────────────────────────────────────────────────

describe('StockTable - 銘柄行のレンダリング', () => {
  it('stock_symbol と stock_name が表示されること', () => {
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('7203.T')).toBeInTheDocument()
    expect(screen.getByText('トヨタ自動車')).toBeInTheDocument()
  })

  it('current_price がある場合「¥価格」形式で表示されること', () => {
    render(<StockTable stocks={[makeStock({ current_price: 2850 })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('¥2,850')).toBeInTheDocument()
  })

  it('current_price が null のとき「---」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ current_price: null })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    // 現在株価・取得株価(均)・含み損益 など複数列に「---」が出るため getAllByText を使用
    expect(screen.getAllByText('---').length).toBeGreaterThan(0)
  })

  it('ai_prediction が "up" のとき「↑ 上昇」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_prediction: 'up' })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('↑ 上昇')).toBeInTheDocument()
  })

  it('ai_prediction が "down" のとき「↓ 下落」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_prediction: 'down' })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('↓ 下落')).toBeInTheDocument()
  })

  it('ai_prediction が null のとき「-」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_prediction: null })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    // SuggestionBadge の「-」と ai_prediction の「-」が混在する可能性あり
    // getAllByText で少なくとも 1 件存在すること
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  it('last_analyzed_at がある場合その値が表示されること', () => {
    render(<StockTable stocks={[makeStock({ last_analyzed_at: '2024-01-15 12:00' })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('2024-01-15 12:00')).toBeInTheDocument()
  })

  it('last_analyzed_at が null のとき「未分析」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ last_analyzed_at: null })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('未分析')).toBeInTheDocument()
  })

  it('shares_held が 0 のとき保有状況ドロップダウンが「未保有」を選択していること', () => {
    render(<StockTable stocks={[makeStock({ shares_held: 0 })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByRole('combobox')).toHaveValue('未保有')
  })

  it('shares_held > 0 のとき保有状況ドロップダウンが「保有済」を選択していること', () => {
    render(<StockTable stocks={[makeStock({ shares_held: 100 })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByRole('combobox')).toHaveValue('保有済')
  })

  it('複数銘柄が全件レンダリングされること', () => {
    const stocks = [
      makeStock({ stock_symbol: '7203.T', stock_name: 'トヨタ' }),
      makeStock({ stock_symbol: '9984.T', stock_name: 'ソフトバンク' }),
    ]
    render(<StockTable stocks={stocks} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('7203.T')).toBeInTheDocument()
    expect(screen.getByText('9984.T')).toBeInTheDocument()
  })
})

// ─── SuggestionBadge ─────────────────────────────────────────────────────────

describe('StockTable - SuggestionBadge', () => {
  it('ai_suggestion が null のとき「-」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: null })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  it('ai_suggestion が "BUY" のときバッジテキストが表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: 'BUY' })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('BUY')).toBeInTheDocument()
  })

  it('ai_suggestion が "SELL" のときバッジテキストが表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: 'SELL' })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('SELL')).toBeInTheDocument()
  })

  it('ai_suggestion が "WAIT" のときバッジテキストが表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: 'WAIT' })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('WAIT')).toBeInTheDocument()
  })

  it('ai_suggestion が "HOLD" のとき（その他ケース）バッジテキストが表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: 'HOLD' })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('HOLD')).toBeInTheDocument()
  })
})

// ─── Insight 機能 ─────────────────────────────────────────────────────────────

describe('StockTable - Insight機能', () => {
  beforeEach(() => mockGetMarketInsight.mockClear())

  it('ST-01: 銘柄行の初期状態で「取得する」CTAが表示されること', () => {
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText(/取得する/)).toBeInTheDocument()
  })

  it('ST-02: ヘッダーに「ニュース」列が含まれること', () => {
    render(<StockTable stocks={[]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('ニュース')).toBeInTheDocument()
  })

  it('ST-03: 行クリックで getMarketInsight が呼ばれること', async () => {
    mockGetMarketInsight.mockResolvedValue(makeInsight())
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    fireEvent.click(screen.getByText('7203.T'))
    expect(mockGetMarketInsight).toHaveBeenCalledWith('7203.T')
  })

  it('ST-04: クリック後ローディング中「取得中...」が表示されること', async () => {
    mockGetMarketInsight.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    fireEvent.click(screen.getByText('7203.T'))
    // <td> と内包 <span> の両方がマッチするため findAllByText を使用
    expect((await screen.findAllByText(/取得中/)).length).toBeGreaterThan(0)
  })

  it('ST-05: 取得成功後、感情バッジ「ポジティブ」が表示されること', async () => {
    mockGetMarketInsight.mockResolvedValue(makeInsight({ sentiment: 'positive' }))
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    fireEvent.click(screen.getByText('7203.T'))
    // NewsCta と NewsInsightPanel の両方に「ポジティブ」が表示される
    expect((await screen.findAllByText(/ポジティブ/)).length).toBeGreaterThan(0)
  })

  it('ST-06: 取得成功後、NewsInsightPanelのサマリーが展開表示されること', async () => {
    mockGetMarketInsight.mockResolvedValue(makeInsight({ summary: 'テスト分析サマリー' }))
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    fireEvent.click(screen.getByText('7203.T'))
    expect(await screen.findByText('テスト分析サマリー')).toBeInTheDocument()
  })

  it('ST-07: 同じ行を2回クリックすると展開が閉じること', async () => {
    mockGetMarketInsight.mockResolvedValue(makeInsight({ summary: 'テスト分析サマリー' }))
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    fireEvent.click(screen.getByText('7203.T'))
    await screen.findByText('テスト分析サマリー')
    fireEvent.click(screen.getByText('7203.T'))
    expect(screen.queryByText('テスト分析サマリー')).not.toBeInTheDocument()
  })

  it('ST-08: 再展開のたびにAPIを再呼び出しして最新のキャッシュ状態を反映すること', async () => {
    mockGetMarketInsight.mockResolvedValue(makeInsight())
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    // 1回目クリック → 展開
    fireEvent.click(screen.getByText('7203.T'))
    expect((await screen.findAllByText(/ポジティブ/)).length).toBeGreaterThan(0)
    // 2回目クリック → 折りたたみ
    fireEvent.click(screen.getByText('7203.T'))
    // 3回目クリック → 再展開（Redisキャッシュ状態を反映するため再フェッチ）
    fireEvent.click(screen.getByText('7203.T'))
    expect((await screen.findAllByText(/ポジティブ/)).length).toBeGreaterThan(0)
    expect(mockGetMarketInsight).toHaveBeenCalledTimes(2)
  })

  it('ST-09: getMarketInsightがエラーを投げた場合「再取得」が表示されること', async () => {
    mockGetMarketInsight.mockRejectedValue(new Error('ネットワークエラー'))
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    fireEvent.click(screen.getByText('7203.T'))
    expect(await screen.findByText(/再取得/)).toBeInTheDocument()
  })

  it('ST-10: 別の行をクリックすると最後にクリックした行のみ展開されること', async () => {
    const stocks = [
      makeStock({ stock_symbol: '7203.T', stock_name: 'トヨタ自動車' }),
      makeStock({ stock_symbol: '9984.T', stock_name: 'ソフトバンク' }),
    ]
    mockGetMarketInsight
      .mockResolvedValueOnce(makeInsight({ symbol: '7203.T', summary: 'トヨタ分析' }))
      .mockResolvedValueOnce(makeInsight({ symbol: '9984.T', summary: 'ソフトバンク分析' }))
    render(<StockTable stocks={stocks} loading={false} onChangeStatus={mockOnChangeStatus} />)
    fireEvent.click(screen.getByText('7203.T'))
    await screen.findByText('トヨタ分析')
    fireEvent.click(screen.getByText('9984.T'))
    await screen.findByText('ソフトバンク分析')
    expect(screen.queryByText('トヨタ分析')).not.toBeInTheDocument()
  })
})

// ─── 取得株価 / 含み損益 ────────────────────────────────────────────────────

describe('StockTable - 取得株価(均) / 含み損益', () => {
  it('average_acquisition_price が 0 のとき「---」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ average_acquisition_price: 0 })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    // 取得株価(均) と 現在株価(---) の両方で --- が出るため getAllByText
    expect(screen.getAllByText('---').length).toBeGreaterThan(0)
  })

  it('average_acquisition_price > 0 のとき「¥価格」形式で表示されること', () => {
    render(<StockTable stocks={[makeStock({ average_acquisition_price: 3500 })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByText('¥3,500')).toBeInTheDocument()
  })

  it('avg / shares / current_price が揃った場合「▲」または「▼」付きで含み損益が表示されること', () => {
    render(<StockTable stocks={[makeStock({
      average_acquisition_price: 3000,
      shares_held: 100,
      current_price: 3500,
    })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    // (3500 - 3000) * 100 = 50000 → 含み益=赤 ▲ ¥50,000
    expect(screen.getByText('▲ ¥50,000')).toBeInTheDocument()
  })

  it('含み損の場合「▼」が付くこと', () => {
    render(<StockTable stocks={[makeStock({
      average_acquisition_price: 3500,
      shares_held: 100,
      current_price: 3000,
    })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    // (3000 - 3500) * 100 = -50000 → ▼ ¥50,000
    expect(screen.getByText('▼ ¥50,000')).toBeInTheDocument()
  })
})

// ─── 買付フォーム ────────────────────────────────────────────────────────────

describe('StockTable - 買付フォーム', () => {
  it('ST-11: 保有状況を「保有済」に変更すると買付フォームが表示されること', () => {
    render(<StockTable stocks={[makeStock({ shares_held: 0 })]} loading={false} onChangeStatus={mockOnChangeStatus} onBuy={mockOnBuy} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '保有済' } })
    expect(screen.getByPlaceholderText('取得単価 (円)')).toBeInTheDocument()
  })

  it('ST-12: 買付フォームの「キャンセル」でフォームが非表示になること', () => {
    render(<StockTable stocks={[makeStock({ shares_held: 0 })]} loading={false} onChangeStatus={mockOnChangeStatus} onBuy={mockOnBuy} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '保有済' } })
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByPlaceholderText('取得単価 (円)')).not.toBeInTheDocument()
  })

  it('ST-13: 単価と株数を入力して「確定」をクリックすると onBuy が呼ばれること', async () => {
    render(<StockTable stocks={[makeStock({ shares_held: 0 })]} loading={false} onChangeStatus={mockOnChangeStatus} onBuy={mockOnBuy} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '保有済' } })
    fireEvent.change(screen.getByPlaceholderText('取得単価 (円)'), { target: { value: '3000' } })
    fireEvent.change(screen.getByPlaceholderText('株数'), { target: { value: '100' } })
    fireEvent.click(screen.getByText('確定'))
    expect(mockOnBuy).toHaveBeenCalledWith('7203.T', 3000, 100)
  })

  it('ST-11b: 「＋」ボタンをクリックすると買付フォームが表示されること', () => {
    render(<StockTable stocks={[makeStock({ shares_held: 100 })]} loading={false} onChangeStatus={mockOnChangeStatus} onBuy={mockOnBuy} />)
    fireEvent.click(screen.getByRole('button', { name: '買付フォームを表示' }))
    expect(screen.getByPlaceholderText('取得単価 (円)')).toBeInTheDocument()
  })
})

// ─── 取引履歴タブ ─────────────────────────────────────────────────────────────

describe('StockTable - 取引履歴タブ', () => {
  beforeEach(() => mockGetMarketInsight.mockResolvedValue(makeInsight()))

  it('ST-14: 行展開後「取引履歴」タブをクリックすると getTrades が呼ばれること', async () => {
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    fireEvent.click(screen.getByText('7203.T'))
    await screen.findByText('ニュース感情')
    fireEvent.click(screen.getByText('取引履歴'))
    expect(mockGetTrades).toHaveBeenCalledWith('7203.T')
  })

  it('ST-15: 取引履歴が空の場合「取引履歴はありません。」が表示されること', async () => {
    mockGetTrades.mockResolvedValue([])
    render(<StockTable stocks={[makeStock()]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    fireEvent.click(screen.getByText('7203.T'))
    await screen.findByText('ニュース感情')
    fireEvent.click(screen.getByText('取引履歴'))
    expect(await screen.findByText('取引履歴はありません。')).toBeInTheDocument()
  })
})

// ─── 売却フォーム ─────────────────────────────────────────────────────────────

describe('StockTable - 売却フォーム', () => {
  it('ST-16: 「−」ボタンをクリックすると売却フォームが表示されること', () => {
    render(<StockTable stocks={[makeStock({ shares_held: 100 })]} loading={false} onChangeStatus={mockOnChangeStatus} onSell={mockOnSell} />)
    fireEvent.click(screen.getByRole('button', { name: '売却フォームを表示' }))
    expect(screen.getByPlaceholderText('売却単価 (円)')).toBeInTheDocument()
  })

  it('ST-17: 売却フォームの「キャンセル」でフォームが非表示になること', () => {
    render(<StockTable stocks={[makeStock({ shares_held: 100 })]} loading={false} onChangeStatus={mockOnChangeStatus} onSell={mockOnSell} />)
    fireEvent.click(screen.getByRole('button', { name: '売却フォームを表示' }))
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByPlaceholderText('売却単価 (円)')).not.toBeInTheDocument()
  })

  it('ST-18: 単価と株数を入力して「確定」をクリックすると onSell が呼ばれること', async () => {
    render(<StockTable stocks={[makeStock({ shares_held: 100 })]} loading={false} onChangeStatus={mockOnChangeStatus} onSell={mockOnSell} />)
    fireEvent.click(screen.getByRole('button', { name: '売却フォームを表示' }))
    fireEvent.change(screen.getByPlaceholderText('売却単価 (円)'), { target: { value: '3500' } })
    fireEvent.change(screen.getByPlaceholderText('株数'), { target: { value: '50' } })
    fireEvent.click(screen.getByText('確定'))
    expect(mockOnSell).toHaveBeenCalledWith('7203.T', 3500, 50)
  })

  it('ST-19: 保有株数が 0 のとき「−」ボタンが disabled になること', () => {
    render(<StockTable stocks={[makeStock({ shares_held: 0 })]} loading={false} onChangeStatus={mockOnChangeStatus} />)
    expect(screen.getByRole('button', { name: '売却フォームを表示' })).toBeDisabled()
  })
})
