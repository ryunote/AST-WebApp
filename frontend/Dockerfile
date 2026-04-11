# ベースイメージ
FROM node:20-alpine

# 作業ディレクトリ
WORKDIR /app

# 依存関係定義を先にコピー（キャッシュを効かせるため）
COPY package.json package-lock.json ./

# 依存関係のインストール
RUN npm ci

# ソースコードをコピー
COPY . .

# 開発サーバー起動
CMD ["npm", "run", "dev"]