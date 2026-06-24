"""Thin wrapper around the Google Gemini API (google-genai)."""

import logging
import random
import time
from functools import lru_cache

from app.config import settings

logger = logging.getLogger(__name__)

# HTTP status codes worth retrying: 429 (rate limit) and 5xx (transient server).
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class LLMUnavailableError(RuntimeError):
    """Raised when the LLM is unavailable after exhausting retries."""


@lru_cache(maxsize=1)
def _get_client():
    from google import genai

    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Create one at "
            "https://aistudio.google.com/api-keys and add it to your .env."
        )
    return genai.Client(api_key=settings.gemini_api_key)


def _is_retryable(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    return code in _RETRYABLE_STATUS


def generate(prompt: str) -> str:
    """Send a single prompt to Gemini and return the text response.

    Retries transient failures (429/5xx) with exponential backoff and jitter.
    """
    from google.genai import errors as genai_errors

    client = _get_client()
    last_exc: Exception | None = None

    for attempt in range(settings.gemini_max_retries + 1):
        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
            )
            return (response.text or "").strip()
        except genai_errors.APIError as exc:
            last_exc = exc
            if not _is_retryable(exc) or attempt == settings.gemini_max_retries:
                break
            delay = min(
                settings.gemini_retry_base_delay * (2**attempt),
                settings.gemini_retry_max_delay,
            )
            delay += random.uniform(0, delay * 0.25)
            logger.warning(
                "Gemini request failed (attempt %d/%d, code=%s); retrying in %.1fs",
                attempt + 1,
                settings.gemini_max_retries + 1,
                getattr(exc, "code", "?"),
                delay,
            )
            time.sleep(delay)

    raise LLMUnavailableError(
        "Gemini is temporarily unavailable after "
        f"{settings.gemini_max_retries + 1} attempts. Please try again shortly."
    ) from last_exc
