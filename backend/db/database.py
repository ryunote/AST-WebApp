import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# -----------------------------------------------------------------------------
# データベース接続設定
# -----------------------------------------------------------------------------
# 環境変数 DATABASE_URL から接続文字列を取得する。
# 設定されていない場合（ローカル開発時など）は、Docker Compose用のデフォルト値を使用する。
# 本番環境（AWS/Supabase）では、環境変数に本番用の接続文字列を設定するだけで切り替えが可能。
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://user:password@db:5432/stock_db"
)

# エンジンの作成
# PostgreSQLを使用するため、SQLite特有の connect_args={"check_same_thread": False} は不要。
engine = create_engine(DATABASE_URL)

# セッションファクトリの作成
# autocommit=False, autoflush=False はトランザクション制御を手動で行うための標準的な設定。
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# モデル定義の基底クラス
Base = declarative_base()


def get_db():
    """
    データベースセッションを取得する依存関係関数。
    FastAPIの Depends() で使用され、リクエストスコープごとのセッション管理を行う。
    処理終了後（レスポンス返却後）に確実にセッションをクローズする。
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()