"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * ライトモードとダークモードを切り替えるトグルボタンコンポーネント。
 * next-themesライブラリのuseThemeフックを使用してテーマの状態管理を行う。
 * 
 * ベストプラクティス:
 * Next.jsのSSR環境下では、サーバー側とクライアント側で初期テーマが異なると
 * Hydration Mismatchエラーが発生するため、クライアントサイドでのマウントが
 * 完了したことを確認してからレンダリングを行う。
 */
export default function ThemeToggle() {
  // next-themesから現在のテーマと設定関数を取得
  const { theme, setTheme } = useTheme();
  
  // マウント状態を管理するフラグ
  const [mounted, setMounted] = useState(false);

  /**
   * コンポーネントがクライアントサイドでマウントされた後に実行される副作用。
   * これにより、UIのレンダリングがクライアントサイドでのみ行われることを保証する。
   */
  useEffect(() => {
    setMounted(true);
  }, []);

  // マウント前は何もレンダリングしない（またはスケルトンを表示する）ことで
  // サーバーとクライアントのHTML不一致を防ぐ
  if (!mounted) {
    // レイアウトシフトを防ぐために同じサイズの空要素を返すのが一般的
    return <div className="w-10 h-10" aria-hidden="true" />;
  }

  return (
    <button
      // 現在のテーマに応じて逆のテーマに切り替える
      // systemテーマが選択されている場合も考慮し、resolvedThemeではなく明示的な設定を行う
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="テーマを切り替える"
      title={theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}
    >
      {theme === "dark" ? (
        // --- ダークモード時に表示するアイコン（月） ---
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5 text-yellow-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
          />
        </svg>
      ) : (
        // --- ライトモード時に表示するアイコン（太陽） ---
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5 text-orange-500"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
          />
        </svg>
      )}
    </button>
  );
}