"""SQLAlchemy ORM models matching the plan's schema."""

import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.config import settings


class Base(DeclarativeBase):
    pass


class RedditPost(Base):
    __tablename__ = "reddit_posts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reddit_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    title: Mapped[str] = mapped_column(Text)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    author: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    num_comments: Mapped[int] = mapped_column(Integer, default=0)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)

    embedding: Mapped["PostEmbedding"] = relationship(
        back_populates="post",
        uselist=False,
        cascade="all, delete-orphan",
    )


class PostEmbedding(Base):
    __tablename__ = "post_embeddings"

    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reddit_posts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dim))
    retrieval_count: Mapped[int] = mapped_column(Integer, default=0)
    last_retrieved: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    post: Mapped[RedditPost] = relationship(back_populates="embedding")
