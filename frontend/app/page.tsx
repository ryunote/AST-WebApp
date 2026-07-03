"use client";

import { useState } from "react";
import StockInputForm from "@/components/StockInputForm";
import StockTable from "@/components/StockTable";
import StatusLog from "@/components/StatusLog";
import ThemeToggle from "@/components/ThemeToggle";
import AnalysisPanel from "@/components/AnalysisPanel";
import PortfolioDashboard from "@/components/PortfolioDashboard";
import { useStocks } from "@/hooks/useStocks";
import { usePortfolio } from "@/hooks/usePortfolio";
import { LogEntry } from "@/types";

/**
 * アプリケーションのルートページ。
 * 左カラム: 銘柄操作・AI分析・銘柄一覧・ログ
 * 右カラム: ポートフォリオダッシュボード (sticky)
 */
export default function Home() {
  const {
    stocks, loading, error,
    addStock, deleteStock, markAsBought, settleStock, recordSell, refreshStocks,
  } = useStocks();

  const { portfolio, loading: portfolioLoading, refresh: refreshPortfolio } = usePortfolio();

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (message: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString("ja-JP");
    setLogs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), timestamp: timeString, message },
    ]);
  };

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6 md:p-8 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-200">
      <div className="max-w-screen-2xl mx-auto space-y-6">

        {/* ヘッダーエリア */}
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              株式売買提案システム{" "}
              <span className="text-blue-600 dark:text-blue-400 text-lg align-top">Phase 2</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Cloud Native Architecture Migration Portfolio
            </p>
          </div>
          <ThemeToggle />
        </header>

        {error && (
          <div
            role="alert"
            className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded shadow-sm"
          >
            <p className="font-bold">Error Occurred</p>
            <p>{error}</p>
          </div>
        )}

        {/* 2カラムレイアウト: 左=メインコンテンツ / 右=ポートフォリオ */}
        <div className="flex gap-6 items-start">

          {/* 左カラム */}
          <div className="flex-1 min-w-0 space-y-6">

            <section aria-label="銘柄操作">
              <StockInputForm
                onAdd={addStock}
                onDelete={deleteStock}
                onSettle={settleStock}
                onLog={addLog}
              />
            </section>

            <section aria-label="AI分析">
              <AnalysisPanel
                stocks={stocks}
                onAnalysisComplete={() => { refreshStocks(); refreshPortfolio(); }}
                onLog={addLog}
              />
            </section>

            <section aria-label="保有銘柄一覧">
              <StockTable
                stocks={stocks}
                loading={loading}
                onChangeStatus={async (symbol) => {
                  // StockTable は 未保有 選択時のみこのコールバックを呼ぶ (保有済 は onBuy 経由)
                  addLog(`[System] Backend へ決済リクエストを送信中: ${symbol}`);
                  const result = await settleStock(symbol);
                  if (result.success) {
                    addLog(`[Success] Backend応答: ${result.message}`);
                    refreshPortfolio();
                  } else {
                    addLog(`[Error] Backend応答: ${result.message}`);
                  }
                }}
                onBuy={async (symbol, price, quantity) => {
                  addLog(`[System] Backend へ買付リクエストを送信中: ${symbol} ¥${price} × ${quantity}株`);
                  const result = await markAsBought(symbol, price, quantity);
                  if (result.success) {
                    addLog(`[Success] Backend応答: ${result.message}`);
                    refreshPortfolio();
                  } else {
                    addLog(`[Error] Backend応答: ${result.message}`);
                  }
                }}
                onSell={async (symbol, price, quantity) => {
                  addLog(`[System] Backend へ売却リクエストを送信中: ${symbol} ¥${price} × ${quantity}株`);
                  const result = await recordSell(symbol, price, quantity);
                  if (result.success) {
                    addLog(`[Success] Backend応答: ${result.message}`);
                    refreshPortfolio();
                  } else {
                    addLog(`[Error] Backend応答: ${result.message}`);
                  }
                }}
              />
            </section>

            <section aria-label="システムログ">
              <StatusLog logs={logs} />
            </section>
          </div>

          {/* 右カラム: ポートフォリオダッシュボード */}
          <aside className="w-72 shrink-0" aria-label="ポートフォリオ">
            <PortfolioDashboard
              portfolio={portfolio}
              loading={portfolioLoading}
              onRefresh={refreshPortfolio}
            />
          </aside>
        </div>

      </div>
    </main>
  );
}
