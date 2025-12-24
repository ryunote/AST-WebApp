import pandas as pd
from xgboost import XGBClassifier

def predict_stock_movement(data: pd.DataFrame) -> str:
    """
    XGBoostを用いて翌日の株価騰落を予測する。
    
    Args:
        data (pd.DataFrame): 株価データのDataFrame (Date, Open, Close等を含むこと)

    Returns:
        str: "up" (上昇予測) または "down" (下落予測)
             データ不足等の場合は "unknown"
    """
    # データ数が少なすぎる場合は予測不可
    if len(data) < 10:
        return "unknown"

    # --- 特徴量エンジニアリング (Legacyロジック準拠) ---
    # Warning: SettingWithCopyWarningを防ぐため copy() を使用
    df = data.copy()

    # 前日比 (Close - PrevClose)
    df["Close_diff"] = df["Close"].diff()
    
    # 始値と前日終値の差 (Open - PrevClose)
    df["Open_Close_diff"] = df["Open"] - df["Close"].shift()
    
    # NaNを含む行（先頭行など）を削除
    df_clean = df.dropna()

    if df_clean.empty:
        return "unknown"

    # --- 学習用データセットの作成 ---
    # 説明変数
    X = df_clean[["Close_diff", "Open_Close_diff"]]
    
    # 目的変数: 翌日の終値 > 当日の終値 なら 1 (UP), それ以外 0
    # shift(-1) で未来のデータを参照してラベルを作成
    y = (df_clean["Close"].shift(-1) > df_clean["Close"]).astype(int)

    # 最後の行は未来のデータ(y)がないため学習には使えないが、
    # 予測入力(X)としては使うため、スライスで調整する。
    
    # 学習用: 最後の1行以外
    X_train = X.iloc[:-1]
    y_train = y.iloc[:-1]

    # モデルの学習 (都度学習)
    model = XGBClassifier(eval_metric='logloss', use_label_encoder=False)
    model.fit(X_train, y_train)

    # --- 予測実行 ---
    # 最新のデータ（今日のデータ）を使って、翌日を予測する
    latest_features = X.iloc[-1:]
    
    prediction = model.predict(latest_features)

    return "up" if prediction[0] == 1 else "down"