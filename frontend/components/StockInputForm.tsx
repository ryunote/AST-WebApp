"use client";

import { useState } from "react";
import { StockActionResult } from "@/types";

type Props = {
  // アクションはPromiseを返し、結果オブジェクトを解決する関数として定義
  onAdd: (ticker: string) => Promise<StockActionResult>;
  onDelete: (ticker: string) => Promise<StockActionResult>;
  onSettle: (ticker: string) => Promise<StockActionResult>;
};

/**
 * 銘柄の追加・削除・手動決済を行う入力フォームコンポーネント。
 * アクションの結果に基づいてフィードバックメッセージを表示する責務を持つ。
 */
export default function StockInputForm({ onAdd, onDelete, onSettle }: Props) {
  const [ticker, setTicker] = useState("");
  const [feedback, setFeedback] = useState<StockActionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * ボタンクリック時の共通ハンドラ
   */
  const handleAction = async (
    actionFn: (t: string) => Promise<StockActionResult>
  ) => {
    if (!ticker) return;
    
    setIsProcessing(true);
    setFeedback(null);
    
    const result = await actionFn(ticker);
    
    setFeedback(result);
    setIsProcessing(false);

    // 成功時のみ入力欄をクリア
    if (result.success) {
      setTicker("");
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div>
          <label htmlFor="ticker-input" className="block text-sm font-bold text-gray-700 mb-1">
            証券番号
          </label>
          <input
            id="ticker-input"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 w-40 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            placeholder="例: 7203.T"
            disabled={isProcessing}
          />
        </div>

        <div className="flex gap-2">
          <ActionButton 
            label="追加" 
            onClick={() => handleAction(onAdd)} 
            colorClass="bg-blue-600 hover:bg-blue-700"
            disabled={isProcessing}
          />
          <ActionButton 
            label="手動決済" 
            onClick={() => handleAction(onSettle)} 
            colorClass="bg-yellow-500 hover:bg-yellow-600"
            disabled={isProcessing}
          />
          <ActionButton 
            label="削除" 
            onClick={() => handleAction(onDelete)} 
            colorClass="bg-red-600 hover:bg-red-700"
            disabled={isProcessing}
          />
        </div>
      </div>
      
      {/* フィードバックメッセージ表示 */}
      {feedback && (
        <p className={`mt-3 text-sm font-medium ${feedback.success ? "text-green-600" : "text-red-600"}`}>
          {feedback.message}
        </p>
      )}
    </div>
  );
}

// ボタンコンポーネントをローカルで定義してDRY化
const ActionButton = ({ 
  label, onClick, colorClass, disabled 
}: { 
  label: string; 
  onClick: () => void; 
  colorClass: string; 
  disabled: boolean 
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 text-white rounded transition-colors ${colorClass} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    {label}
  </button>
);