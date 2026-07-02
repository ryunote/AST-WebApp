// 環境変数からAPIのBase URLを取得。設定がない場合はローカル開発用のデフォルト値を使用。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const INSIGHT_API_BASE_URL = process.env.NEXT_PUBLIC_INSIGHT_URL || "http://localhost:8002";

/**
 * 共通APIクライアント。
 * fetchのラッパーとして機能し、ベースURLの結合、JSONヘッダーの付与、
 * 基本的なエラーハンドリングを統一的に行う。
 *
 * @param endpoint - APIのエンドポイント (例: "/api/stocks")
 * @param options - fetchのオプション
 * @returns レスポンスデータ (型T)
 * @throws APIエラーまたはネットワークエラー
 */
export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // レスポンスボディの解析
    // 204 No Content などの場合はnullを返す考慮も必要だが、今回はJSON前提とする
    const data = await response.json();

    if (!response.ok) {
      // FastAPIからのエラーメッセージ (detail) があればそれを使用
      throw new Error(data.detail || `API Error: ${response.statusText}`);
    }

    return data as T;
  } catch (error) {
    // ネットワークエラーなどをキャッチして再スロー
    console.error(`API Request Failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * ポートフォリオの現在評価額を取得する。
 * shares_held > 0 の銘柄が集計対象となる。
 *
 * @returns PortfolioResponse
 * @throws {Error} API通信エラー
 */
export async function getPortfolio(): Promise<import("@/types").PortfolioResponse> {
  return apiClient<import("@/types").PortfolioResponse>("/api/portfolio");
}

/**
 * Insight Serviceからニュース感情分析を取得する。
 *
 * @param symbol - 証券コード (例: "7203.T", "AAPL")
 * @returns InsightResponse
 * @throws {Error} Insight API通信エラー
 */
export async function getMarketInsight(symbol: string): Promise<import("@/types").InsightResponse> {
  const url = `${INSIGHT_API_BASE_URL}/insight/market/${symbol}`;

  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || `Insight API Error: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`Insight Request Failed: ${symbol}`, error);
    throw error;
  }
}