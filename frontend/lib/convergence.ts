import { ConvergenceState } from "@/types";

/**
 * XGBoost予測とGeminiニュース感情からシグナル収束状態を算出する。
 *
 * @param aiPrediction - XGBoostの予測 ("up" | "down" | null | undefined)
 * @param sentiment - Geminiの感情分析 ("positive" | "negative" | "neutral" | null | undefined)
 * @returns ConvergenceState
 */
export function computeConvergence(
  aiPrediction: string | null | undefined,
  sentiment: "positive" | "negative" | "neutral" | null | undefined
): ConvergenceState {
  if (!aiPrediction || !sentiment || sentiment === "neutral") return "no_data";

  const xgboostUp = aiPrediction === "up";
  const geminiPositive = sentiment === "positive";

  if (xgboostUp && geminiPositive) return "bullish";
  if (!xgboostUp && !geminiPositive) return "bearish";
  return "divergent";
}
