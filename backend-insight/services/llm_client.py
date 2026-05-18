import json
import re
import sys
from typing import List

from google import genai
from google.api_core.exceptions import PermissionDenied, ResourceExhausted

from schemas.market import Article, InsightResponse

_NO_NEWS_RESPONSE_SUMMARY = "該当するニュースが見つかりませんでした"


class LLMAuthError(Exception):
    """Gemini APIキー認証エラー。"""


class LLMRateLimitError(Exception):
    """Gemini APIレートリミット超過。"""


class LLMParseError(Exception):
    """LLMレスポンスのJSONパース・バリデーション失敗。"""


class LLMError(Exception):
    """Gemini APIの汎用エラー。"""


_SYSTEM_PROMPT = """
あなたは株式市場の定性分析エージェントです。
与えられたニュース記事を分析し、必ず以下のJSONフォーマットのみで応答してください。
余分なテキストやマークダウンは一切不要です。

{
  "sentiment": "positive" | "negative" | "neutral",
  "summary": "100文字以内の日本語要約",
  "key_events": ["イベント1", "イベント2"],
  "risk_factors": ["リスク1", "リスク2"]
}
"""

_VALID_SENTIMENTS = {"positive", "negative", "neutral"}


class LLMClient:
    """
    Google Gemini APIを使ったニュース感情分析クライアント。

    Args:
        api_key: Google Gemini APIキー
    """

    def __init__(self, api_key: str) -> None:
        self._client = genai.Client(api_key=api_key)

    def analyze(self, articles: List[Article]) -> InsightResponse:
        """
        ニュース記事リストを分析し、InsightResponseを返す。

        Args:
            articles: 分析対象の記事リスト（空リスト可）

        Returns:
            InsightResponse: 感情分析・要約・イベント・リスク

        Raises:
            LLMAuthError: APIキー認証エラー
            LLMRateLimitError: レートリミット超過
            LLMParseError: レスポンスのパース・バリデーション失敗
            LLMError: その他のGemini APIエラー
        """
        if not articles:
            return InsightResponse(
                symbol="",
                sentiment="neutral",
                summary=_NO_NEWS_RESPONSE_SUMMARY,
                key_events=[],
                risk_factors=[],
                news_count=0,
                cached=False,
            )

        news_text = "\n\n".join(
            f"タイトル: {a.title}\n内容: {a.description}" for a in articles
        )
        prompt = f"{_SYSTEM_PROMPT}\n\n分析対象ニュース:\n{news_text}"

        try:
            response = self._client.models.generate_content(
                model="gemini-2.5-flash", contents=prompt
            )
            raw_text = response.text
        except PermissionDenied as e:
            raise LLMAuthError(f"Gemini auth error: {e}") from e
        except ResourceExhausted as e:
            raise LLMRateLimitError(f"Gemini rate limit: {e}") from e
        except Exception as e:
            print(f"[LLMClient] Unexpected error: {e}", file=sys.stderr)
            raise LLMError(f"Gemini error: {e}") from e

        return self._parse_response(raw_text, len(articles))

    def _parse_response(self, raw_text: str, news_count: int) -> InsightResponse:
        # マークダウンコードブロック（```json ... ```）を除去
        json_text = re.sub(r"```(?:json)?\s*|\s*```", "", raw_text).strip()

        try:
            data = json.loads(json_text)
        except json.JSONDecodeError as e:
            raise LLMParseError(f"Failed to parse LLM response as JSON: {raw_text!r}") from e

        sentiment = data.get("sentiment")
        if sentiment not in _VALID_SENTIMENTS:
            raise LLMParseError(f"Invalid sentiment value: {sentiment!r}")

        for field in ("summary", "key_events", "risk_factors"):
            if field not in data:
                raise LLMParseError(f"Missing required field: {field!r}")

        return InsightResponse(
            symbol="",
            sentiment=sentiment,
            summary=data["summary"],
            key_events=data["key_events"],
            risk_factors=data["risk_factors"],
            news_count=news_count,
            cached=False,
        )
