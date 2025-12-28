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
};

/**
 * 銘柄操作の結果を表す型。
 */
export type StockActionResult = {
  success: boolean;
  message: string;
};

/**
 * システムログのデータ構造
 */
export type LogEntry = {
  id: string;        // リスト表示のkey用
  timestamp: string; // 固定されたタイムスタンプ
  message: string;   // ログ内容
};