import { StockInTrade } from "@/types";

type Props = {
  stocks: StockInTrade[];
  loading: boolean;
};

const TABLE_HEADERS = [
  "証券番号",
  "企業名",
  "現在損益",
  "現在株価",
  "注文実行日時",
];

/**
 * 登録済み銘柄の一覧を表示するテーブルコンポーネント。
 * Presentational Componentとして、データの表示のみに責任を持つ。
 */
export default function StockTable({ stocks, loading }: Props) {
  // ローディング状態かつデータがない場合の表示
  if (loading && stocks.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
        <p className="text-gray-500 animate-pulse">データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          自動売買中の銘柄一覧
        </h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {TABLE_HEADERS.map((head) => (
                <th key={head} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stocks.length === 0 ? (
              <tr>
                <td colSpan={TABLE_HEADERS.length} className="px-6 py-12 text-center text-gray-400">
                  登録された銘柄はありません。<br />
                  証券コードを入力して追加してください。
                </td>
              </tr>
            ) : (
              stocks.map((stock) => (
                <tr key={stock.stock_symbol} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {stock.stock_symbol}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {stock.stock_name}
                  </td>
                  {/* Phase 1では損益・株価は計算ロジック未実装のためプレースホルダー表示 */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">---</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {stock.average_acquisition_price > 0 
                      ? `¥${stock.average_acquisition_price.toLocaleString()}` 
                      : "---"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stock.order_datetime}
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