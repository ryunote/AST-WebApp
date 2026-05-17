from typing import List, Literal
from pydantic import BaseModel


class Article(BaseModel):
    title: str
    description: str
    url: str
    published_at: str


class InsightResponse(BaseModel):
    symbol: str
    sentiment: Literal["positive", "negative", "neutral"]
    summary: str
    key_events: List[str]
    risk_factors: List[str]
    news_count: int
    cached: bool
