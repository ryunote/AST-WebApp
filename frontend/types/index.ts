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