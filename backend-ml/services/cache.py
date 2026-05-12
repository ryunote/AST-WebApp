"""
Cache Service
=============

Redisを使ったキャッシュラッパー。
yfinanceのRate Limit回避と予測レスポンスの高速化が目的。

設計方針:
- キャッシュキー: "predict:{stock_symbol}"
- TTL: 3600秒 (1時間) — yfinanceデータは日次OHLCVのため十分な鮮度
- Graceful Degradation: Redis接続失敗時はキャッシュミス扱いでフォールスルー
"""

import json
import os
import sys
import redis

# 環境変数からRedis接続URLを取得 (デフォルトはDockerネットワーク内のサービス名)
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

# キャッシュの有効期限 (秒)
CACHE_TTL = 3600

def _get_client() -> redis.Redis | None:
    """
    Redisクライアントを取得する。
    接続に失敗した場合はNoneを返す (Graceful Degradation)。
    """
    try:
        client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        client.ping()
        return client
    except Exception as e:
        print(f"[Cache] Redis connection failed: {e}", file=sys.stderr)
        return None


def get_prediction(stock_symbol: str) -> dict | None:
    """
    キャッシュから予測結果を取得する。

    Args:
        stock_symbol: 証券コード (例: "7203.T")

    Returns:
        キャッシュヒット時はdict、ミス時またはRedis障害時はNone
    """
    client = _get_client()
    if client is None:
        return None

    try:
        key = f"predict:{stock_symbol}"
        cached = client.get(key)
        if cached:
            print(f"[Cache] HIT: {key}", file=sys.stdout)
            return json.loads(cached)
        print(f"[Cache] MISS: {key}", file=sys.stdout)
        return None
    except Exception as e:
        print(f"[Cache] GET error for {stock_symbol}: {e}", file=sys.stderr)
        return None


def set_prediction(stock_symbol: str, data: dict) -> None:
    """
    予測結果をキャッシュに保存する。

    Args:
        stock_symbol: 証券コード
        data: キャッシュするdictデータ (PredictionResponseのフィールド)
    """
    client = _get_client()
    if client is None:
        return

    try:
        key = f"predict:{stock_symbol}"
        client.setex(key, CACHE_TTL, json.dumps(data))
        print(f"[Cache] SET: {key} (TTL={CACHE_TTL}s)", file=sys.stdout)
    except Exception as e:
        print(f"[Cache] SET error for {stock_symbol}: {e}", file=sys.stderr)
