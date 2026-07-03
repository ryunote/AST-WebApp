import { useState, useCallback, useEffect } from "react";
import { PortfolioResponse } from "@/types";
import { getPortfolio } from "@/lib/api";

/**
 * ポートフォリオ集計データを管理するカスタムフック。
 * GET /api/portfolio を呼び出し、保有銘柄の評価額・含み損益・配分を取得する。
 *
 * @returns portfolio データ・ローディング状態・refresh 関数
 */
export const usePortfolio = () => {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPortfolio();
      setPortfolio(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ポートフォリオの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { portfolio, loading, error, refresh };
};
