"use client";

import { useEffect, useRef } from "react";
import { LogEntry } from "@/types";

type Props = {
  /** 表示するログデータの配列 */
  logs: LogEntry[];
};

/**
 * システムの処理状況を表示するログコンポーネント。
 */
export default function StatusLog({ logs }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // ログ更新時に自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
      <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
          システム処理ログ
        </h3>
      </div>
      
      <div 
        ref={scrollRef}
        className="h-48 bg-gray-900 text-green-400 p-4 font-mono text-xs overflow-y-auto leading-relaxed scroll-smooth"
      >
        {logs.length === 0 ? (
          <p className="opacity-50">[System] Ready.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="border-b border-gray-800/50 pb-1 mb-1 last:border-0">
              <span className="text-gray-500 mr-2">
                [{log.timestamp}]
              </span>
              {log.message}
            </div>
          ))
        )}
        <div className="mt-2 animate-pulse">_</div>
      </div>
    </section>
  );
}