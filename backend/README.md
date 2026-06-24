# RAOC Community Voices — Backend

Python backend for the r/RandomActsofCards "Community Voices" app. It ingests
`[Request]` posts from Reddit (via the Arctic Shift archive), embeds them
locally, runs a RAG retrieval + generation pipeline, and exposes a FastAPI API
for the React dashboard.

## Stack

- **FastAPI** + Uvicorn — HTTP API
- **PostgreSQL + pgvector** — storage & vector similarity search (via Docker)
- **sentence-transformers** (`BAAI/bge-large-en-v1.5`, 1024-dim) — local embeddings
- **Arctic Shift API** (`requests`) — Reddit data ingestion (no API key required)
- **Google Gemini** (`gemini-2.5-flash`) — generation
- **scikit-learn** — PCA + k-means for the embedding scatter panel
- **uv** — dependency & environment management

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for Postgres + pgvector)
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
(`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Python 3.12 (uv can install it for you)

## 1. Install dependencies

```bash
cd backend
uv sync
```

> Note: the first run downloads PyTorch and the BGE embedding model
> (~1.5GB total). On **Intel Macs**, `torch` is pinned to `2.2.x` (the last
> version shipping x86_64 wheels) — this is already handled in `pyproject.toml`.

## 2. Configure environment variables

```bash
cp .env.example .env
```

The only value you **must** set is the Gemini API key.

### Reddit data source (Arctic Shift) — no credentials needed

Reddit's official API approval queue is effectively closed and its
unauthenticated endpoints were blocked in 2026, so we read the same public
r/RandomActsofCards data from [Arctic Shift](https://github.com/ArthurHeitmann/arctic_shift),
a maintained Pushshift successor. Its REST API is free and requires no API key —
the defaults in `.env.example` work as-is. (If the public instance is ever down,
check [https://status.arctic-shift.photon-reddit.com](https://status.arctic-shift.photon-reddit.com).)

### Gemini API key

1. Go to [https://aistudio.google.com/api-keys](https://aistudio.google.com/api-keys).
2. Create an API key and paste it into `.env` as `GEMINI_API_KEY`.

## 3. Start PostgreSQL + pgvector

```bash
docker compose up -d
```

This starts Postgres 16 with the `pgvector` extension available, on
`localhost:5432` with user/password/db all set to `raoc` (matches
`.env.example`). The schema (tables + `vector` extension) is created
automatically on first ingest or API start — no manual migration needed.

## 4. Run the ingestion pipeline

Note that this will take 30-60 seconds to download to your local machine. Start small and scale up:

```bash
uv run python -m app.ingest --window day     # confirm ingestion works
uv run python -m app.ingest --window week    # let trend signal emerge
uv run python -m app.ingest --window month   # only if needed for volume
```

The pipeline is **idempotent** — posts are upserted on `reddit_id` (example URL: https://www.reddit.com/r/RandomActsofCards/comments/{reddit_id}/request_tell_me_the_tea_us/), so reruns
never create duplicates, and embeddings are only generated for new posts.
Use `--limit N` to cap the fetch while testing.

### Weekly cron (keep the store fresh)

**Note**: this is not required for setup, but you can use this if you're interested in setting up a script that runs weekly to fetch new data.

Ready-to-use scripts live in `scripts/`:


| Script                                    | Purpose                                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `scripts/ingest_cron.sh [day|week|month]` | Runs an idempotent ingest (default `week`); cron-safe (resolves paths, finds `uv`, logs to `logs/ingest.log`). |
| `scripts/install_cron.sh`                 | Installs/updates the weekly cron entry (idempotent — no duplicates).                                           |
| `scripts/uninstall_cron.sh`               | Removes the managed cron entry.                                                                                |


Install the weekly job (Mondays at 06:00 by default):

```bash
./scripts/install_cron.sh
```

Customize the schedule or window via env vars:

```bash
RAOC_CRON_SCHEDULE="30 5 * * 1" RAOC_CRON_WINDOW=month ./scripts/install_cron.sh
```

You can also run the ingest wrapper manually any time:

```bash
./scripts/ingest_cron.sh week
```

Verify with `crontab -l`; logs are written to `backend/logs/ingest.log`. Remove
the job with `./scripts/uninstall_cron.sh`.

## 5. Start the API

```bash
uv run uvicorn app.main:app --reload --port 8000
```

- Health check: [http://localhost:8000/health](http://localhost:8000/health)
- Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Endpoints


| Method | Path                  | Description                                  |
| ------ | --------------------- | -------------------------------------------- |
| GET    | `/ab`                 | Plain-LLM vs RAG-grounded A/B comparison     |
| GET    | `/trends`             | Post volume over time + top title keywords   |
| GET    | `/embeddings/scatter` | 2D PCA projection colored by k-means cluster |
| GET    | `/retrieval-stats`    | Posts with the highest `retrieval_count`     |
| POST   | `/ingest/run`         | Trigger ingestion (`{"window": "day"}`)      |
| GET    | `/health`             | Liveness check                               |


## Project layout

```
backend/
├── app/
│   ├── config.py        # settings from .env
│   ├── db.py            # engine, session, schema bootstrap
│   ├── models.py        # SQLAlchemy models (reddit_posts, post_embeddings)
│   ├── embeddings.py    # local BGE embeddings
│   ├── reddit_client.py # Arctic Shift API ingestion
│   ├── ingest.py        # ingestion pipeline + CLI
│   ├── rag.py           # cosine retrieval + retrieval_count tracking
│   ├── llm.py           # Gemini client
│   ├── generation.py    # A/B prompt building + generation
│   ├── analytics.py     # trends, scatter, retrieval stats
│   ├── schemas.py       # Pydantic response models
│   ├── routers/         # FastAPI routers
│   └── main.py          # FastAPI app
├── docker-compose.yml   # Postgres + pgvector
├── pyproject.toml
└── .env.example
```

