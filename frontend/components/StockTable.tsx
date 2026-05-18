"use client";

import { useState } from "react";
import { StockInTrade, InsightResponse } from "@/types";
import { getMarketInsight } from "@/lib/api";
import { computeConvergence } from "@/lib/convergence";
import NewsInsightPanel from "./NewsInsightPanel";

type Props = {
  stocks: StockInTrade[];
  loading: boolean;
};

type InsightState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: InsightResponse }
  | { status: "error"; message: string };

const TABLE_HEADERS = [
  "証券番号",
  "企業名",
  "AI提案",
  "AI予測",
  "現在株価",
  "最終分析",
  "保有状況",
  "", // 展開トグル列
];

/**
 * 登録済み銘柄の一覧を表示するテーブルコンポーネント。
 * 行クリックでInsight Serviceからニュース感情分析を遅延取得し、展開表示する。
 */
export default function StockTable({ stocks, loading }: Props) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [insightMap, setInsightMap] = useState<Record<string, InsightState>>({});

  const handleRowClick = async (symbol: string) => {
    if (expandedSymbol === symbol) {
      setExpandedSymbol(null);
      return;
    }

    setExpandedSymbol(symbol);

    const current = insightMap[symbol];
    if (current?.status === "loaded" || current?.status === "loading") return;

    setInsightMap((prev) => ({ ...prev, [symbol]: { status: "loading" } }));

    try {
      const data = await getMarketInsight(symbol);
      setInsightMap((prev) => ({ ...prev, [symbol]: { status: "loaded", data } }));
    } catch (err: any) {
      setInsightMap((prev) => ({
        ...prev,
        [symbol]: { status: "error", message: err.message ?? "取得失敗" },
      }));
    }
  };

  if (loading && stocks.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center transition-colors">
        <p className="text-gray-500 dark:text-gray-400 animate-pulse">データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6 transition-colors">
      <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          自動売買中の銘柄一覧
          <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
            行をクリックでニュース分析を表示
          </span>
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {TABLE_HEADERS.map((head, i) => (
                <th
                  key={i}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>

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
              stocks.map((stock) => {
                const isExpanded = expandedSymbol === stock.stock_symbol;
                const insight = insightMap[stock.stock_symbol];

                return (
                  <>
                    <tr
                      key={stock.stock_symbol}
                      onClick={() => handleRowClick(stock.stock_symbol)}
                      className="hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
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

                      {/* AI予測 (XGBoost) */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {stock.ai_prediction === "up" && (
                          <span className="text-red-500 font-bold">↑ 上昇</span>
                        )}
                        {stock.ai_prediction === "down" && (
                          <span className="text-green-500 font-bold">↓ 下落</span>
                        )}
                        {!stock.ai_prediction && (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>

                      {/* 現在株価 */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-800 dark:text-gray-200">
                        {stock.current_price
                          ? `¥${stock.current_price.toLocaleString()}`
                          : "---"}
                      </td>

                      {/* 最終分析 */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {stock.last_analyzed_at || "未分析"}
                      </td>

                      {/* 保有状況 */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {stock.order_datetime === "未取得" ? "未保有" : stock.order_datetime}
                      </td>

                      {/* 展開トグル */}
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-gray-400 dark:text-gray-500 text-xs select-none">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </td>
                    </tr>

                    {/* 展開行：Insight Panel */}
                    {isExpanded && (
                      <tr key={`${stock.stock_symbol}-insight`}>
                        <td colSpan={TABLE_HEADERS.length} className="p-0">
                          {insight?.status === "loading" && (
                            <div className="px-6 py-4 bg-blue-50 dark:bg-slate-900/60 text-sm text-gray-500 dark:text-gray-400 animate-pulse border-t border-blue-100 dark:border-slate-700">
                              ニュース分析を取得中...
                            </div>
                          )}
                          {insight?.status === "error" && (
                            <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400 border-t border-red-100 dark:border-red-800">
                              取得失敗: {insight.message}
                            </div>
                          )}
                          {insight?.status === "loaded" && (
                            <NewsInsightPanel
                              insight={insight.data}
                              convergence={computeConvergence(
                                stock.ai_prediction,
                                insight.data.sentiment
                              )}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SuggestionBadge = ({ suggestion }: { suggestion?: string | null }) => {
  if (!suggestion) return <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>;

  let colorClass = "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";

  if (suggestion === "BUY") {
    colorClass =
      "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-200 dark:border-red-800";
  } else if (suggestion === "SELL") {
    colorClass =
      "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border border-green-200 dark:border-green-800";
  } else if (suggestion === "WAIT") {
    colorClass =
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200";
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${colorClass}`}>
      {suggestion}
    </span>
  );
};
