/**
 * システムの処理状況を表示するログコンポーネント。
 * Phase 1では静的な表示だが、将来的にはWebSocket等でのリアルタイム更新を想定。
 */
export default function StatusLog() {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-700">システム処理ログ</h3>
      </div>
      <div className="h-40 bg-gray-900 text-green-400 p-4 font-mono text-xs overflow-y-auto leading-relaxed">
        <p>[System] Phase 1 Application initialized.</p>
        <p>[System] Connected to Backend API.</p>
        <p>[System] Waiting for user operations...</p>
        <span className="animate-pulse">_</span>
      </div>
    </section>
  );
}