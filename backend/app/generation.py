"""A/B generation: RAG-grounded vs. plain (no-retrieval) LLM output.

Both calls share the same instruction/output structure so the dashboard can
compare them apples-to-apples (plan requirement 5).
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import settings
from app.llm import generate
from app.rag import RetrievedPost, retrieve

SHARED_INSTRUCTION = """You are analyzing the r/{subreddit} community, which is focused on \
people requesting greeting cards and mail for various life occasions (the \"[Request]\" posts).

Produce a short \"Community Voices\" briefing with exactly these sections:

1. **What the community has been requesting lately** — 3-5 bullet points summarizing \
the dominant themes, occasions, and emotional needs.
2. **Predicted requests for next week** — 3-5 bullet points predicting what the \
community will likely request next, with brief reasoning.
3. **Themes** — 3-5 words describing the dominant themes.
4. **Emotions** — 3-5 words describing the dominant emotions.
5. **Occasions** — 3-5 words describing the dominant occasions.

Be concrete and specific. Keep it under 250 words."""


@dataclass
class GenerationResult:
    plain: str
    rag: str
    context_post_count: int
    retrieved: list[RetrievedPost]


def _format_context(posts: list[RetrievedPost]) -> str:
    lines = []
    for i, p in enumerate(posts, start=1):
        body = (p.body or "").strip().replace("\n", " ")
        snippet = f" — {body[:200]}" if body else ""
        lines.append(f"{i}. {p.title}{snippet}")
    return "\n".join(lines)


def build_plain_prompt() -> str:
    instruction = SHARED_INSTRUCTION.format(subreddit=settings.subreddit)
    return (
        f"{instruction}\n\n"
        "Base your answer only on your general knowledge of this community. "
        "You do not have access to recent posts."
    )


def build_rag_prompt(posts: list[RetrievedPost]) -> str:
    instruction = SHARED_INSTRUCTION.format(subreddit=settings.subreddit)
    context = _format_context(posts)
    return (
        f"{instruction}\n\n"
        "Here are recent, real [Request] posts retrieved from the community. "
        "Ground your answer in this evidence:\n\n"
        f"{context}"
    )


def generate_ab(
    session: Session,
    top_n: int | None = None,
    track: bool = True,
) -> GenerationResult:
    retrieved = retrieve(session, top_n=top_n, track=track)

    plain_output = generate(build_plain_prompt())
    rag_output = generate(build_rag_prompt(retrieved))

    return GenerationResult(
        plain=plain_output,
        rag=rag_output,
        context_post_count=len(retrieved),
        retrieved=retrieved,
    )
