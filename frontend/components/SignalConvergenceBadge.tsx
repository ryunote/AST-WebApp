import { ConvergenceState } from "@/types";

type Props = { state: ConvergenceState };

const CONFIG: Record<ConvergenceState, { label: string; icon: string; colorClass: string }> = {
  bullish: {
    label: "収束:強気",
    icon: "↑↑",
    colorClass:
      "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-200 dark:border-red-800",
  },
  bearish: {
    label: "収束:弱気",
    icon: "↓↓",
    colorClass:
      "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border border-green-200 dark:border-green-800",
  },
  divergent: {
    label: "乖離",
    icon: "⚡",
    colorClass:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800",
  },
  no_data: {
    label: "未取得",
    icon: "–",
    colorClass: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  },
};

/**
 * XGBoostとGeminiのシグナル収束状態を示すバッジ。
 *
 * @param state - ConvergenceState
 */
export default function SignalConvergenceBadge({ state }: Props) {
  const { label, icon, colorClass } = CONFIG[state];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${colorClass}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
