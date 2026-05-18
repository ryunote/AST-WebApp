import { InsightResponse, ConvergenceState } from "@/types";
import SignalConvergenceBadge from "./SignalConvergenceBadge";

type Props = {
  insight: InsightResponse;
  convergence: ConvergenceState;
};

const SENTIMENT_CONFIG: Record<
  InsightResponse["sentiment"],
  { label: string; colorClass: string; icon: string }
> = {
  positive: { label: "ポジティブ", colorClass: "text-red-500 dark:text-red-400", icon: "📈" },
  negative: { label: "ネガティブ", colorClass: "text-green-600 dark:text-green-400", icon: "📉" },
  neutral:  { label: "中立",       colorClass: "text-gray-500 dark:text-gray-400", icon: "➡️" },
};

/**
 * Insight Serviceの分析結果を表示する展開パネル。
 * XGBoostとの収束状態、ニュース感情サマリー、注目イベント、リスク要因を示す。
 *
 * @param insight - InsightResponse
 * @param convergence - XGBoot×Geminiの収束状態
 */
export default function NewsInsightPanel({ insight, convergence }: Props) {
  const sentiment = SENTIMENT_CONFIG[insight.sentiment];

  return (
    <div className="px-6 py-4 bg-blue-50 dark:bg-slate-900/60 border-t border-blue-100 dark:border-slate-700 animate-fadeIn">
      {/* シグナル比較バー */}
      <div className="flex flex-wrap gap-6 mb-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            シグナル収束
          </span>
          <SignalConvergenceBadge state={convergence} />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            ニュース感情
          </span>
          <span className={`text-sm font-bold ${sentiment.colorClass}`}>
            {sentiment.icon} {sentiment.label}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            分析記事数
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {insight.news_count}件
            {insight.cached && (
              <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">(キャッシュ)</span>
            )}
          </span>
        </div>
      </div>

      {/* サマリー */}
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
        {insight.summary}
      </p>

      {/* 注目イベント / リスク要因 */}
      {(insight.key_events.length > 0 || insight.risk_factors.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insight.key_events.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                注目イベント
              </p>
              <ul className="space-y-1">
                {insight.key_events.map((event, i) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-1.5">
                    <span className="text-blue-500 shrink-0">•</span>
                    {event}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insight.risk_factors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                リスク要因
              </p>
              <ul className="space-y-1">
                {insight.risk_factors.map((risk, i) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-1.5">
                    <span className="text-yellow-500 shrink-0">▲</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
