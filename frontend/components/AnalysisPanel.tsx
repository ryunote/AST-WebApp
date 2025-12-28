"use client";

import { useState } from "react";
import { StockInTrade } from "@/types";
import { apiClient } from "@/lib/api";

type Props = {
  /** 分析対象の銘柄リスト */
  stocks: StockInTrade[];
  /** 分析完了時に一覧をリロードするコールバック */
  onAnalysisComplete: () => void;
  /** ログ出力用コールバック */
  onLog: (message: string) => void;
};

/**
 * 一括分析を実行するコントロールパネル。
 * フロントエンド主導で順次APIをコールし、進捗とログをユーザーにフィードバックする。
 */
export default function AnalysisPanel({ stocks, onAnalysisComplete, onLog }: Props) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState("");

  const handleRunAnalysis = async () => {
    if (stocks.length === 0) {
      onLog("[Warning] 分析対象の銘柄がありません。銘柄を追加してください。");
      return;
    }
    
    setIsAnalyzing(true);
    setProgress(0);
    onLog(`[Start] 一括分析プロセスを開始します (対象: ${stocks.length}件)`);

    let completed = 0;

    // 直列実行でAPIを叩く
    for (const stock of stocks) {
      const ticker = stock.stock_symbol;
      setCurrentStatus(`${ticker} 分析中...`);
      onLog(`[Info] ${ticker} (${stock.stock_name}) のデータを取得・分析中...`);

      try {
        // 分析APIをコール (DB更新含む)
        // レスポンスを受け取ることで、詳細な結果をログに出せる
        const result = await apiClient<any>(`/api/analysis/${ticker}`);
        
        onLog(`[Success] ${ticker}: 予測=${result.prediction}, 提案=${result.suggestion}, 株価=${result.current_price}`);
      
      } catch (error: any) {
        onLog(`[Error] ${ticker} の分析に失敗しました: ${error.message || "Unknown error"}`);
        console.error(`Failed to analyze ${ticker}`, error);
      }
      
      completed++;
      setProgress(Math.round((completed / stocks.length) * 100));
    }

    setCurrentStatus("完了");
    onLog("[Done] 全銘柄の分析が完了しました。最新データを表示します。");
    
    setIsAnalyzing(false);
    
    // 最後に一覧データを再取得してテーブルを更新
    onAnalysisComplete();
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <span>🤖</span> AI売買判断
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            登録済み全銘柄の株価データを取得し、機械学習モデルによる予測を実行します。
          </p>
        </div>
        
        <button
          onClick={handleRunAnalysis}
          disabled={isAnalyzing || stocks.length === 0}
          className={`px-6 py-3 rounded-lg font-bold text-white shadow-md transition-all ${
            isAnalyzing || stocks.length === 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
          }`}
        >
          {isAnalyzing ? "AI思考中..." : "一括判断を実行"}
        </button>
      </div>

      {/* プログレスバー */}
      {isAnalyzing && (
        <div className="mt-4 animate-fadeIn">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1 font-mono">
            <span>{currentStatus}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}