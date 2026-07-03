"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { StockInTrade, InsightResponse, TradeEntry } from "@/types";
import { getCachedInsight, getMarketInsight, getTrades } from "@/lib/api";
import { computeConvergence } from "@/lib/convergence";
import NewsInsightPanel from "./NewsInsightPanel";

type Props = {
  stocks: StockInTrade[];
  loading: boolean;
  onChangeStatus: (symbol: string, newStatus: "保有済" | "未保有") => Promise<void>;
  /** BUY フォーム確定時コールバック */
  onBuy?: (symbol: string, price: number, quantity: number) => Promise<void>;
  /** SELL フォーム確定時コールバック */
  onSell?: (symbol: string, price: number, quantity: number) => Promise<void>;
};

type InsightState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: InsightResponse }
  | { status: "error"; message: string };

type TradeState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: TradeEntry[] }
  | { status: "error" };

/** インライン売買フォームの状態 */
type PendingForm = { symbol: string; type: "BUY" | "SELL" } | null;

const TABLE_HEADERS: { label: string; className?: string }[] = [
  { label: "証券番号" },
  { label: "企業名",       className: "px-3 w-[165px]" },
  { label: "AI提案" },
  { label: "AI予測" },
  { label: "現在株価" },
  { label: "取得株価(均)", className: "px-3 w-[100px]" },
  { label: "含み損益",     className: "px-3 w-[100px]" },
  { label: "最終分析",     className: "px-3 w-[80px]" },
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
 * 保有株数列の「＋」→ BUY フォーム、「−」→ SELL フォームを展開し onBuy / onSell を呼ぶ。
 * 行クリックで Insight Service からニュース感情分析を遅延取得・展開表示する。
 */
export default function StockTable({ stocks, loading, onChangeStatus, onBuy, onSell }: Props) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [insightMap, setInsightMap] = useState<Record<string, InsightState>>({});
  const [tradeMap, setTradeMap] = useState<Record<string, TradeState>>({});
  const [activeTabs, setActiveTabs] = useState<Record<string, "news" | "trades">>({});

  // BUY / SELL インラインフォーム共通状態
  const [pendingForm, setPendingForm] = useState<PendingForm>(null);
  const [formPrice, setFormPrice] = useState("");
  const [formQty, setFormQty] = useState("100");

  // stocks 更新時に Redis キャッシュ済みデータをプリフェッチ
  const prefetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    stocks.forEach(({ stock_symbol: symbol }) => {
      if (prefetchedRef.current.has(symbol)) return;
      prefetchedRef.current.add(symbol);
      getCachedInsight(symbol)
        .then((data) => {
          setInsightMap((prev) => {
            if (prev[symbol]) return prev;
            return { ...prev, [symbol]: { status: "loaded", data } };
          });
        })
        .catch(() => {});
    });
  }, [stocks]);

  const handleRowClick = async (symbol: string) => {
    if (expandedSymbol === symbol) {
      setExpandedSymbol(null);
      return;
    }
    setExpandedSymbol(symbol);
    const current = insightMap[symbol];
    if (current?.status === "loading") return;
    setInsightMap((prev) => ({ ...prev, [symbol]: { status: "loading" } }));
    try {
      const data = await getMarketInsight(symbol);
      setInsightMap((prev) => ({ ...prev, [symbol]: { status: "loaded", data } }));
    } catch (err) {
      setInsightMap((prev) => ({
        ...prev,
        [symbol]: { status: "error", message: err instanceof Error ? err.message : "取得失敗" },
      }));
    }
  };

  const handleTabChange = async (symbol: string, tab: "news" | "trades") => {
    setActiveTabs((prev) => ({ ...prev, [symbol]: tab }));
    if (tab === "trades") {
      const current = tradeMap[symbol];
      if (!current || current.status === "idle" || current.status === "error") {
        setTradeMap((prev) => ({ ...prev, [symbol]: { status: "loading" } }));
        try {
          const data = await getTrades(symbol);
          setTradeMap((prev) => ({ ...prev, [symbol]: { status: "loaded", data } }));
        } catch {
          setTradeMap((prev) => ({ ...prev, [symbol]: { status: "error" } }));
        }
      }
    }
  };

  const openForm = (symbol: string, type: "BUY" | "SELL", stock: StockInTrade) => {
    setPendingForm({ symbol, type });
    setFormPrice(stock.current_price ? String(stock.current_price) : "");
    if (type === "SELL") {
      setFormQty(String(Math.min(SHARES_UNIT, stock.shares_held ?? 0)));
    } else {
      setFormQty(String(SHARES_UNIT));
    }
  };

  const handleFormConfirm = async (symbol: string, type: "BUY" | "SELL") => {
    const price = parseFloat(formPrice);
    const qty = parseFloat(formQty);
    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) return;
    if (type === "BUY" && onBuy) await onBuy(symbol, price, qty);
    else if (type === "SELL" && onSell) await onSell(symbol, price, qty);
    setPendingForm(null);
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
                const tradeState = tradeMap[stock.stock_symbol];
                const activeTab = activeTabs[stock.stock_symbol] ?? "news";
                const isFormOpen = pendingForm?.symbol === stock.stock_symbol;

                return (
                  <Fragment key={stock.stock_symbol}>
                    {/* メイン行 */}
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
                        {stock.current_price ? `¥${stock.current_price.toLocaleString()}` : "---"}
                      </td>

                      {/* 取得株価(均) */}
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-mono text-gray-800 dark:text-gray-200">
                        {(stock.average_acquisition_price ?? 0) > 0
                          ? `¥${stock.average_acquisition_price!.toLocaleString()}`
                          : "---"}
                      </td>

                      {/* 含み損益 */}
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-mono">
                        <UnrealizedPnl stock={stock} />
                      </td>

                      {/* 最終分析 */}
                      <td className="px-3 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {formatAnalyzedAt(stock.last_analyzed_at)}
                      </td>

                      {/* 保有状況 */}
                      <td
                        className="px-4 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={
                            (isFormOpen && pendingForm!.type === "BUY") ||
                            (stock.shares_held ?? 0) > 0
                              ? "保有済"
                              : "未保有"
                          }
                          onChange={(e) => {
                            if (e.target.value === "保有済") {
                              openForm(stock.stock_symbol, "BUY", stock);
                            } else {
                              onChangeStatus(stock.stock_symbol, "未保有");
                            }
                          }}
                          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1
                            bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200
                            focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="未保有">未保有</option>
                          <option value="保有済">保有済</option>
                        </select>
                      </td>

                      {/* 保有株数: ＋→買付フォーム / −→売却フォーム */}
                      <td
                        className="px-4 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SharesControl
                          shares={stock.shares_held ?? 0}
                          onSellClick={() => openForm(stock.stock_symbol, "SELL", stock)}
                          onBuyClick={() => openForm(stock.stock_symbol, "BUY", stock)}
                        />
                      </td>

                      {/* ニュース感情 CTA */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <NewsCta insight={insight} isExpanded={isExpanded} />
                      </td>
                    </tr>

                    {/* 買付 / 売却 インラインフォーム行 */}
                    {isFormOpen && (
                      <tr>
                        <td
                          colSpan={TABLE_HEADERS.length}
                          className={`px-6 py-3 border-t ${
                            pendingForm!.type === "BUY"
                              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800"
                              : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={`text-sm font-medium ${
                                pendingForm!.type === "BUY"
                                  ? "text-blue-700 dark:text-blue-300"
                                  : "text-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              {pendingForm!.type === "BUY" ? "買付情報を入力:" : "売却情報を入力:"}
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={formPrice}
                                onChange={(e) => setFormPrice(e.target.value)}
                                placeholder="単価"
                                className="w-32 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1
                                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                  focus:outline-none focus:ring-1 focus:ring-blue-500"
                                min="0"
                              />
                              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">円</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={formQty}
                                onChange={(e) => setFormQty(e.target.value)}
                                placeholder="数量"
                                className="w-20 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1
                                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                                  focus:outline-none focus:ring-1 focus:ring-blue-500"
                                min="0"
                              />
                              <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">株</span>
                            </div>
                            <button
                              onClick={() => handleFormConfirm(stock.stock_symbol, pendingForm!.type)}
                              disabled={!formPrice || !formQty}
                              className={`px-3 py-1 text-sm text-white rounded
                                disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                                pendingForm!.type === "BUY"
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : "bg-emerald-600 hover:bg-emerald-700"
                              }`}
                            >
                              確定
                            </button>
                            <button
                              onClick={() => setPendingForm(null)}
                              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300
                                dark:bg-gray-700 dark:hover:bg-gray-600
                                text-gray-700 dark:text-gray-300 rounded transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* 展開行：ニュース感情 / 取引履歴 タブ */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={TABLE_HEADERS.length} className="p-0">
                          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                            <button
                              onClick={() => handleTabChange(stock.stock_symbol, "news")}
                              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                                activeTab === "news"
                                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                              }`}
                            >
                              ニュース感情
                            </button>
                            <button
                              onClick={() => handleTabChange(stock.stock_symbol, "trades")}
                              className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                                activeTab === "trades"
                                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                              }`}
                            >
                              取引履歴
                            </button>
                          </div>

                          {activeTab === "news" && (
                            <>
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
                            </>
                          )}

                          {activeTab === "trades" && (
                            <TradeHistoryPanel tradeState={tradeState} />
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

// ─── サブコンポーネント ──────────────────────────────────────────────────────

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

/**
 * 保有株数表示 + 買付(＋) / 売却(−) フォームトリガー。
 * ＋ クリック → BUY フォームを展開、− クリック → SELL フォームを展開。
 */
const SharesControl = ({
  shares,
  onSellClick,
  onBuyClick,
}: {
  shares: number;
  onSellClick: () => void;
  onBuyClick: () => void;
}) => (
  <div className="flex items-center gap-1">
    <button
      onClick={onSellClick}
      disabled={shares <= 0}
      className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold
        bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
        text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed
        transition-colors"
      aria-label="売却フォームを表示"
    >
      −
    </button>
    <span className="w-16 text-center text-sm font-mono text-gray-800 dark:text-gray-200">
      {shares.toLocaleString()}株
    </span>
    <button
      onClick={onBuyClick}
      className="w-7 h-7 flex items-center justify-center rounded text-sm font-bold
        bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600
        text-gray-700 dark:text-gray-200 transition-colors"
      aria-label="買付フォームを表示"
    >
      ＋
    </button>
  </div>
);

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

/** 含み損益セル。日本株慣例: 含み益=赤, 含み損=緑 */
const UnrealizedPnl = ({ stock }: { stock: StockInTrade }) => {
  const avg = stock.average_acquisition_price ?? 0;
  const shares = stock.shares_held ?? 0;
  const price = stock.current_price ?? 0;
  if (avg <= 0 || shares <= 0 || price <= 0) {
    return <span className="text-gray-400 dark:text-gray-500">---</span>;
  }
  const pnl = (price - avg) * shares;
  const colorClass =
    pnl > 0
      ? "text-red-500 dark:text-red-400"
      : pnl < 0
      ? "text-emerald-500 dark:text-emerald-400"
      : "text-gray-500 dark:text-gray-400";
  return (
    <span className={colorClass}>
      {`${pnl > 0 ? "▲ " : pnl < 0 ? "▼ " : ""}¥${Math.abs(pnl).toLocaleString()}`}
    </span>
  );
};

/** 取引履歴タブのコンテンツ */
const TradeHistoryPanel = ({ tradeState }: { tradeState: TradeState | undefined }) => {
  if (!tradeState || tradeState.status === "idle" || tradeState.status === "loading") {
    return (
      <div className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 animate-pulse">
        取引履歴を取得中...
      </div>
    );
  }
  if (tradeState.status === "error") {
    return (
      <div className="px-6 py-4 text-sm text-red-500 dark:text-red-400">
        取引履歴の取得に失敗しました。
      </div>
    );
  }
  if (tradeState.data.length === 0) {
    return (
      <div className="px-6 py-4 text-sm text-gray-400 dark:text-gray-500">
        取引履歴はありません。
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-700/60">
            <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">日時</th>
            <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">種別</th>
            <th className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">株数</th>
            <th className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">単価</th>
            <th className="px-4 py-2 text-right text-gray-500 dark:text-gray-400 font-medium">合計</th>
            <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">メモ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {tradeState.data.map((trade) => (
            <tr key={trade.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300 font-mono whitespace-nowrap">
                {trade.trade_datetime}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    trade.trade_type === "BUY"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                  }`}
                >
                  {trade.trade_type === "BUY" ? "買付" : "売却"}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-mono text-gray-800 dark:text-gray-200">
                {trade.quantity.toLocaleString()}株
              </td>
              <td className="px-4 py-2 text-right font-mono text-gray-800 dark:text-gray-200">
                ¥{trade.price.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right font-mono text-gray-800 dark:text-gray-200">
                ¥{(trade.price * trade.quantity).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                {trade.note ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
