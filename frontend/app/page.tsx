"use client";

import StockInputForm from "@/components/StockInputForm";
import StockTable from "@/components/StockTable";
import StatusLog from "@/components/StatusLog";
import { useStocks } from "@/hooks/useStocks";

/**
 * アプリケーションのルートページ (Dashboard)。
 * 各コンポーネントのレイアウト定義と、データフックの注入を行う。
 */
export default function Home() {
  // データ管理ロジック呼び出し
  const { stocks, loading, error, addStock, deleteStock, settleStock } = useStocks();

  return (
    <main className="min-h-screen bg-gray-100 p-6 md:p-12 font-sans text-gray-800">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ヘッダーエリア */}
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            株式売買提案システム <span className="text-blue-600 text-lg align-top">Phase 1</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Cloud Native Architecture Migration Portfolio
          </p>
        </header>

        {/* グローバルエラー表示 */}
        {error && (
          <div role="alert" className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm">
            <p className="font-bold">Error Occurred</p>
            <p>{error}</p>
          </div>
        )}

        {/* 操作・入力エリア */}
        <section aria-label="銘柄操作">
          <StockInputForm 
            onAdd={addStock} 
            onDelete={deleteStock} 
            onSettle={settleStock} 
          />
        </section>

        {/* メインテーブルエリア */}
        <section aria-label="保有銘柄一覧">
          <StockTable stocks={stocks} loading={loading} />
        </section>
        
        {/* ログエリア */}
        <section aria-label="システムログ">
          <StatusLog />
        </section>

      </div>
    </main>
  );
}