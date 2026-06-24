"""Ingestion pipeline + CLI.

Run manually or via cron:

    python -m app.ingest --window day
    python -m app.ingest --window week
    python -m app.ingest --window month

The pipeline is idempotent: posts are upserted on `reddit_id`, so re-running a
window never creates duplicates. Embeddings are only generated for posts that do
not already have one.
"""

import argparse
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db import init_db, session_scope
from app.embeddings import embed_documents
from app.models import PostEmbedding, RedditPost
from app.reddit_client import VALID_WINDOWS, FetchedPost, fetch_request_posts


@dataclass
class IngestResult:
    window: str
    fetched: int
    new_posts: int
    embedded: int


def _embedding_text(post: RedditPost) -> str:
    """Text used to represent a post for embedding."""
    body = (post.body or "").strip()
    return f"{post.title}\n\n{body}".strip() if body else post.title


def _upsert_posts(session: Session, posts: list[FetchedPost]) -> int:
    """Upsert fetched posts on reddit_id. Returns count of newly inserted rows."""
    if not posts:
        return 0

    rows = [
        {
            "reddit_id": p.reddit_id,
            "title": p.title,
            "body": p.body,
            "author": p.author,
            "created_at": p.created_at,
            "num_comments": p.num_comments,
            "url": p.url,
        }
        for p in posts
    ]

    stmt = pg_insert(RedditPost).values(rows)
    # On conflict, refresh the volatile fields but keep the original row/id.
    stmt = stmt.on_conflict_do_update(
        index_elements=["reddit_id"],
        set_={
            "title": stmt.excluded.title,
            "body": stmt.excluded.body,
            "num_comments": stmt.excluded.num_comments,
            "url": stmt.excluded.url,
        },
    ).returning(RedditPost.reddit_id, RedditPost.id, RedditPost.ingested_at)

    before = {
        rid
        for (rid,) in session.execute(
            select(RedditPost.reddit_id).where(
                RedditPost.reddit_id.in_([p.reddit_id for p in posts])
            )
        )
    }
    session.execute(stmt)
    session.flush()
    after = {
        rid
        for (rid,) in session.execute(
            select(RedditPost.reddit_id).where(
                RedditPost.reddit_id.in_([p.reddit_id for p in posts])
            )
        )
    }
    return len(after - before)


def _embed_missing(session: Session) -> int:
    """Generate embeddings for posts that don't have one yet. Returns count."""
    missing = (
        session.execute(
            select(RedditPost)
            .outerjoin(PostEmbedding, PostEmbedding.post_id == RedditPost.id)
            .where(PostEmbedding.post_id.is_(None))
        )
        .scalars()
        .all()
    )
    if not missing:
        return 0

    vectors = embed_documents([_embedding_text(p) for p in missing])
    for post, vector in zip(missing, vectors, strict=True):
        session.add(PostEmbedding(post_id=post.id, embedding=vector))
    session.flush()
    return len(missing)


def run_ingest(window: str, limit: int | None = None) -> IngestResult:
    init_db()
    posts = list(fetch_request_posts(window, limit=limit))
    with session_scope() as session:
        new_posts = _upsert_posts(session, posts)
        embedded = _embed_missing(session)
    return IngestResult(
        window=window,
        fetched=len(posts),
        new_posts=new_posts,
        embedded=embedded,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest [Request] posts from Reddit.")
    parser.add_argument(
        "--window",
        choices=VALID_WINDOWS,
        default="day",
        help="Time window to fetch (start with 'day', scale to 'week'/'month').",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional cap on number of posts fetched (useful for testing).",
    )
    args = parser.parse_args()

    result = run_ingest(args.window, limit=args.limit)
    print(
        f"[ingest] window={result.window} fetched={result.fetched} "
        f"new_posts={result.new_posts} embedded={result.embedded}"
    )


if __name__ == "__main__":
    main()
