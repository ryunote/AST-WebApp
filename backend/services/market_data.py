import datetime as dt
import pandas as pd
import yfinance as yf
import time
import sys

def fetch_historical_data(ticker_symbol: str, days: int = 365) -> pd.DataFrame:
    """
    Yahoo Finance APIから指定期間の株価データを取得する。
    
    Args:
        ticker_symbol (str): 証券コード (例: "7203.T")
        days (int): 過去何日分のデータを取得するか (デフォルト365日)

    Returns:
        pd.DataFrame: 株価データ (Date, Open, High, Low, Close, Adj Close, Volume)
                      取得失敗時は空のDataFrameを返す。
    """
    end_date = dt.date.today()
    start_date = end_date - dt.timedelta(days=days)

    max_retries = 3
    retries = 0

    while retries < max_retries:
        try:
            # yfinance v0.2系以降の仕様に対応
            # auto_adjust=False: 調整後終値を別途取得する（レガシー互換）
            data = yf.download(
                ticker_symbol, 
                start=start_date, 
                end=end_date, 
                auto_adjust=False, 
                progress=False,
                timeout=10
            )
            # データが空の場合のチェック
            if data is None or data.empty:
                print(f"[Warning] No data found for {ticker_symbol}. Retrying...", file=sys.stderr)
                retries += 1
                time.sleep(2)
                continue

            # MultiIndexカラム対応 (yfinanceのバージョン差異吸収)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            data = data.reset_index()

            # 必須カラムチェック
            required_cols = {'Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume'}
            current_cols = set(data.columns)
            
            if not required_cols.issubset(current_cols):
                missing = required_cols - current_cols
                print(f"[Error] Missing columns for {ticker_symbol}: {missing}", file=sys.stderr)
                # カラム不足はリトライしても直らない可能性が高いが、念のため
                retries += 1
                continue

            # 必要なカラムのみ抽出・並べ替え
            data = data[['Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']]
            
            # 欠損値除去
            data = data.dropna()
            
            print(f"[Success] Fetched {len(data)} rows for {ticker_symbol}", file=sys.stdout)
            return data

        except Exception as e:
            print(f"[Error] Exception during fetch for {ticker_symbol}: {str(e)}", file=sys.stderr)
            retries += 1
            time.sleep(2)

    print(f"[Error] Failed to fetch data for {ticker_symbol} after {max_retries} retries.", file=sys.stderr)
    return pd.DataFrame() # 空のDataFrameを返す