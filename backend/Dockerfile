# ベースイメージ（軽量版Python）
FROM python:3.11-slim

# 作業ディレクトリ設定
WORKDIR /app

# 依存関係ファイルのコピーとインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ソースコードのコピー
COPY . .

# コンテナ起動時のコマンド（ローカル開発用）
# ホスト0.0.0.0でリッスンしないとコンテナ外からアクセスできないため注意
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]