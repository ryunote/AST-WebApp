"use client";

import { PortfolioHolding, PortfolioResponse } from "@/types";

const PALETTE = [
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#8B5CF6", // violet-500
  "#06B6D4", // cyan-500
  "#F97316", // orange-500
  "#EC4899", // pink-500
  "#84CC16", // lime-500
];

// SVG donut chart 定数
const R  = 38;                  // circle radius
const SW = 14;                  // stroke width
const C  = 2 * Math.PI * R;    // circumference ≈ 238.8
const SZ = 100;                 // viewBox size
const CX = SZ / 2;
const CY = SZ / 2;

type Props = {
  portfolio: PortfolioResponse | null;
  loading: boolean;
  onRefresh: () => void;
};

/**
 * ポートフォリオの総評価額・含み損益・銘柄別配分を表示するサイドバーコンポーネント。
 *
 * @param portfolio GET /api/portfolio のレスポンス (null = 未取得)
 * @param loading   フェッチ中フラグ
 * @param onRefresh 手動更新ボタンのコールバック
 */
export default function PortfolioDashboard({ portfolio, loading, onRefresh }: Props) {
  const holdings = portfolio?.holdings ?? [];
  const pnl      = portfolio?.total_unrealized_pnl ?? 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors sticky top-6">

      {/* ヘッダー */}
      <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
          ポートフォリオ
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300
            transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="ポートフォリオを更新"
        >
          {loading ? "更新中…" : "↻ 更新"}
        </button>
      </div>

      <div className="p-4 space-y-5">

        {/* 総評価額 */}
        <div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">総評価額</p>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white leading-tight">
            {portfolio ? `¥${portfolio.total_market_value.toLocaleString()}` : "---"}
          </p>
        </div>

        {/* 含み損益 */}
        <div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">含み損益</p>
          <p className={`text-base font-bold font-mono ${pnlColorClass(pnl, portfolio)}`}>
            {portfolio
              ? `${pnl > 0 ? "▲ " : pnl < 0 ? "▼ " : ""}¥${Math.abs(pnl).toLocaleString()}`
              : "---"}
          </p>
        </div>

        {/* ドーナツチャート */}
        <DonutChart holdings={holdings} />

        {/* 銘柄別配分リスト */}
        {holdings.length > 0 && <HoldingsList holdings={holdings} />}

        {/* 集計日時 */}
        {portfolio?.as_of && (
          <p className="text-[10px] text-gray-400 dark:text-gray-600 text-right">
            {portfolio.as_of} 時点
          </p>
        )}
      </div>
    </div>
  );
}

// 日本株慣例: 含み益=赤, 含み損=緑
function pnlColorClass(pnl: number, portfolio: PortfolioResponse | null): string {
  if (!portfolio) return "text-gray-400 dark:text-gray-500";
  if (pnl > 0)   return "text-red-500 dark:text-red-400";
  if (pnl < 0)   return "text-emerald-500 dark:text-emerald-400";
  return "text-gray-400 dark:text-gray-500";
}

/**
 * SVG stroke-dasharray によるドーナツチャート。
 *
 * stroke-dashoffset = C * (1 - 累積比率) で各セグメントの開始位置を制御。
 * SVG 自体を -90° 回転して 12時方向始まりにする。
 */
function DonutChart({ holdings }: { holdings: PortfolioHolding[] }) {
  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <svg viewBox={`0 0 ${SZ} ${SZ}`} className="w-32 h-32">
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke="#E5E7EB" strokeWidth={SW} className="dark:stroke-gray-700" />
        </svg>
        <p className="text-xs text-gray-400 dark:text-gray-500">保有銘柄なし</p>
      </div>
    );
  }

  let cumFrac = 0;

  return (
    <div className="flex justify-center py-1">
      <svg viewBox={`0 0 ${SZ} ${SZ}`} className="w-32 h-32 -rotate-90">
        {/* ベースリング (グレー) */}
        <circle cx={CX} cy={CY} r={R} fill="none"
          stroke="#E5E7EB" strokeWidth={SW} className="dark:stroke-gray-700" />
        {holdings.map((h, i) => {
          const segLen = (h.weight / 100) * C;
          const offset = C * (1 - cumFrac);
          cumFrac += h.weight / 100;
          return (
            <circle
              key={h.stock_symbol}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={SW}
              strokeDasharray={`${segLen} ${C - segLen}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
    </div>
  );
}

function HoldingsList({ holdings }: { holdings: PortfolioHolding[] }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        銘柄別配分
      </p>
      {holdings.map((h, i) => (
        <div key={h.stock_symbol} className="space-y-1">
          <div className="flex justify-between items-center gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                {h.stock_name || h.stock_symbol}
              </span>
            </div>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 shrink-0">
              {h.weight.toFixed(1)}%
            </span>
          </div>
          {/* 配分バー */}
          <div className="h-1 ml-3.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${h.weight}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
