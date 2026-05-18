/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import SignalConvergenceBadge from '@/components/SignalConvergenceBadge'

describe('SignalConvergenceBadge', () => {
  it('SB-01: state="bullish" → "収束:強気" と "↑↑" が表示されること', () => {
    render(<SignalConvergenceBadge state="bullish" />)
    expect(screen.getByText('収束:強気')).toBeInTheDocument()
    expect(screen.getByText('↑↑')).toBeInTheDocument()
  })

  it('SB-02: state="bearish" → "収束:弱気" と "↓↓" が表示されること', () => {
    render(<SignalConvergenceBadge state="bearish" />)
    expect(screen.getByText('収束:弱気')).toBeInTheDocument()
    expect(screen.getByText('↓↓')).toBeInTheDocument()
  })

  it('SB-03: state="divergent" → "乖離" と "⚡" が表示されること', () => {
    render(<SignalConvergenceBadge state="divergent" />)
    expect(screen.getByText('乖離')).toBeInTheDocument()
    expect(screen.getByText('⚡')).toBeInTheDocument()
  })

  it('SB-04: state="no_data" → "未取得" と "–" が表示されること', () => {
    render(<SignalConvergenceBadge state="no_data" />)
    expect(screen.getByText('未取得')).toBeInTheDocument()
    expect(screen.getByText('–')).toBeInTheDocument()
  })
})
