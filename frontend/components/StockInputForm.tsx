"use client";

import { useState } from "react";
import { StockActionResult } from "@/types";

type Props = {
  onAdd: (ticker: string) => Promise<StockActionResult>;
  onDelete: (ticker: string) => Promise<StockActionResult>;
  onSettle: (ticker: string) => Promise<StockActionResult>;
};

/**
 * 銘柄操作フォームコンポーネント。
 * 【仕様変更】東京証券取引所（.T）の銘柄のみに限定。
 * これにより、yfinanceのデータ取得精度を担保し、ユーザー入力の揺らぎを排除する。
 */
export default function StockInputForm({ onAdd, onDelete, onSettle }: Props) {
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<StockActionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * 入力された数字コードに東証サフィックス(.T)を付与してティッカーを生成
   */
  const getFullTicker = () => {
    const cleanCode = code.trim();
    if (!cleanCode) return "";
    return `${cleanCode}.T`;
  };

  /**
   * 共通アクションハンドラ
   */
  const handleAction = async (
    actionFn: (t: string) => Promise<StockActionResult>,
    validateFormat: boolean = true
  ) => {
    const fullTicker = getFullTicker();
    
    // 1. クライアントサイドバリデーション
    if (!code) {
      setFeedback({ success: false, message: "証券コードを入力してください。" });
      return;
    }
    
    // 東証限定のため、半角数字のみを許可
    if (validateFormat && !/^[0-9]+$/.test(code)) {
       setFeedback({ success: false, message: "証券コードは半角数字で入力してください。" });
       return;
    }

    // 2. 処理開始
    setIsProcessing(true);
    setFeedback(null);
    
    // 3. API実行
    const result = await actionFn(fullTicker);
    
    // 4. 結果反映
    setFeedback(result);
    setIsProcessing(false);

    // 成功時のみ入力欄をクリア
    if (result.success) {
      setCode(""); 
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 transition-colors">
      
      {/* フォームとボタンのレイアウト */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
        
        {/* 証券コード入力エリア */}
        <div>
          <label htmlFor="stock-code" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
            証券コード
          </label>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                id="stock-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-l px-3 py-2 w-32 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-colors placeholder-gray-400 text-right font-mono text-lg"
                placeholder="7203"
                disabled={isProcessing}
                maxLength={4} // 一般的な銘柄コード長（必要に応じて5桁対応など緩和可）
              />
            </div>
            {/* .T 固定表示ラベル */}
            <span className="text-gray-500 dark:text-gray-400 font-bold text-lg">.T</span>
          </div>
          
          {/* 注釈メッセージ */}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            ※ 現在、東京証券取引所の銘柄のみ対応しています。
          </p>
        </div>

        {/* アクションボタン群 */}
        <div className="flex gap-2 flex-wrap">
          <ActionButton 
            label={isProcessing ? "処理中..." : "追加"} 
            onClick={() => handleAction(onAdd, true)} 
            colorClass="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            disabled={isProcessing}
          />
          <ActionButton 
            label="手動決済" 
            onClick={() => handleAction(onSettle, false)} 
            colorClass="bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-500"
            disabled={isProcessing}
          />
          <ActionButton 
            label="削除" 
            onClick={() => handleAction(onDelete, false)} 
            colorClass="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            disabled={isProcessing}
          />
        </div>
      </div>
      
      {/* フィードバックメッセージ */}
      {feedback && (
        <div className={`mt-4 p-3 rounded text-sm font-medium flex items-center gap-2 animate-fadeIn ${
          feedback.success 
            ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" 
            : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        }`}>
          <span>{feedback.success ? "✓" : "!"}</span>
          {feedback.message}
        </div>
      )}
    </div>
  );
}

// ボタンコンポーネント（DRY）
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
    className={`px-4 py-2 min-w-[90px] text-white rounded font-medium transition-all shadow-sm ${colorClass} ${
      disabled ? "opacity-50 cursor-not-allowed transform-none" : "hover:-translate-y-0.5"
    }`}
  >
    {label}
  </button>
);