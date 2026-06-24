"""Application configuration loaded from environment variables / .env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql+psycopg://raoc:raoc@localhost:5432/raoc"

    # Data source: Arctic Shift (Pushshift successor) — no API key required.
    # https://arctic-shift.photon-reddit.com
    arctic_shift_base_url: str = "https://arctic-shift.photon-reddit.com"
    http_timeout: float = 30.0
    subreddit: str = "RandomActsofCards"
    request_tag: str = "[Request]"

    # Embeddings (local model)
    embedding_model: str = "BAAI/bge-large-en-v1.5"
    embedding_dim: int = 1024

    # LLM (Google Gemini)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    # Retry behavior for transient Gemini errors (e.g. 503 high demand, 429 rate limit).
    gemini_max_retries: int = 4
    gemini_retry_base_delay: float = 1.0
    gemini_retry_max_delay: float = 16.0

    # RAG retrieval
    retrieval_top_n: int = 20
    rag_query: str = "What has this community been requesting lately?"

    # API server
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
