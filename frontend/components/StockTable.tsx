import { StockInTrade } from "@/types";

type Props = {
  stocks: StockInTrade[];
  loading: boolean;
};

const TABLE_HEADERS = [
  "証券番号",
  "企業名",
  "AI提案",
  "現在株価",
  "AI予測",
  "最終分析",
  "保有状況",
];

/**
 * 登録済み銘柄の一覧を表示するテーブルコンポーネント。
 * Presentational Componentとして、データの表示のみに責任を持つ。
 */
export default function StockTable({ stocks, loading }: Props) {
  // ローディング表示
  if (loading && stocks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center transition-colors">
        <p className="text-gray-500 dark:text-gray-400 animate-pulse">
          データを読み込み中...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6 transition-colors">
      
      {/* テーブルヘッダー（タイトル部分） */}
      <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          自動売買中の銘柄一覧
        </h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          
          {/* 列見出し */}
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {TABLE_HEADERS.map((head) => (
                <th 
                  key={head} 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>

          {/* テーブル本体 */}
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {stocks.length === 0 ? (
              <tr>
                <td 
                  colSpan={TABLE_HEADERS.length} 
                  className="px-6 py-12 text-center text-gray-400 dark:text-gray-500"
                >
                  登録された銘柄はありません。
                </td>
              </tr>
            ) : (
              stocks.map((stock) => (
                <tr 
                  key={stock.stock_symbol} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {/* 証券番号 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                    {stock.stock_symbol}
                  </td>
                  
                  {/* 企業名 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {stock.stock_name}
                  </td>
                  
                  {/* AI提案 */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <SuggestionBadge suggestion={stock.ai_suggestion} />
                  </td>

                  {/* 現在株価 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800 dark:text-gray-200">
                    {stock.current_price 
                      ? `¥${stock.current_price.toLocaleString()}` 
                      : "---"}
                  </td>

                  {/* AI予測 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {stock.ai_prediction === "up" && <span className="text-red-500 font-bold">↑ 上昇</span>}
                    {stock.ai_prediction === "down" && <span className="text-green-500 font-bold">↓ 下落</span>}
                    {!stock.ai_prediction && <span className="text-gray-400 dark:text-gray-500">-</span>}
                  </td>

                  {/* 最終分析 */}
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {stock.last_analyzed_at || "未分析"}
                  </td>

                  {/* 保有状況 */}
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {stock.order_datetime === "未取得" ? "未保有" : stock.order_datetime}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 提案バッジ（こちらもダークモード対応済み）
const SuggestionBadge = ({ suggestion }: { suggestion?: string | null }) => {
  if (!suggestion) return <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>;
  
  let colorClass = "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
  
  if (suggestion === "BUY") {
    colorClass = "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-200 dark:border-red-800";
  } else if (suggestion === "SELL") {
    colorClass = "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border border-green-200 dark:border-green-800";
  } else if (suggestion === "WAIT") {
    colorClass = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200";
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${colorClass}`}>
      {suggestion}
    </span>
  );
};