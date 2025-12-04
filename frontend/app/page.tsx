"use client";

import { useState } from "react";
import type { StockData } from "@/types";

export default function Home() {
  // フォームの状態管理
  const [ticker, setTicker] = useState("7203.T");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-01-31");

  // データとUIの状態管理
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 検索実行関数
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault(); // フォーム送信時のリロードを防ぐ
    setLoading(true);
    setError(null);
    setStockData([]);

    try {
      // クエリパラメータの構築
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });

      // API呼び出し (FastAPIのエンドポイント)
      const res = await fetch(
        `http://localhost:8000/api/stock/${ticker}?${params.toString()}`
      );

      if (!res.ok) {
        // 404や400エラーの処理
        const errData = await res.json();
        throw new Error(errData.detail || "データの取得に失敗しました");
      }

      const data: StockData[] = await res.json();
      setStockData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          株式データ取得 (Phase 1)
        </h1>

        {/* --- 検索フォームエリア --- */}
        <form
          onSubmit={handleSearch}
          className="bg-white p-6 rounded-lg shadow-md mb-8 flex flex-wrap gap-4 items-end"
        >
          {/* 証券コード入力 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              証券コード
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 w-32 focus:ring-2 focus:ring-blue-500 outline-none text-gray-700"
              placeholder="7203.T"
              required
            />
          </div>

          {/* 開始日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              開始日
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-gray-700"
              required
            />
          </div>

          {/* 終了日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              終了日
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-gray-700"
              required
            />
          </div>

          {/* 検索ボタン */}
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 transition ml-auto"
          >
            {loading ? "取得中..." : "データを取得"}
          </button>
        </form>

        {/* --- 結果表示エリア --- */}
        
        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {/* データテーブル */}
        {stockData.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Open</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">High</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Low</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Close</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {row.Date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {row.Open.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {row.High.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {row.Low.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold text-right">
                        {row.Close.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {row.Volume.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}