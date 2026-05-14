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
 */
import { render, screen } from '@testing-library/react'
import StockTable from '@/components/StockTable'
import { StockInTrade } from '@/types'

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

// ─── ローディング状態 ─────────────────────────────────────────────────────────

describe('StockTable - ローディング状態', () => {
  it('loading=true かつ stocks が空のときローディング表示になること', () => {
    render(<StockTable stocks={[]} loading={true} />)
    expect(screen.getByText('データを読み込み中...')).toBeInTheDocument()
  })

  it('loading=true でも stocks が存在すればテーブルが表示されること', () => {
    render(<StockTable stocks={[makeStock()]} loading={true} />)
    expect(screen.getByText('自動売買中の銘柄一覧')).toBeInTheDocument()
  })

  it('loading=false のときテーブルが表示されること', () => {
    render(<StockTable stocks={[]} loading={false} />)
    expect(screen.getByText('自動売買中の銘柄一覧')).toBeInTheDocument()
  })
})

// ─── 空リスト ─────────────────────────────────────────────────────────────────

describe('StockTable - 空リスト', () => {
  it('stocks が空のとき「登録された銘柄はありません。」が表示されること', () => {
    render(<StockTable stocks={[]} loading={false} />)
    expect(screen.getByText('登録された銘柄はありません。')).toBeInTheDocument()
  })

  it('全テーブルヘッダー 7 件が表示されること', () => {
    render(<StockTable stocks={[]} loading={false} />)
    ;['証券番号', '企業名', 'AI提案', '現在株価', 'AI予測', '最終分析', '保有状況'].forEach(h =>
      expect(screen.getByText(h)).toBeInTheDocument()
    )
  })
})

// ─── 銘柄行のレンダリング ─────────────────────────────────────────────────────

describe('StockTable - 銘柄行のレンダリング', () => {
  it('stock_symbol と stock_name が表示されること', () => {
    render(<StockTable stocks={[makeStock()]} loading={false} />)
    expect(screen.getByText('7203.T')).toBeInTheDocument()
    expect(screen.getByText('トヨタ自動車')).toBeInTheDocument()
  })

  it('current_price がある場合「¥価格」形式で表示されること', () => {
    render(<StockTable stocks={[makeStock({ current_price: 2850 })]} loading={false} />)
    expect(screen.getByText('¥2,850')).toBeInTheDocument()
  })

  it('current_price が null のとき「---」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ current_price: null })]} loading={false} />)
    expect(screen.getByText('---')).toBeInTheDocument()
  })

  it('ai_prediction が "up" のとき「↑ 上昇」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_prediction: 'up' })]} loading={false} />)
    expect(screen.getByText('↑ 上昇')).toBeInTheDocument()
  })

  it('ai_prediction が "down" のとき「↓ 下落」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_prediction: 'down' })]} loading={false} />)
    expect(screen.getByText('↓ 下落')).toBeInTheDocument()
  })

  it('ai_prediction が null のとき「-」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_prediction: null })]} loading={false} />)
    // SuggestionBadge の「-」と ai_prediction の「-」が混在する可能性あり
    // getAllByText で少なくとも 1 件存在すること
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  it('last_analyzed_at がある場合その値が表示されること', () => {
    render(<StockTable stocks={[makeStock({ last_analyzed_at: '2024-01-15 12:00' })]} loading={false} />)
    expect(screen.getByText('2024-01-15 12:00')).toBeInTheDocument()
  })

  it('last_analyzed_at が null のとき「未分析」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ last_analyzed_at: null })]} loading={false} />)
    expect(screen.getByText('未分析')).toBeInTheDocument()
  })

  it('order_datetime が "未取得" のとき「未保有」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ order_datetime: '未取得' })]} loading={false} />)
    expect(screen.getByText('未保有')).toBeInTheDocument()
  })

  it('order_datetime が日時の場合その値がそのまま表示されること', () => {
    render(<StockTable stocks={[makeStock({ order_datetime: '2024-01-10 10:00' })]} loading={false} />)
    expect(screen.getByText('2024-01-10 10:00')).toBeInTheDocument()
  })

  it('複数銘柄が全件レンダリングされること', () => {
    const stocks = [
      makeStock({ stock_symbol: '7203.T', stock_name: 'トヨタ' }),
      makeStock({ stock_symbol: '9984.T', stock_name: 'ソフトバンク' }),
    ]
    render(<StockTable stocks={stocks} loading={false} />)
    expect(screen.getByText('7203.T')).toBeInTheDocument()
    expect(screen.getByText('9984.T')).toBeInTheDocument()
  })
})

// ─── SuggestionBadge ─────────────────────────────────────────────────────────

describe('StockTable - SuggestionBadge', () => {
  it('ai_suggestion が null のとき「-」が表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: null })]} loading={false} />)
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
  })

  it('ai_suggestion が "BUY" のときバッジテキストが表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: 'BUY' })]} loading={false} />)
    expect(screen.getByText('BUY')).toBeInTheDocument()
  })

  it('ai_suggestion が "SELL" のときバッジテキストが表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: 'SELL' })]} loading={false} />)
    expect(screen.getByText('SELL')).toBeInTheDocument()
  })

  it('ai_suggestion が "WAIT" のときバッジテキストが表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: 'WAIT' })]} loading={false} />)
    expect(screen.getByText('WAIT')).toBeInTheDocument()
  })

  it('ai_suggestion が "HOLD" のとき（その他ケース）バッジテキストが表示されること', () => {
    render(<StockTable stocks={[makeStock({ ai_suggestion: 'HOLD' })]} loading={false} />)
    expect(screen.getByText('HOLD')).toBeInTheDocument()
  })
})
