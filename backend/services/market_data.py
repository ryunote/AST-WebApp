import datetime as dt
import pandas as pd
import yfinance as yf
import time

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
            # auto_adjust=False: 調整後終値を別途取得する（レガシー互換）
            data = yf.download(ticker_symbol, start=start_date, end=end_date, auto_adjust=False, progress=False)
            
            if data is not None and not data.empty:
                # MultiIndexカラム対応 (yfinance v0.2系以降の対策)
                if isinstance(data.columns, pd.MultiIndex):
                    data.columns = data.columns.get_level_values(0)

                data = data.reset_index()

                # 必須カラムの存在チェック
                required_cols = {'Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume'}
                if required_cols.issubset(data.columns):
                    # 必要なカラムのみ抽出・並べ替え
                    data = data[['Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']]
                    
                    # 欠損値除去（MLのエラー原因になるため）
                    data = data.dropna()
                    
                    return data
        except Exception as e:
            print(f"[Warning] Data fetch error for {ticker_symbol}: {e}")

        retries += 1
        time.sleep(1)

    print(f"[Error] Failed to fetch data for {ticker_symbol} after {max_retries} retries.")
    return pd.DataFrame()