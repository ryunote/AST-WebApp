import yfinance as yf
import time
import pandas as pd

def get_stock_data_yf(ticker_symbol, DATE_START, DATE_END):
    """
    Yahoo Finance APIから株価データを取得する関数
    
    戻り値の 'Date' カラムは JSONシリアライズ可能な文字列 (YYYY-MM-DD) に変換済み。
    """
    max_retries = 5
    retries = 0

    while retries < max_retries:
        # auto_adjust=Falseで調整後終値を取得
        data = yf.download(ticker_symbol, start=DATE_START, end=DATE_END, auto_adjust=False)
        
        # データが存在し、中身が空でない場合
        if data is not None and not data.empty:
            # MultiIndexカラムへの対応 (yfinanceのバージョンによる揺らぎ対策)
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.get_level_values(0)

            # Dateをインデックスから列に戻す
            data = data.reset_index()

            # 'Date'カラムが存在するか確認
            if 'Date' in data.columns:
                # -------------------------------------------------------
                # 【追加】日付型(Timestamp)を文字列(YYYY-MM-DD)に変換
                # これにより呼び出し元での変換処理が不要になる
                # -------------------------------------------------------
                data['Date'] = data['Date'].dt.strftime('%Y-%m-%d')

                # 列名の変更と順番の調整（指定のフォーマットに整形）
                # 必要なカラムだけを抽出
                data = data[['Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']]
                data.columns = ['Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']
                
                return data
                
        retries += 1
        msg = f"銘柄ID: {ticker_symbol}のデータ取得に失敗しました。リトライ {retries}/{max_retries}"
        print(msg)
        time.sleep(1)

    msg = f"銘柄ID: {ticker_symbol}のデータ取得に{max_retries}回失敗しました。"
    print(msg)
    return None