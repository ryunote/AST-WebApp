// 環境変数からAPIのBase URLを取得。設定がない場合はローカル開発用のデフォルト値を使用。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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