"""Pydantic response models for the API."""

from pydantic import BaseModel


class RetrievedPostOut(BaseModel):
    post_id: str
    reddit_id: str
    title: str
    url: str | None = None
    distance: float


class ABResponse(BaseModel):
    plain: str
    rag: str
    context_post_count: int
    retrieved: list[RetrievedPostOut]


class TrendPointOut(BaseModel):
    date: str
    post_count: int
    total_comments: int


class KeywordCountOut(BaseModel):
    keyword: str
    count: int


class TrendsOut(BaseModel):
    total_posts: int
    volume_over_time: list[TrendPointOut]
    top_keywords: list[KeywordCountOut]


class ScatterPointOut(BaseModel):
    post_id: str
    title: str
    x: float
    y: float
    cluster: int


class RetrievalStatOut(BaseModel):
    post_id: str
    reddit_id: str
    title: str
    url: str | None = None
    retrieval_count: int
    last_retrieved: str | None = None


class IngestRequest(BaseModel):
    window: str = "day"
    limit: int | None = None


class IngestResponse(BaseModel):
    window: str
    fetched: int
    new_posts: int
    embedded: int
