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

  /**
   * 銘柄を「保有済」に手動変更し、BUY 取引を記録する。
   * order_id を "MANUAL" にして AI を SELL/HOLD ロジックへ切り替え、
   * trade_history に BUY レコードを作成して加重平均コスト法で average_acquisition_price を同期する。
   *
   * @param ticker - 証券コード
   * @param acquisitionPrice - 取得単価 (円)
   * @param quantity - 購入株数 (デフォルト 100)
   */
  const markAsBought = (ticker: string, acquisitionPrice: number, quantity = 100) => {
    const now = new Date().toLocaleString("ja-JP");
    return executeAction(async () => {
      await apiClient<{ message: string }>(`/api/stocks/${ticker}`, {
        method: "PUT",
        body: JSON.stringify({ order_id: "MANUAL", order_datetime: now }),
      });
      await apiClient<unknown>(`/api/stocks/${ticker}/trades`, {
        method: "POST",
        body: JSON.stringify({ trade_type: "BUY", quantity, price: acquisitionPrice }),
      });
      return { message: `${ticker} 買付を記録しました (¥${acquisitionPrice} × ${quantity}株)` };
    });
  };

  /**
   * 銘柄を全売却決済する。
   * バックエンドが現在の shares_held / current_price で SELL 記録を作成し、
   * order_id / shares_held / average_acquisition_price をリセットする。
   */
  const settleStock = (ticker: string) =>
    executeAction(() =>
      apiClient<{ message: string }>(`/api/stocks/${ticker}/settle`, { method: "POST" })
    );

  /**
   * 保有株数を直接更新する（管理用途・手動補正向け）。
   */
  const updateSharesHeld = (ticker: string, newShares: number) =>
    executeAction(() =>
      apiClient<{ message: string }>(`/api/stocks/${ticker}`, {
        method: "PUT",
        body: JSON.stringify({ shares_held: Math.max(0, newShares) }),
      })
    );

  /**
   * 部分売却を記録する。
   * trade_history に SELL レコードを作成し shares_held / average_acquisition_price を同期する。
   * shares_held が 0 になった場合、バックエンドが order_id もリセットして AI を BUY ロジックへ戻す。
   *
   * @param ticker - 証券コード
   * @param sellPrice - 売却単価 (円)
   * @param quantity - 売却株数
   */
  const recordSell = (ticker: string, sellPrice: number, quantity: number) =>
    executeAction(async () => {
      await apiClient<unknown>(`/api/stocks/${ticker}/trades`, {
        method: "POST",
        body: JSON.stringify({ trade_type: "SELL", quantity, price: sellPrice }),
      });
      return { message: `${ticker} 売却を記録しました (¥${sellPrice} × ${quantity}株)` };
    });

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
    markAsBought,
    settleStock,
    recordSell,
    updateSharesHeld,
    refreshStocks: fetchStocks,
  };
};