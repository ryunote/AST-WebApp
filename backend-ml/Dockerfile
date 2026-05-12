# ベースイメージ（計算用ライブラリを含むためslim推奨だが、ビルドが必要な場合に備える）
FROM python:3.11-slim

# 作業ディレクトリ設定
WORKDIR /app

# 依存関係ファイルのコピーとインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ソースコードのコピー
# backend-mlディレクトリの中身がここにコピーされます
COPY . .

# コンテナ起動時のコマンド
# 内部ポート8000で起動（docker-composeでポートマッピングを制御）
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]