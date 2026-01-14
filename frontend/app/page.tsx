"use client";

import { useState } from "react";
import StockInputForm from "@/components/StockInputForm";
import StockTable from "@/components/StockTable";
import StatusLog from "@/components/StatusLog";
import ThemeToggle from "@/components/ThemeToggle";
import AnalysisPanel from "@/components/AnalysisPanel";
import { useStocks } from "@/hooks/useStocks";
import { LogEntry } from "@/types";

/**
 * アプリケーションのルートページ。
 * 状態のリフトアップ（ログ状態の管理）を行い、
 * バックエンド通信が発生するコンポーネントへログ出力関数(addLog)を注入する。
 */
export default function Home() {
  const { stocks, loading, error, addStock, deleteStock, settleStock, refreshStocks } = useStocks();
  
  // システムログの状態管理
  const [logs, setLogs] = useState<LogEntry[]>([]);

  /**
   * ログを追加する関数。
   * 子コンポーネント（API通信を行う箇所）から呼び出される。
   * バックエンドからの応答やエラー内容を可視化するために使用する。
   */
  const addLog = (message: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString("ja-JP");
    
    setLogs((prev) => [
      ...prev, 
      { 
        id: crypto.randomUUID(),
        timestamp: timeString, 
        message 
      }
    ]);
  };

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6 md:p-12 font-sans text-gray-800 dark:text-gray-100 transition-colors duration-200">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ヘッダーエリア */}
        <header className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              株式売買提案システム <span className="text-blue-600 dark:text-blue-400 text-lg align-top">Phase 2</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Cloud Native Architecture Migration Portfolio
            </p>
          </div>
          <ThemeToggle />
        </header>

        {/* グローバルエラー表示（サーバー接続エラーなど） */}
        {error && (
          <div role="alert" className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded shadow-sm">
            <p className="font-bold">Error Occurred</p>
            <p>{error}</p>
          </div>
        )}

        {/* 銘柄操作エリア：ログ関数(onLog)を渡すことでバックエンドの結果を表示する */}
        <section aria-label="銘柄操作">
          <StockInputForm 
            onAdd={addStock} 
            onDelete={deleteStock} 
            onSettle={settleStock} 
            onLog={addLog}
          />
        </section>

        {/* AI分析パネル：分析プロセスの詳細ログを出力する */}
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
        
        {/* システムログ表示エリア */}
        <section aria-label="システムログ">
          <StatusLog logs={logs} />
        </section>

      </div>
    </main>
  );
}