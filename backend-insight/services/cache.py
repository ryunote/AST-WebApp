import json
import os
import sys
from typing import Optional

import redis

from schemas.market import InsightResponse

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
CACHE_TTL = 10800  # 3時間


def _get_client() -> Optional[redis.Redis]:
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


def get_insight(symbol: str) -> Optional[InsightResponse]:
    """
    Redisからインサイトキャッシュを取得する。

    Args:
        symbol: 証券コード

    Returns:
        キャッシュHIT時はInsightResponse、MISS/エラー時はNone
    """
    client = _get_client()
    if client is None:
        return None

    try:
        key = f"insight:market:{symbol}"
        data = client.get(key)
        if data is None:
            print(f"[Cache] MISS: {key}", file=sys.stdout)
            return None
        print(f"[Cache] HIT: {key}", file=sys.stdout)
        # cachedフィールドはset時に除外して保存するため、deserialize時はFalseで補完
        return InsightResponse(**json.loads(data), cached=False)
    except Exception as e:
        print(f"[Cache] GET error for {symbol}: {e}", file=sys.stderr)
        return None


def set_insight(symbol: str, insight: InsightResponse) -> None:
    """
    インサイトをRedisにキャッシュする。

    Args:
        symbol: 証券コード
        insight: キャッシュするInsightResponse
    """
    client = _get_client()
    if client is None:
        return

    try:
        key = f"insight:market:{symbol}"
        # cachedフィールドはレスポンス時に動的に付与するため保存しない
        data = insight.model_dump(exclude={"cached"})
        client.setex(key, CACHE_TTL, json.dumps(data))
        print(f"[Cache] SET: {key} (TTL={CACHE_TTL}s)", file=sys.stdout)
    except Exception as e:
        print(f"[Cache] SET error for {symbol}: {e}", file=sys.stderr)
