/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

jest.mock('@/hooks/useStocks', () => ({
  useStocks: () => ({
    stocks: [],
    loading: false,
    error: null,
    addStock: jest.fn(),
    deleteStock: jest.fn(),
    markAsBought: jest.fn(),
    settleStock: jest.fn(),
    updateSharesHeld: jest.fn(),
    refreshStocks: jest.fn(),
  }),
}))

jest.mock('@/hooks/usePortfolio', () => ({
  usePortfolio: () => ({
    portfolio: null,
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}))

jest.mock('@/components/PortfolioDashboard', () => {
  return function MockPortfolioDashboard() {
    return <div data-testid="portfolio-dashboard">PortfolioDashboard</div>
  }
})

jest.mock('@/components/StockInputForm', () => {
  return function MockStockInputForm() {
    return <div data-testid="stock-input-form">StockInputForm</div>
  }
})

jest.mock('@/components/StockTable', () => {
  return function MockStockTable() {
    return <div data-testid="stock-table">StockTable</div>
  }
})

jest.mock('@/components/StatusLog', () => {
  return function MockStatusLog() {
    return <div data-testid="status-log">StatusLog</div>
  }
})

jest.mock('@/components/ThemeToggle', () => {
  return function MockThemeToggle() {
    return <div data-testid="theme-toggle">ThemeToggle</div>
  }
})

jest.mock('@/components/AnalysisPanel', () => {
  return function MockAnalysisPanel() {
    return <div data-testid="analysis-panel">AnalysisPanel</div>
  }
})

describe('Home Page', () => {
  it('renders main title', () => {
    render(<Home />)
    const title = screen.getByRole('heading', { level: 1 })
    expect(title).toBeInTheDocument()
    expect(title).toHaveTextContent('株式売買提案システム')
  })

  it('renders all main sections', () => {
    render(<Home />)
    expect(screen.getByTestId('stock-input-form')).toBeInTheDocument()
    expect(screen.getByTestId('stock-table')).toBeInTheDocument()
    expect(screen.getByTestId('status-log')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-panel')).toBeInTheDocument()
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument()
  })
})
