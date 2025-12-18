// 株価データの型定義
export type StockData = {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  "Adj Close": number; // スペースが含まれるキーは引用符で囲む
  Volume: number;
};

// 検索フォームの入力値の型
export type SearchParams = {
  ticker: string;
  startDate: string;
  endDate: string;
};

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
};

/**
 * 銘柄操作の結果を表す型。
 * UI側でのトースト通知やエラー表示に使用する。
 */
export type StockActionResult = {
  success: boolean;
  message: string;
};