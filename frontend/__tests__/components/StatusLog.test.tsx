/**
 * @jest-environment jsdom
 *
 * StatusLog コンポーネントのユニットテスト。
 *
 * テスト対象の分岐:
 *   - logs.length === 0 → "[System] Ready." 表示
 *   - logs.length > 0 → 各エントリ (timestamp / message) のレンダリング
 */
import { render, screen } from '@testing-library/react'
import StatusLog from '@/components/StatusLog'
import { LogEntry } from '@/types'

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: '1',
    timestamp: '12:00:00',
    message: 'テストメッセージ',
    ...overrides,
  }
}

// ─── 空ログ ──────────────────────────────────────────────────────────────────

describe('StatusLog - 空ログ', () => {
  it('ログが空のとき「[System] Ready.」が表示されること', () => {
    render(<StatusLog logs={[]} />)
    expect(screen.getByText('[System] Ready.')).toBeInTheDocument()
  })

  it('ヘッダーに「システム処理ログ」が表示されること', () => {
    render(<StatusLog logs={[]} />)
    expect(screen.getByText('システム処理ログ')).toBeInTheDocument()
  })
})

// ─── ログエントリ ─────────────────────────────────────────────────────────────

describe('StatusLog - ログエントリ', () => {
  it('ログが 1 件あるとき「[System] Ready.」が表示されないこと', () => {
    render(<StatusLog logs={[makeLog()]} />)
    expect(screen.queryByText('[System] Ready.')).not.toBeInTheDocument()
  })

  it('ログのタイムスタンプが [HH:MM:SS] 形式で表示されること', () => {
    render(<StatusLog logs={[makeLog({ timestamp: '09:30:00' })]} />)
    expect(screen.getByText('[09:30:00]')).toBeInTheDocument()
  })

  it('ログのメッセージが表示されること', () => {
    render(<StatusLog logs={[makeLog({ message: '[Core Service] 分析開始' })]} />)
    expect(screen.getByText('[Core Service] 分析開始')).toBeInTheDocument()
  })

  it('複数のログが全件表示されること', () => {
    const logs = [
      makeLog({ id: '1', message: '[Orchestrator] ジョブ開始' }),
      makeLog({ id: '2', message: '[Core Service] ML委譲中' }),
      makeLog({ id: '3', message: '[System] 完了' }),
    ]
    render(<StatusLog logs={logs} />)
    expect(screen.getByText('[Orchestrator] ジョブ開始')).toBeInTheDocument()
    expect(screen.getByText('[Core Service] ML委譲中')).toBeInTheDocument()
    expect(screen.getByText('[System] 完了')).toBeInTheDocument()
  })
})
