"""Endpoint to trigger ingestion on demand (mirrors the CLI)."""

from fastapi import APIRouter, HTTPException

from app.ingest import run_ingest
from app.reddit_client import VALID_WINDOWS
from app.schemas import IngestRequest, IngestResponse

router = APIRouter()


@router.post("/run", response_model=IngestResponse)
def trigger_ingest(req: IngestRequest) -> IngestResponse:
    if req.window not in VALID_WINDOWS:
        raise HTTPException(
            status_code=422,
            detail=f"window must be one of {VALID_WINDOWS}",
        )
    result = run_ingest(req.window, limit=req.limit)
    return IngestResponse(
        window=result.window,
        fetched=result.fetched,
        new_posts=result.new_posts,
        embedded=result.embedded,
    )
