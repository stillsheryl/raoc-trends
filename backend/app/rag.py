"""RAG retrieval: cosine similarity search over post embeddings.

Retrieving a post increments its `retrieval_count` and updates `last_retrieved`
(plan requirement 3c).
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import settings
from app.embeddings import embed_query
from app.models import PostEmbedding, RedditPost


@dataclass
class RetrievedPost:
    post_id: str
    reddit_id: str
    title: str
    body: str
    author: str | None
    created_at: datetime
    num_comments: int
    url: str | None
    distance: float


def retrieve(
    session: Session,
    query: str | None = None,
    top_n: int | None = None,
    track: bool = True,
) -> list[RetrievedPost]:
    """Return the top-N most similar posts to the analysis query.

    Uses pgvector's cosine distance operator (`<=>`). Lower distance = closer.
    """
    query = query or settings.rag_query
    top_n = top_n or settings.retrieval_top_n

    query_vector = embed_query(query)
    distance = PostEmbedding.embedding.cosine_distance(query_vector).label("distance")

    rows = (
        session.query(RedditPost, distance)
        .join(PostEmbedding, PostEmbedding.post_id == RedditPost.id)
        .order_by(distance)
        .limit(top_n)
        .all()
    )

    results = [
        RetrievedPost(
            post_id=str(post.id),
            reddit_id=post.reddit_id,
            title=post.title,
            body=post.body or "",
            author=post.author,
            created_at=post.created_at,
            num_comments=post.num_comments,
            url=post.url,
            distance=float(dist),
        )
        for post, dist in rows
    ]

    if track and results:
        post_ids = [r.post_id for r in results]
        session.execute(
            update(PostEmbedding)
            .where(PostEmbedding.post_id.in_(post_ids))
            .values(
                retrieval_count=PostEmbedding.retrieval_count + 1,
                last_retrieved=datetime.now(UTC),
            )
        )
        session.commit()

    return results
