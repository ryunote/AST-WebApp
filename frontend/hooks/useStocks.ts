import { useState, useCallback, useEffect } from "react";
import { StockInTrade, StockActionResult } from "@/types";
import { apiClient } from "@/lib/api";

/**
 * 株式銘柄の管理機能を提供するカスタムフック。
 * Presentation Component (UI) から Business Logic を完全に分離するために使用する。
 *
 * @returns 状態変数(stocks, loading, error)と操作関数(add, delete, settle)
 */
export const useStocks = () => {
  const [stocks, setStocks] = useState<StockInTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 銘柄一覧をバックエンドから取得してStateを更新する。
   * useCallbackにより、不要な再生成を防ぐ。
   */
  const fetchStocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<StockInTrade[]>("/api/stocks");
      setStocks(data);
    } catch (err: any) {
      setError(err.message || "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 共通のアクション実行ラッパー。
   * エラーハンドリングとリストの再取得(re-fetch)を自動化する。
   */
  const executeAction = async (
    apiCall: () => Promise<{ message: string }>
  ): Promise<StockActionResult> => {
    try {
      const res = await apiCall();
      // 成功したらリストを最新化する（楽観的UI更新はPhase 2以降で検討）
      await fetchStocks();
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message || "操作に失敗しました" };
    }
  };

  // --- アクション定義 ---

  const addStock = (ticker: string) =>
    executeAction(() =>
      apiClient<{ message: string }>("/api/stocks", {
        method: "POST",
        body: JSON.stringify({ stock_symbol: ticker }),
      })
    );

  const deleteStock = (ticker: string) =>
    executeAction(() =>
      apiClient<{ message: string }>(`/api/stocks/${ticker}`, {
        method: "DELETE",
      })
    );

  const settleStock = (ticker: string) => {
    const now = new Date().toLocaleString("ja-JP");
    return executeAction(() =>
      apiClient<{ message: string }>(`/api/stocks/${ticker}`, {
        method: "PUT",
        body: JSON.stringify({
          order_id: "---",
          order_settlement_datetime: now,
          order_datetime: `売却済: ${now}`,
          average_acquisition_price: 0.0,
        }),
      })
    );
  };

  // 初回マウント時にデータを取得
  // React 18のStrict Mode開発環境では2回呼ばれることがあるが、仕様上問題ない
  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  return {
    stocks,
    loading,
    error,
    addStock,
    deleteStock,
    settleStock,
    refreshStocks: fetchStocks,
  };
};