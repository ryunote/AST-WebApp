"use client";

import { useState } from "react";
import { StockActionResult } from "@/types";

type Props = {
  // アクション関数
  onAdd: (ticker: string) => Promise<StockActionResult>;
  onDelete: (ticker: string) => Promise<StockActionResult>;
  onSettle: (ticker: string) => Promise<StockActionResult>;
  // ログ出力用コールバック（バックエンドの応答を記録するため）
  onLog: (message: string) => void;
};

// 対応市場の定義
const MARKETS = [
  { label: "東証 (.T)", value: ".T" },
  { label: "名証 (.N)", value: ".N" },
  { label: "札証 (.S)", value: ".S" },
  { label: "福証 (.F)", value: ".F" },
  { label: "米国株/その他", value: "" },
];

/**
 * 銘柄操作フォームコンポーネント。
 * バックエンドAPIとの対話結果をログエリアに送信する責務を追加。
 */
export default function StockInputForm({ onAdd, onDelete, onSettle, onLog }: Props) {
  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<StockActionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * コード生成ロジック
   */
  const getFullTicker = () => {
    const cleanCode = code.trim();
    if (!cleanCode) return "";
    return `${cleanCode}.T`; // 今回は東証固定
  };

  /**
   * 共通アクションハンドラ
   */
  const handleAction = async (
    actionFn: (t: string) => Promise<StockActionResult>,
    actionName: string, // ログ用の操作名
    validateFormat: boolean = true
  ) => {
    const fullTicker = getFullTicker();
    
    // 1. バリデーション
    if (!code) {
      setFeedback({ success: false, message: "証券コードを入力してください。" });
      return;
    }
    if (validateFormat && !/^[0-9]+$/.test(code)) {
       setFeedback({ success: false, message: "証券コードは半角数字で入力してください。" });
       return;
    }

    // 2. 処理開始ログ (Backend呼び出し開始の可視化)
    setIsProcessing(true);
    setFeedback(null);
    onLog(`[System] Backendへ ${actionName} リクエストを送信中: ${fullTicker}`);
    
    // 3. API実行
    const result = await actionFn(fullTicker);
    
    // 4. 結果ログ (Backendからの応答)
    if (result.success) {
      onLog(`[Success] Backend応答: ${result.message}`);
    } else {
      onLog(`[Error] Backend応答: ${result.message}`);
    }

    // 5. UI反映
    setFeedback(result);
    setIsProcessing(false);

    if (result.success) {
      setCode(""); 
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 transition-colors">
      
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
        {/* 入力欄 */}
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
                maxLength={4} 
              />
            </div>
            <span className="text-gray-500 dark:text-gray-400 font-bold text-lg">.T</span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            ※ 現在、東京証券取引所の銘柄のみ対応しています。
          </p>
        </div>

        {/* ボタン群 */}
        <div className="flex gap-2 flex-wrap">
          <ActionButton 
            label={isProcessing ? "処理中..." : "追加"} 
            onClick={() => handleAction(onAdd, "登録", true)} 
            colorClass="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            disabled={isProcessing}
          />
          <ActionButton 
            label="手動決済" 
            onClick={() => handleAction(onSettle, "決済", false)} 
            colorClass="bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-500"
            disabled={isProcessing}
          />
          <ActionButton 
            label="削除" 
            onClick={() => handleAction(onDelete, "削除", false)} 
            colorClass="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            disabled={isProcessing}
          />
        </div>
      </div>
      
      {/* 簡易フィードバック表示 */}
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

const ActionButton = ({ label, onClick, colorClass, disabled }: any) => (
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