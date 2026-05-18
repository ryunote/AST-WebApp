"""
services/llm_client.py のユニットテスト。

google-generativeai SDKをモック化し、ネットワーク通信なしで全分岐を検証する。

テストケース対応:
  LC-01: 記事リスト空                    → no-news InsightResponse
  LC-02: 記事あり / 純正JSON正常         → InsightResponse（全4フィールド）
  LC-03: 記事あり / マークダウンラップ   → JSON抽出して正常パース
  LC-04: 記事あり / 完全非JSON           → LLMParseError
  LC-05: 記事あり / 必須フィールド欠損   → LLMParseError
  LC-06: 記事あり / sentiment不正値      → LLMParseError
  LC-07: PermissionDenied                → LLMAuthError
  LC-08: ResourceExhausted               → LLMRateLimitError
  LC-09: ネットワーク/汎用エラー        → LLMError
"""

import json
import pytest
from unittest.mock import MagicMock, patch

from google.api_core.exceptions import PermissionDenied, ResourceExhausted  # google-genai も同じ例外クラスを使用

from schemas.market import Article
from services.llm_client import (
    LLMAuthError,
    LLMClient,
    LLMError,
    LLMParseError,
    LLMRateLimitError,
)

_SAMPLE_ARTICLES = [
    Article(
        title="Toyota beats Q1 forecast",
        description="Strong EV sales drove revenue.",
        url="http://example.com/1",
        published_at="2026-05-17T00:00:00Z",
    )
]

_VALID_JSON_RESPONSE = json.dumps({
    "sentiment": "positive",
    "summary": "トヨタが好調な決算を発表",
    "key_events": ["Q1増収増益"],
    "risk_factors": ["EV競争激化"],
})


@pytest.fixture
def llm_client_and_mock_models():
    """LLMClientインスタンスとgenai.Client.models モックのペアを返すフィクスチャ。"""
    with patch("services.llm_client.genai.Client") as MockClientClass:
        mock_genai_client = MagicMock()
        MockClientClass.return_value = mock_genai_client
        client = LLMClient(api_key="test-key")
        yield client, mock_genai_client.models


class TestLLMClientAnalyze:
    # ── LC-01 ──────────────────────────────────────────────────────────────
    def test_lc01_empty_articles_returns_no_news_response(self, llm_client_and_mock_models):
        """記事リストが空の場合、Geminiを呼ばずno-news InsightResponseを返すこと。"""
        client, mock_models = llm_client_and_mock_models
        result = client.analyze([])

        mock_models.generate_content.assert_not_called()
        assert result.sentiment == "neutral"
        assert result.news_count == 0
        assert result.key_events == []
        assert result.risk_factors == []

    # ── LC-02 ──────────────────────────────────────────────────────────────
    def test_lc02_valid_json_response_returns_insight(self, llm_client_and_mock_models):
        """Geminiが純正JSONを返した場合、全4フィールドを持つInsightResponseを返すこと。"""
        client, mock_models = llm_client_and_mock_models
        mock_models.generate_content.return_value = MagicMock(text=_VALID_JSON_RESPONSE)

        result = client.analyze(_SAMPLE_ARTICLES)

        assert result.sentiment == "positive"
        assert result.summary == "トヨタが好調な決算を発表"
        assert result.key_events == ["Q1増収増益"]
        assert result.risk_factors == ["EV競争激化"]
        assert result.news_count == len(_SAMPLE_ARTICLES)

    # ── LC-03 ──────────────────────────────────────────────────────────────
    def test_lc03_markdown_wrapped_json_is_parsed_correctly(self, llm_client_and_mock_models):
        """GeminiがマークダウンコードブロックでラップしたJSONを正常にパースすること。"""
        client, mock_models = llm_client_and_mock_models
        wrapped = f"```json\n{_VALID_JSON_RESPONSE}\n```"
        mock_models.generate_content.return_value = MagicMock(text=wrapped)

        result = client.analyze(_SAMPLE_ARTICLES)

        assert result.sentiment == "positive"
        assert result.summary == "トヨタが好調な決算を発表"

    # ── LC-04 ──────────────────────────────────────────────────────────────
    def test_lc04_non_json_response_raises_parse_error(self, llm_client_and_mock_models):
        """Geminiが完全な非JSONテキストを返した場合LLMParseErrorを送出すること。"""
        client, mock_models = llm_client_and_mock_models
        mock_models.generate_content.return_value = MagicMock(
            text="I cannot analyze this article at this time."
        )

        with pytest.raises(LLMParseError):
            client.analyze(_SAMPLE_ARTICLES)

    # ── LC-05 ──────────────────────────────────────────────────────────────
    def test_lc05_missing_required_field_raises_parse_error(self, llm_client_and_mock_models):
        """JSONパース成功でも必須フィールドが欠損している場合LLMParseErrorを送出すること。"""
        client, mock_models = llm_client_and_mock_models
        incomplete_json = json.dumps({"sentiment": "positive"})  # summary等が欠損
        mock_models.generate_content.return_value = MagicMock(text=incomplete_json)

        with pytest.raises(LLMParseError, match="Missing required field"):
            client.analyze(_SAMPLE_ARTICLES)

    # ── LC-06 ──────────────────────────────────────────────────────────────
    def test_lc06_invalid_sentiment_value_raises_parse_error(self, llm_client_and_mock_models):
        """sentimentが想定外の値（例: "bullish"）の場合LLMParseErrorを送出すること。"""
        client, mock_models = llm_client_and_mock_models
        invalid_json = json.dumps({
            "sentiment": "bullish",  # 不正値
            "summary": "test",
            "key_events": [],
            "risk_factors": [],
        })
        mock_models.generate_content.return_value = MagicMock(text=invalid_json)

        with pytest.raises(LLMParseError, match="Invalid sentiment"):
            client.analyze(_SAMPLE_ARTICLES)

    # ── LC-07 ──────────────────────────────────────────────────────────────
    def test_lc07_permission_denied_raises_llm_auth_error(self, llm_client_and_mock_models):
        """PermissionDenied例外はLLMAuthErrorとして再送出されること。"""
        client, mock_models = llm_client_and_mock_models
        mock_models.generate_content.side_effect = PermissionDenied("Invalid API key")

        with pytest.raises(LLMAuthError):
            client.analyze(_SAMPLE_ARTICLES)

    # ── LC-08 ──────────────────────────────────────────────────────────────
    def test_lc08_resource_exhausted_raises_llm_rate_limit_error(
        self, llm_client_and_mock_models
    ):
        """ResourceExhausted例外はLLMRateLimitErrorとして再送出されること。"""
        client, mock_models = llm_client_and_mock_models
        mock_models.generate_content.side_effect = ResourceExhausted("quota exceeded")

        with pytest.raises(LLMRateLimitError):
            client.analyze(_SAMPLE_ARTICLES)

    # ── LC-09 ──────────────────────────────────────────────────────────────
    def test_lc09_generic_exception_raises_llm_error(self, llm_client_and_mock_models):
        """その他の予期しない例外はLLMErrorとして再送出されること。"""
        client, mock_models = llm_client_and_mock_models
        mock_models.generate_content.side_effect = ConnectionError("network error")

        with pytest.raises(LLMError):
            client.analyze(_SAMPLE_ARTICLES)
