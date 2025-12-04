"use client"; //ブラウザ側で動くことを宣言

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const fetchMessage = async () => {
    setLoading(true);
    try {
      // バックエンド(localhost:8000)のエンドポイントを叩く
      const res = await fetch("http://localhost:8000/");
      const data = await res.json();
      setMessage(data.message);
    } catch (error) {
      console.error("Error fetching data:", error);
      setMessage("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-800">
      <h1 className="text-4xl font-bold mb-8">株式売買提案システム (MVP)</h1>
      
      <div className="p-6 bg-white rounded-lg shadow-md w-full max-w-md text-center">
        <p className="mb-4 text-lg">バックエンドとの通信テスト</p>
        
        <button
          onClick={fetchMessage}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {loading ? "通信中..." : "APIを叩く"}
        </button>

        {/* 結果表示エリア */}
        <div className="mt-6 p-4 border border-gray-200 rounded bg-gray-50">
          <p className="text-sm text-gray-500 mb-1">レスポンス結果:</p>
          <p className="text-xl font-semibold text-blue-600 min-h-[1.75rem]">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}