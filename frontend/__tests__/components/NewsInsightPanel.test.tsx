/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import NewsInsightPanel from '@/components/NewsInsightPanel'
import { InsightResponse } from '@/types'

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function makeInsight(overrides: Partial<InsightResponse> = {}): InsightResponse {
  return {
    symbol: '7203.T',
    sentiment: 'positive',
    summary: 'テストサマリー',
    key_events: [],
    risk_factors: [],
    news_count: 5,
    cached: false,
    ...overrides,
  }
}

// ─── センチメント表示 ─────────────────────────────────────────────────────────

describe('NewsInsightPanel - センチメント表示', () => {
  it('NI-01: sentiment="positive" → "ポジティブ" が表示されること', () => {
    render(<NewsInsightPanel insight={makeInsight({ sentiment: 'positive' })} convergence="no_data" />)
    expect(screen.getByText(/ポジティブ/)).toBeInTheDocument()
  })

  it('NI-02: sentiment="negative" → "ネガティブ" が表示されること', () => {
    render(<NewsInsightPanel insight={makeInsight({ sentiment: 'negative' })} convergence="no_data" />)
    expect(screen.getByText(/ネガティブ/)).toBeInTheDocument()
  })

  it('NI-03: sentiment="neutral" → "中立" が表示されること', () => {
    render(<NewsInsightPanel insight={makeInsight({ sentiment: 'neutral' })} convergence="no_data" />)
    expect(screen.getByText(/中立/)).toBeInTheDocument()
  })
})

// ─── サマリー & メタデータ ─────────────────────────────────────────────────────

describe('NewsInsightPanel - サマリー & メタデータ', () => {
  it('NI-04: summary="自動車産業が好調" → その文字列が表示されること', () => {
    render(<NewsInsightPanel insight={makeInsight({ summary: '自動車産業が好調' })} convergence="no_data" />)
    expect(screen.getByText('自動車産業が好調')).toBeInTheDocument()
  })

  it('NI-05: news_count=8 → "8件" が表示されること', () => {
    render(<NewsInsightPanel insight={makeInsight({ news_count: 8 })} convergence="no_data" />)
    expect(screen.getByText(/8件/)).toBeInTheDocument()
  })

  it('NI-06: cached=true → "(キャッシュ)" が表示されること', () => {
    render(<NewsInsightPanel insight={makeInsight({ cached: true })} convergence="no_data" />)
    expect(screen.getByText('(キャッシュ)')).toBeInTheDocument()
  })

  it('NI-07: cached=false → "(キャッシュ)" が表示されないこと', () => {
    render(<NewsInsightPanel insight={makeInsight({ cached: false })} convergence="no_data" />)
    expect(screen.queryByText('(キャッシュ)')).not.toBeInTheDocument()
  })
})

// ─── 注目イベント ─────────────────────────────────────────────────────────────

describe('NewsInsightPanel - 注目イベント', () => {
  it('NI-08: key_events=["決算発表","CEO交代"] → "注目イベント" と各イベントが表示されること', () => {
    render(
      <NewsInsightPanel
        insight={makeInsight({ key_events: ['決算発表', 'CEO交代'], risk_factors: [] })}
        convergence="no_data"
      />
    )
    expect(screen.getByText('注目イベント')).toBeInTheDocument()
    expect(screen.getByText('決算発表')).toBeInTheDocument()
    expect(screen.getByText('CEO交代')).toBeInTheDocument()
  })

  it('NI-09: key_events=[] → "注目イベント" が表示されないこと', () => {
    render(
      <NewsInsightPanel
        insight={makeInsight({ key_events: [], risk_factors: [] })}
        convergence="no_data"
      />
    )
    expect(screen.queryByText('注目イベント')).not.toBeInTheDocument()
  })
})

// ─── リスク要因 ───────────────────────────────────────────────────────────────

describe('NewsInsightPanel - リスク要因', () => {
  it('NI-10: risk_factors=["金利上昇","円高"] → "リスク要因" と各要因が表示されること', () => {
    render(
      <NewsInsightPanel
        insight={makeInsight({ risk_factors: ['金利上昇', '円高'], key_events: [] })}
        convergence="no_data"
      />
    )
    expect(screen.getByText('リスク要因')).toBeInTheDocument()
    expect(screen.getByText('金利上昇')).toBeInTheDocument()
    expect(screen.getByText('円高')).toBeInTheDocument()
  })

  it('NI-11: risk_factors=[] → "リスク要因" が表示されないこと', () => {
    render(
      <NewsInsightPanel
        insight={makeInsight({ key_events: [], risk_factors: [] })}
        convergence="no_data"
      />
    )
    expect(screen.queryByText('リスク要因')).not.toBeInTheDocument()
  })
})

// ─── SignalConvergenceBadge 委譲 ──────────────────────────────────────────────

describe('NewsInsightPanel - SignalConvergenceBadge 委譲', () => {
  it('NI-12: convergence="bullish" → SignalConvergenceBadge が "収束:強気" をレンダリングすること', () => {
    render(
      <NewsInsightPanel insight={makeInsight()} convergence="bullish" />
    )
    expect(screen.getByText('収束:強気')).toBeInTheDocument()
  })
})
