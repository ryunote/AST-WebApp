"use client";

import { useState, FormEvent } from "react";
import type { StockData } from "@/types";

/**
 * ----------------------------------------------------------------------------
 * UI Components
 * ----------------------------------------------------------------------------
 * デザインの一貫性を保ち、Tailwind CSSのクラス重複を避けるためのAtomicなコンポーネント群。
 * 将来的には共通UIライブラリとして別ファイルへの切り出しを推奨。
 */

type InputFieldProps = {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: "text" | "date";
  placeholder?: string;
  className?: string;
};

/**
 * ラベルと入力フィールドをラップした標準コンポーネント
 */
const InputField = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
}: InputFieldProps) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 ${className}`}
      placeholder={placeholder}
      required
    />
  </div>
);

/**
 * テーブルヘッダーの標準スタイル定義
 */
const TableHeader = ({
  title,
  align = "right",
}: {
  title: string;
  align?: "left" | "right";
}) => (
  <th
    className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
      align === "left" ? "text-left" : "text-right"
    }`}
  >
    {title}
  </th>
);

/**
 * テーブルセルの標準スタイル定義
 */
const TableCell = ({
  children,
  align = "right",
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) => (
  <td
    className={`px-6 py-4 whitespace-nowrap text-sm ${
      align === "left" ? "text-left" : "text-right"
    } ${className}`}
  >
    {children}
  </td>
);

/**
 * ----------------------------------------------------------------------------
 * Custom Hooks
 * ----------------------------------------------------------------------------
 */

/**
 * 株式データ取得に関するロジックと状態管理をカプセル化するフック。
 * プレゼンテーション層（View）からデータフェッチの責務を分離します。
 */
const useStockSearch = () => {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 指定された条件でAPIからデータを取得し、Stateを更新する
   */
  const fetchStockData = async (
    ticker: string,
    startDate: string,
    endDate: string
  ) => {
    setLoading(true);
    setError(null);
    setData([]);

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });

      // エンドポイントは環境変数等での管理を推奨
      const endpoint = `http://localhost:8000/api/stock/${ticker}?${params.toString()}`;
      const res = await fetch(endpoint);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "データの取得に失敗しました");
      }

      const result: StockData[] = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || "予期せぬエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fetchStockData };
};

/**
 * ----------------------------------------------------------------------------
 * Main Page Component
 * ----------------------------------------------------------------------------
 */
export default function Home() {
  // フォーム入力の状態管理
  const [ticker, setTicker] = useState("7203.T");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-01-31");

  // データ取得ロジックの呼び出し
  const { data: stockData, loading, error, fetchStockData } = useStockSearch();

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    fetchStockData(ticker, startDate, endDate);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          株式データ取得
        </h1>

        {/* 検索条件入力エリア */}
        <form
          onSubmit={handleSearch}
          className="bg-white p-6 rounded-lg shadow-md mb-8 flex flex-wrap gap-4 items-end"
        >
          <InputField
            label="証券コード"
            value={ticker}
            onChange={setTicker}
            className="w-32"
            placeholder="7203.T"
          />
          <InputField
            label="開始日"
            value={startDate}
            onChange={setStartDate}
            type="date"
          />
          <InputField
            label="終了日"
            value={endDate}
            onChange={setEndDate}
            type="date"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 transition ml-auto"
          >
            {loading ? "取得中..." : "データを取得"}
          </button>
        </form>

        {/* エラー表示エリア */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded mb-6">
            {error}
          </div>
        )}

        {/* データ表示テーブルエリア */}
        {stockData.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <TableHeader title="Date" align="left" />
                    <TableHeader title="Open" />
                    <TableHeader title="High" />
                    <TableHeader title="Low" />
                    <TableHeader title="Close" />
                    <TableHeader title="Volume" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <TableCell align="left" className="font-medium text-gray-900">
                        {row.Date}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {row.Open.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {row.High.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {row.Low.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-blue-600 font-semibold">
                        {row.Close.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {row.Volume.toLocaleString()}
                      </TableCell>
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