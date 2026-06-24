"""Reddit ingestion via the Arctic Shift archive API.

Reddit's official/unauthenticated APIs are no longer accessible for this kind of
project, so we read the same r/RandomActsofCards data from Arctic Shift, a
maintained Pushshift successor that exposes a free, no-auth REST API.

We fetch submissions from the subreddit scoped to a day / week / month window
and apply the strict `[Request]` title filter locally (case-insensitive).

Docs: https://github.com/ArthurHeitmann/arctic_shift/blob/master/api/README.md
"""

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime

import requests

from app.config import settings

TimeWindow = str  # "day" | "week" | "month"
VALID_WINDOWS = ("day", "week", "month")

# Map each window to an Arctic Shift relative-time offset for the `after` param.
_WINDOW_OFFSET = {"day": "1d", "week": "7d", "month": "30d"}

# Max page size allowed by the API; we paginate by created_utc beyond this.
_PAGE_SIZE = 100
_FIELDS = "id,title,selftext,author,created_utc,num_comments"


@dataclass
class FetchedPost:
    reddit_id: str
    title: str
    body: str
    author: str | None
    created_at: datetime
    num_comments: int
    url: str


def _matches_request_filter(title: str) -> bool:
    return settings.request_tag.lower() in (title or "").lower()


def _post_url(reddit_id: str) -> str:
    return f"https://www.reddit.com/r/{settings.subreddit}/comments/{reddit_id}"


def _to_fetched(raw: dict) -> FetchedPost:
    author = raw.get("author")
    if author in (None, "[deleted]", "[removed]"):
        author = None
    return FetchedPost(
        reddit_id=raw["id"],
        title=raw.get("title") or "",
        body=raw.get("selftext") or "",
        author=author,
        created_at=datetime.fromtimestamp(float(raw["created_utc"]), tz=UTC),
        num_comments=int(raw.get("num_comments") or 0),
        url=_post_url(raw["id"]),
    )


def _request_page(session: requests.Session, after: str | int) -> list[dict]:
    resp = session.get(
        f"{settings.arctic_shift_base_url}/api/posts/search",
        params={
            "subreddit": settings.subreddit,
            "after": after,
            "limit": _PAGE_SIZE,
            "sort": "asc",
            "fields": _FIELDS,
        },
        timeout=settings.http_timeout,
    )
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("error"):
        raise RuntimeError(f"Arctic Shift API error: {payload['error']}")
    return payload.get("data") or []


def fetch_request_posts(window: TimeWindow, limit: int | None = None) -> Iterator[FetchedPost]:
    """Yield `[Request]` posts within the given time window.

    Pages through Arctic Shift ascending by `created_utc`, deduping on post id,
    and applies the strict `[Request]` title filter locally.
    """
    if window not in VALID_WINDOWS:
        raise ValueError(f"window must be one of {VALID_WINDOWS}, got {window!r}")

    session = requests.Session()
    after: str | int = _WINDOW_OFFSET[window]
    seen: set[str] = set()
    yielded = 0

    while True:
        page = _request_page(session, after)
        if not page:
            break

        new_in_page = 0
        last_created: float | None = None
        for raw in page:
            last_created = float(raw["created_utc"])
            rid = raw["id"]
            if rid in seen:
                continue
            seen.add(rid)
            new_in_page += 1
            if _matches_request_filter(raw.get("title") or ""):
                yield _to_fetched(raw)
                yielded += 1
                if limit is not None and yielded >= limit:
                    return

        # Stop when the page isn't full (reached the end) or we made no progress.
        if len(page) < _PAGE_SIZE or new_in_page == 0 or last_created is None:
            break
        # Advance the cursor; reuse the same second to avoid skipping ties
        # (dedupe via `seen` prevents reprocessing).
        after = int(last_created)
