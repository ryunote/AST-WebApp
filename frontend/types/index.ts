/**
 * DBの `stocks_in_trade` テーブルに対応する型定義。
 * APIレスポンスとして返却されるデータの形状を示す。
 */
export type StockInTrade = {
  /** 証券コード (PK) 例: "7203.T" */
  stock_symbol: string;
  /** 銘柄名 例: "トヨタ自動車" */
  stock_name: string;
  /** 注文ID (未発注時は "---") */
  order_id: string;
  /** 注文日時 (未発注時は "未取得") */
  order_datetime: string;
  /** 決済日時 */
  order_settlement_datetime: string;
  /** 平均取得単価 */
  average_acquisition_price: number;
  
  // --- 以下、追加カラム (Optional) ---
  // APIからの返却値が null の場合も考慮
  
  /** 最終分析日時 */
  last_analyzed_at?: string | null;
  /** 現在株価 */
  current_price?: number | null;
  /** AI予測結果 ("up" | "down" | "unknown") */
  ai_prediction?: string | null;
  /** 売買提案 ("BUY" | "SELL" | "STAY" | "WAIT" | "HOLD") */
  ai_suggestion?: string | null;
  /** 保有株数 (0 = 未保有) */
  shares_held?: number | null;
};

/**
 * 銘柄操作の結果を表す型。
 */
export type StockActionResult = {
  success: boolean;
  message: string;
};

/**
 * Insight Service (/insight/market/{symbol}) のレスポンス型。
 * Google Gemini によるニュース感情分析結果。
 */
export type InsightResponse = {
  symbol: string;
  sentiment: "positive" | "negative" | "neutral";
  summary: string;
  key_events: string[];
  risk_factors: string[];
  news_count: number;
  cached: boolean;
};

/**
 * XGBoost予測とGeminiニュース感情の収束状態。
 * ユーザーの注意を向けるべき銘柄を判定するために使用する。
 */
export type ConvergenceState = "bullish" | "bearish" | "divergent" | "no_data";

/**
 * ポートフォリオ内1銘柄の評価情報。
 * GET /api/portfolio のレスポンスに含まれる。
 */
export type PortfolioHolding = {
  stock_symbol: string;
  stock_name: string;
  shares_held: number;
  current_price: number;
  acquisition_price: number;
  market_value: number;
  unrealized_pnl: number;
  weight: number;
};

/**
 * ポートフォリオ全体の集計レスポンス。
 */
export type PortfolioResponse = {
  holdings: PortfolioHolding[];
  total_market_value: number;
  total_unrealized_pnl: number;
  as_of: string;
};

/**
 * 売買取引履歴の1レコード。
 * GET /api/stocks/{symbol}/trades のレスポンス要素。
 */
export type TradeEntry = {
  id: number;
  stock_symbol: string;
  /** "BUY" または "SELL" */
  trade_type: "BUY" | "SELL";
  quantity: number;
  price: number;
  trade_datetime: string;
  note: string | null;
};

/**
 * システムログのデータ構造
 */
export type LogEntry = {
  id: string;        // リスト表示のkey用
  timestamp: string; // 固定されたタイムスタンプ
  message: string;   // ログ内容
};