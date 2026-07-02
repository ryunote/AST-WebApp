"use client";

import { Fragment, useState } from "react";
import { StockInTrade, InsightResponse } from "@/types";
import { getMarketInsight } from "@/lib/api";
import { computeConvergence } from "@/lib/convergence";
import NewsInsightPanel from "./NewsInsightPanel";

type Props = {
  stocks: StockInTrade[];
  loading: boolean;
  onUpdateShares: (symbol: string, newShares: number) => Promise<void>;
};

type InsightState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: InsightResponse }
  | { status: "error"; message: string };

const TABLE_HEADERS: { label: string; className?: string }[] = [
  { label: "証券番号" },
  { label: "企業名",    className: "px-3 w-[165px]" },
  { label: "AI提案" },
  { label: "AI予測" },
  { label: "現在株価" },
  { label: "最終分析",  className: "px-3 w-[80px]" },
  { label: "保有状況" },
  { label: "保有株数" },
  { label: "ニュース" },
];

const SHARES_UNIT = 100;

/** "YYYY/MM/DD HH:MM:SS" → "MM/DD HH:MM" */
function formatAnalyzedAt(raw: string | null | undefined): string {
  if (!raw) return "未分析";
  const m = raw.match(/^\d{4}\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})/);
  return m ? `${m[1]}/${m[2]} ${m[3]}:${m[4]}` : raw;
}

/**
 * 登録済み銘柄の一覧を表示するテーブルコンポーネント。
 * 行クリックでInsight Serviceからニュース感情分析を遅延取得し、展開表示する。
 */
export default function StockTable({ stocks, loading, onUpdateShares }: Props) {
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
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              {TABLE_HEADERS.map((head, i) => (
                <th
                  key={i}
                  className={`py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${head.className ?? "px-6"}`}
                >
                  {head.label}
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
                  <Fragment key={stock.stock_symbol}>
                    <tr
                      onClick={() => handleRowClick(stock.stock_symbol)}
                      className="hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      {/* 証券番号 */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                        {stock.stock_symbol}
                      </td>

                      {/* 企業名 */}
                      <td className="px-3 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-[165px] truncate">
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
                      <td className="px-3 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {formatAnalyzedAt(stock.last_analyzed_at)}
                      </td>

                      {/* 保有状況 */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {stock.order_datetime === "未取得" ? "未保有" : stock.order_datetime}
                      </td>

                      {/* 保有株数 (+100/-100) */}
                      <td
                        className="px-4 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SharesControl
                          shares={stock.shares_held ?? 0}
                          onDecrement={() =>
                            onUpdateShares(
                              stock.stock_symbol,
                              Math.max(0, (stock.shares_held ?? 0) - SHARES_UNIT)
                            )
                          }
                          onIncrement={() =>
                            onUpdateShares(
                              stock.stock_symbol,
                              (stock.shares_held ?? 0) + SHARES_UNIT
                            )
                          }
                        />
                      </td>

                      {/* ニュース感情 CTA */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <NewsCta insight={insight} isExpanded={isExpanded} />
                      </td>
                    </tr>

                    {/* 展開行：Insight Panel */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={TABLE_HEADERS.length} className="p-0">
                          {insight && insight.status === "loading" && (
                            <div className="px-6 py-4 bg-blue-50 dark:bg-slate-900/60 text-sm text-gray-500 dark:text-gray-400 animate-pulse border-t border-blue-100 dark:border-slate-700">
                              ニュース分析を取得中...
                            </div>
                          )}
                          {insight && insight.status === "error" && (
                            <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 text-sm text-red-600 dark:text-red-400 border-t border-red-100 dark:border-red-800">
                              取得失敗: {insight.message}
                            </div>
                          )}
                          {insight && insight.status === "loaded" && (
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
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SENTIMENT_CTA = {
  positive: { label: "ポジティブ", icon: "📈", colorClass: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800" },
  negative: { label: "ネガティブ", icon: "📉", colorClass: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800" },
  neutral:  { label: "中立",       icon: "➡️", colorClass: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600" },
} as const;

const NewsCta = ({
  insight,
  isExpanded,
}: {
  insight: InsightState | undefined;
  isExpanded: boolean;
}) => {
  if (!insight || insight.status === "idle") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-blue-500 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer">
        🔍 取得する
      </span>
    );
  }
  if (insight.status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 animate-pulse">
        <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin inline-block" />
        取得中...
      </span>
    );
  }
  if (insight.status === "error") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs text-red-500 dark:text-red-400 border border-dashed border-red-300 dark:border-red-700">
        ⚠ 再取得
      </span>
    );
  }
  const s = SENTIMENT_CTA[insight.data.sentiment];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${s.colorClass}`}>
      {s.icon} {s.label}
      <span className="ml-0.5 text-[10px] opacity-60">{isExpanded ? "▲" : "▼"}</span>
    </span>
  );
};

const SharesControl = ({
  shares,
  onDecrement,
  onIncrement,
}: {
  shares: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) => (
  <div className="flex items-center gap-1">
    <button
      onClick={onDecrement}
      disabled={shares <= 0}
      className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold
        bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
        text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed
        transition-colors"
      aria-label="株数を100株減らす"
    >
      −
    </button>
    <span className="w-16 text-center text-sm font-mono text-gray-800 dark:text-gray-200">
      {shares.toLocaleString()}株
    </span>
    <button
      onClick={onIncrement}
      className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold
        bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
        text-gray-700 dark:text-gray-200 transition-colors"
      aria-label="株数を100株増やす"
    >
      ＋
    </button>
  </div>
);

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
