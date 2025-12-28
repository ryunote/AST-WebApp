"use client";

import { useState } from "react";
import StockInputForm from "@/components/StockInputForm";
import StockTable from "@/components/StockTable";
import StatusLog from "@/components/StatusLog";
import ThemeToggle from "@/components/ThemeToggle";
import AnalysisPanel from "@/components/AnalysisPanel";
import { useStocks } from "@/hooks/useStocks";

/**
 * アプリケーションのルートページ (Dashboard)。
 * 各コンポーネントのレイアウト定義と、データフックの注入を行う。
 */
export default function Home() {
  const { stocks, loading, error, addStock, deleteStock, settleStock, refreshStocks } = useStocks();
  
  // ログの状態管理 (ここに追加)
  const [logs, setLogs] = useState<string[]>([
    "System initialized.",
    "Connected to Backend API."
  ]);

  /**
   * ログを追加するヘルパー関数
   */
  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message]);
  };

  /**
   * アクション実行時にログを挟むラッパー
   */
  const handleAddStock = async (ticker: string) => {
    addLog(`[Request] 銘柄追加: ${ticker}`);
    const result = await addStock(ticker);
    addLog(`[Result] ${result.message}`);
    return result;
  };

  const handleDeleteStock = async (ticker: string) => {
    addLog(`[Request] 銘柄削除: ${ticker}`);
    const result = await deleteStock(ticker);
    addLog(`[Result] ${result.message}`);
    return result;
  };

  const handleSettleStock = async (ticker: string) => {
    addLog(`[Request] 手動決済: ${ticker}`);
    const result = await settleStock(ticker);
    addLog(`[Result] ${result.message}`);
    return result;
  };

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6 md:p-12 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ヘッダーエリア */}
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              株式売買提案システム <span className="text-blue-600 dark:text-blue-400 text-lg align-top">Phase 1</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Cloud Native Architecture Migration Portfolio
            </p>
          </div>
          <ThemeToggle />
        </header>

        {/* グローバルエラー表示 */}
        {error && (
          <div role="alert" className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded shadow-sm">
            <p className="font-bold">Error Occurred</p>
            <p>{error}</p>
          </div>
        )}

        {/* 銘柄操作エリア */}
        <section aria-label="銘柄操作">
          <StockInputForm 
            onAdd={handleAddStock} 
            onDelete={handleDeleteStock} 
            onSettle={handleSettleStock} 
          />
        </section>

        {/* AI分析パネル (ログ関数を渡す) */}
        <section aria-label="AI分析">
          <AnalysisPanel 
            stocks={stocks} 
            onAnalysisComplete={refreshStocks} 
            onLog={addLog}
          />
        </section>

        {/* 一覧テーブル */}
        <section aria-label="保有銘柄一覧">
          <StockTable stocks={stocks} loading={loading} />
        </section>
        
        {/* システムログ (ログ状態を渡す) */}
        <section aria-label="システムログ">
          <StatusLog logs={logs} />
        </section>

      </div>
    </main>
  );
}