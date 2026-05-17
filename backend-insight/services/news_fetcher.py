from typing import List

import httpx

from schemas.market import Article

MAX_DESCRIPTION_LENGTH = 500


class NewsAPIAuthError(Exception):
    """APIキーが無効（HTTP 401）。"""


class NewsAPIRateLimitError(Exception):
    """レートリミット超過（HTTP 429）。"""


class NewsAPIError(Exception):
    """NewsAPI呼び出しの汎用エラー。"""


class NewsFetcher:
    """
    NewsAPI.orgからニュース記事を取得するサービス。

    Args:
        api_key: NewsAPI APIキー

    Raises:
        ValueError: api_keyが空の場合
    """

    _BASE_URL = "https://newsapi.org/v2/everything"

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ValueError("NewsAPI API key is required")
        self._api_key = api_key

    def fetch(self, company_name: str) -> List[Article]:
        """
        会社名でニュース記事を取得する。

        Args:
            company_name: 検索キーワード（社名）

        Returns:
            List[Article]: ニュース記事リスト（0件の場合は空リスト）

        Raises:
            NewsAPIAuthError: HTTP 401
            NewsAPIRateLimitError: HTTP 429
            NewsAPIError: その他のHTTPエラー・通信障害・レスポンス構造異常
        """
        params = {
            "q": company_name,
            "language": "en",
            "sortBy": "publishedAt",
            "pageSize": 10,
            "apiKey": self._api_key,
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                response = client.get(self._BASE_URL, params=params)
        except httpx.TimeoutException as e:
            raise NewsAPIError(f"Request timed out: {e}") from e
        except httpx.RequestError as e:
            raise NewsAPIError(f"Request failed: {e}") from e

        if response.status_code == 401:
            raise NewsAPIAuthError("Invalid NewsAPI key")
        if response.status_code == 429:
            raise NewsAPIRateLimitError("NewsAPI rate limit exceeded")
        if response.status_code >= 400:
            raise NewsAPIError(f"NewsAPI error: HTTP {response.status_code}")

        try:
            articles_data = response.json()["articles"]
        except (KeyError, ValueError) as e:
            raise NewsAPIError(f"Invalid response structure: {e}") from e

        return [self._to_article(item) for item in articles_data]

    def _to_article(self, item: dict) -> Article:
        description = item.get("description") or ""
        if len(description) > MAX_DESCRIPTION_LENGTH:
            description = description[:MAX_DESCRIPTION_LENGTH]
        return Article(
            title=item.get("title", ""),
            description=description,
            url=item.get("url", ""),
            published_at=item.get("publishedAt", ""),
        )
