"""Analytics powering the dashboard panels.

- Trends: post volume over time, comment engagement, top title keywords
- Embedding scatter: 2D projection (PCA) colored by k-means cluster id
- Retrieval stats: posts with the highest retrieval_count
"""

import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date

import numpy as np
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models import PostEmbedding, RedditPost

# Minimal stopword set for title keyword extraction.
_STOPWORDS = {
    "request", "the", "a", "an", "and", "or", "for", "to", "of", "in", "on",
    "my", "me", "i", "is", "are", "was", "were", "be", "been", "with", "at",
    "by", "from", "as", "it", "this", "that", "these", "those", "you", "your",
    "would", "could", "some", "any", "im", "ive", "id", "we", "us", "our",
    "can", "will", "just", "out", "up", "if", "but", "so", "about", "who",
    "anyone", "looking", "please", "card", "cards",
}
_WORD_RE = re.compile(r"[a-zA-Z']+")


@dataclass
class TrendPoint:
    date: str
    post_count: int
    total_comments: int


@dataclass
class KeywordCount:
    keyword: str
    count: int


@dataclass
class TrendsResponse:
    total_posts: int
    volume_over_time: list[TrendPoint] = field(default_factory=list)
    top_keywords: list[KeywordCount] = field(default_factory=list)


@dataclass
class ScatterPoint:
    post_id: str
    title: str
    x: float
    y: float
    cluster: int


@dataclass
class RetrievalStat:
    post_id: str
    reddit_id: str
    title: str
    url: str | None
    retrieval_count: int
    last_retrieved: str | None


def get_trends(session: Session, keyword_limit: int = 20) -> TrendsResponse:
    total = session.scalar(select(func.count(RedditPost.id))) or 0

    volume_rows = session.execute(
        select(
            func.date(RedditPost.created_at).label("day"),
            func.count(RedditPost.id).label("posts"),
            func.coalesce(func.sum(RedditPost.num_comments), 0).label("comments"),
        )
        .group_by(func.date(RedditPost.created_at))
        .order_by(func.date(RedditPost.created_at))
    ).all()

    volume = [
        TrendPoint(
            date=(d.isoformat() if isinstance(d, date) else str(d)),
            post_count=int(posts),
            total_comments=int(comments),
        )
        for d, posts, comments in volume_rows
    ]

    titles = session.execute(select(RedditPost.title)).scalars().all()
    counter: Counter[str] = Counter()
    for title in titles:
        for word in _WORD_RE.findall((title or "").lower()):
            if len(word) > 2 and word not in _STOPWORDS:
                counter[word] += 1
    top_keywords = [
        KeywordCount(keyword=w, count=c) for w, c in counter.most_common(keyword_limit)
    ]

    return TrendsResponse(
        total_posts=int(total),
        volume_over_time=volume,
        top_keywords=top_keywords,
    )


def get_embedding_scatter(session: Session, n_clusters: int = 5) -> list[ScatterPoint]:
    """Project embeddings to 2D via PCA and color by k-means cluster id."""
    rows = session.execute(
        select(RedditPost.id, RedditPost.title, PostEmbedding.embedding).join(
            PostEmbedding, PostEmbedding.post_id == RedditPost.id
        )
    ).all()

    if not rows:
        return []

    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA

    ids = [str(r[0]) for r in rows]
    titles = [r[1] for r in rows]
    matrix = np.asarray([r[2] for r in rows], dtype=np.float32)

    n_samples = matrix.shape[0]
    coords = PCA(n_components=2, random_state=42).fit_transform(matrix)

    if n_samples >= 2:
        k = max(1, min(n_clusters, n_samples))
        clusters = KMeans(n_clusters=k, random_state=42, n_init="auto").fit_predict(matrix)
    else:
        clusters = np.zeros(n_samples, dtype=int)

    return [
        ScatterPoint(
            post_id=ids[i],
            title=titles[i],
            x=float(coords[i, 0]),
            y=float(coords[i, 1]),
            cluster=int(clusters[i]),
        )
        for i in range(n_samples)
    ]


def get_retrieval_stats(session: Session, limit: int = 20) -> list[RetrievalStat]:
    rows = session.execute(
        select(RedditPost, PostEmbedding)
        .join(PostEmbedding, PostEmbedding.post_id == RedditPost.id)
        .order_by(desc(PostEmbedding.retrieval_count))
        .limit(limit)
    ).all()

    return [
        RetrievalStat(
            post_id=str(post.id),
            reddit_id=post.reddit_id,
            title=post.title,
            url=post.url,
            retrieval_count=emb.retrieval_count,
            last_retrieved=emb.last_retrieved.isoformat() if emb.last_retrieved else None,
        )
        for post, emb in rows
    ]
