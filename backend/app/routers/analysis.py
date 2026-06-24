"""Endpoints for A/B generation and analytics panels."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import analytics
from app.db import get_session
from app.generation import generate_ab
from app.llm import LLMUnavailableError
from app.schemas import (
    ABResponse,
    RetrievalStatOut,
    RetrievedPostOut,
    ScatterPointOut,
    TrendsOut,
)

router = APIRouter()


@router.get("/ab", response_model=ABResponse)
def ab_comparison(
    top_n: int | None = Query(default=None, ge=1, le=100),
    track: bool = Query(default=True),
    session: Session = Depends(get_session),
) -> ABResponse:
    """Run the plain-LLM vs RAG-grounded comparison."""
    try:
        result = generate_ab(session, top_n=top_n, track=track)
    except LLMUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ABResponse(
        plain=result.plain,
        rag=result.rag,
        context_post_count=result.context_post_count,
        retrieved=[
            RetrievedPostOut(
                post_id=r.post_id,
                reddit_id=r.reddit_id,
                title=r.title,
                url=r.url,
                distance=r.distance,
            )
            for r in result.retrieved
        ],
    )


@router.get("/trends", response_model=TrendsOut)
def trends(
    keyword_limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> TrendsOut:
    data = analytics.get_trends(session, keyword_limit=keyword_limit)
    return TrendsOut.model_validate(data, from_attributes=True)


@router.get("/embeddings/scatter", response_model=list[ScatterPointOut])
def embedding_scatter(
    n_clusters: int = Query(default=5, ge=1, le=20),
    session: Session = Depends(get_session),
) -> list[ScatterPointOut]:
    points = analytics.get_embedding_scatter(session, n_clusters=n_clusters)
    return [ScatterPointOut.model_validate(p, from_attributes=True) for p in points]


@router.get("/retrieval-stats", response_model=list[RetrievalStatOut])
def retrieval_stats(
    limit: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
) -> list[RetrievalStatOut]:
    stats = analytics.get_retrieval_stats(session, limit=limit)
    return [RetrievalStatOut.model_validate(s, from_attributes=True) for s in stats]
