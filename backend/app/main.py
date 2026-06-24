"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import analysis, ingest


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="RAOC Community Voices API",
    description="Ingestion, RAG retrieval, A/B generation, and analytics for r/RandomActsofCards.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router, tags=["analysis"])
app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
