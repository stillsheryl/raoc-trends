# Community Voices Challenge — Implementation Plan

## Overview

Build a React + Python app that generates a **Community Voices Document** for **r/RandomActsofCards**, focused only on posts with `[Request]` (case-insensitive) in the title. The app predicts what the community will request next week, using a RAG pipeline grounded in real post data, and compares that output against a plain (non-RAG) LLM baseline.

---

## 1. Data Source & Scope

- **Community:** r/RandomActsofCards
- **Filter:** only posts where the title contains `[Request]` (case-insensitive)
- **API:** [Arctic Shift](https://github.com/ArthurHeitmann/arctic_shift) archive API (a maintained Pushshift successor), **no API key required**. Rationale: Reddit's official API approval queue is effectively closed and its unauthenticated endpoints were blocked in 2026, so direct access is no longer viable for this project. Arctic Shift serves the same public r/RandomActsofCards data. We call `GET /api/posts/search?subreddit=RandomActsofCards&after=<offset>&sort=asc&limit=100`, paginate by `created_utc`, and apply the strict `[Request]` title filter locally. Time windows map to the `after` offset: day=`1d`, week=`7d`, month=`30d`. Caveat: very recent posts (<~36h) may report `num_comments`/`score` as 0–1 until the archive updates.
- **Data window strategy:** start small and scale up deliberately to right-size the dataset before committing to a large fetch:
  1. Fetch **past day** first — confirm ingestion and idempotency work
  2. Then fetch **past week** — confirm trend signal starts to emerge
  3. Then fetch **past month** — only if needed for a meaningful trend, and only after checking post volume is reasonable (this directly addresses requirement 4b: avoid pulling in more data than necessary)

---

## 2. Database Schema

### `reddit_posts`


| column         | type             | notes                                                                                              |
| -------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| `id`           | UUID PRIMARY KEY | internal id                                                                                        |
| `reddit_id`    | TEXT UNIQUE      | Reddit's post id — used for idempotent upserts                                                     |
| `title`        | TEXT             |                                                                                                    |
| `body`         | TEXT             |                                                                                                    |
| `author`       | TEXT             | optional, not used in analysis but cheap to capture                                                |
| `created_at`   | TIMESTAMP        | when the post was created on Reddit                                                                |
| `ingested_at`  | TIMESTAMP        | when our pipeline pulled it in — needed to debug ingestion runs separately from post creation time |
| `num_comments` | INTEGER          |                                                                                                    |
| `url`          | TEXT             |                                                                                                    |


### `post_embeddings`


| column            | type                             | notes                                                               |
| ----------------- | -------------------------------- | ------------------------------------------------------------------- |
| `post_id`         | UUID REFERENCES reddit_posts(id) |                                                                     |
| `embedding`       | VECTOR(1024)                     | BGE-large-en-v1.5 output (1024-dim)                                 |
| `retrieval_count` | INTEGER DEFAULT 0                | incremented every time this embedding is retrieved (requirement 3c) |
| `last_retrieved`  | TIMESTAMP                        | updated alongside `retrieval_count`                                 |


---

## 3. Ingestion Pipeline (Python)

1. Fetch posts matching `[Request]` filter from the Arctic Shift API.
2. Upsert into `reddit_posts` keyed on `reddit_id` (idempotent — re-running the fetch should not create duplicates).
3. For each new post:
  - Generate embedding via **BAAI/bge-large-en-v1.5** → insert into `post_embeddings`.
4. **Cron job (weekly):** re-run the same pipeline scoped to "past week" to keep the store fresh. Idempotent upsert means reruns are safe.

---

## 4. RAG Retrieval

1. Define a fixed query representing the analysis intent: `"What has this community been requesting lately?"`
2. Embed that query using the same BGE model.
3. Run a cosine similarity search against `post_embeddings` using pgvector's `<=>` operator: 
  ```sql
  SELECT post_id, embedding <=> '[query_vector]' AS distanceFROM post_embeddingsORDER BY distanceLIMIT 20;

  ```
4. Take the top N (default **20**; tune up to ~30 based on total corpus size after the volume check).
5. For every post_id returned:
  - Increment `retrieval_count`
  - Update `last_retrieved`

---

## 5. Prompt Augmentation & Generation

Use **Google Gemini 2.5 Flash** (`gemini-2.5-flash`) via the Google AI Studio API. Add instructions in the README to set up an [API key](https://aistudio.google.com/api-keys?project=gen-lang-client-0783085394).

1. Join each retrieved `post_id` against `reddit_posts` to assemble context lines from raw title/body text, e.g.: 
  ```
  1. [Request] Mom going through chemo, could use some encouragement2. [Request] First Father's Day without my dad...

  ```
2. Send this as context in a prompt asking the LLM to:
  - Summarize what the community has been requesting this week
  - Predict what they'll likely request next week
3. This is the **RAG-grounded** output.

---

## 6. A/B Comparison (Requirement 5)

- **Plain LLM (no retrieval):** same instruction, no context — just "summarize what r/RandomActsofCards has been requesting lately and predict next week."
- **RAG-grounded LLM:** output from Step 5.
- Both calls use the *same* underlying prompt/output structure so the comparison is apples-to-apples for the dashboard display.

---

## 7. Dashboard (React)

Panels to include:

- **A/B comparison view** — Plain LLM output (left) vs. RAG-grounded output (right)
- **Trend charts** — e.g. post volume over time, top recurring keywords/themes pulled from titles, comment engagement (`num_comments`) trends
- **Embedding visualization** — flattened 2D scatter (UMAP or PCA/t-SNE via scikit-learn) of the BGE vectors (requirement 3b). Without classification labels, color by a proxy such as cluster id (k-means on the embeddings) rather than occasion/emotion
- **Retrieval stats** — which posts/embeddings have the highest `retrieval_count` (requirement 3c)

---

## Requirements Coverage Checklist


| #   | Requirement                        | Covered by                                        |
| --- | ---------------------------------- | ------------------------------------------------- |
| 1   | Pick an active community           | r/RandomActsofCards, `[Request]` posts            |
| 2   | Generate Community Voices Document | React dashboard (Steps 5–7)                       |
| 3a  | Vector DB / vectorized table       | Postgres + pgvector (`post_embeddings`)           |
| 3b  | Flattened embedding visualization  | UMAP/PCA scatter panel (Step 7)                   |
| 3c  | Retrieval stats                    | `retrieval_count` / `last_retrieved` (Step 4)     |
| 4a  | Automated ingestion                | Python ingestion pipeline + weekly cron (Step 3)  |
| 4b  | Handle large data volume           | Staged day → week → month fetch strategy (Step 1) |
| 5   | A/B test RAG vs. plain LLM         | Step 6, displayed side-by-side in dashboard       |


---

## Tech Stack & Project Structure (Finalized)

- **Repo layout** (both apps nested under `raoc-trends/`):
  - `backend/` — Python (FastAPI) API + ingestion pipeline
  - `frontend/` — React dashboard
- **Backend framework:** FastAPI (serves A/B output, trends, embedding scatter, and retrieval stats to the dashboard).
- **Python tooling:** `uv` for dependency management and virtual environment.
- **Embeddings:** local `BAAI/bge-large-en-v1.5` (1024-dim) via `sentence-transformers` (no embedding API cost).
- **LLM:** Google Gemini 2.5 Flash (`gemini-2.5-flash`) via API key.
- **Database:** Postgres + pgvector, run locally via **Docker Compose** using the `pgvector/pgvector` image.
- **Reddit data access:** Arctic Shift archive API via `requests` (no credentials/API key required).

## Resolved Open Decisions

- **LLM for generation:** Google Gemini 2.5 Flash (resolved the earlier gemini/Claude contradiction).
- **Top-N retrieval:** default 20, tune after corpus volume check.
- **`author` field:** keep it — cheap to capture and useful for debugging ingestion.
- **Cron / scheduling:** ingestion is exposed as a standalone CLI entrypoint (e.g. `python -m app.ingest --window week`) that is idempotent and runnable manually or via system `cron`. README will include a sample weekly `crontab` entry rather than running an always-on scheduler process.

---

# Local Development

README will include:

1. Prerequisites (Docker, `uv`, Node.js)
2. Install instructions (`uv sync` for backend, `npm install` for frontend)
3. Environment variable setup (`.env`: Gemini API key, database URL; Arctic Shift needs no key)
4. Data source note (Arctic Shift API — no credentials needed)
5. PostgreSQL + pgvector setup via Docker Compose (`docker compose up -d`)
6. Database migration / schema bootstrap
7. Running the ingestion pipeline (day → week → month) and the weekly cron example
8. Backend startup instructions (FastAPI / uvicorn)
9. Frontend startup instructions (React dev server)

The project should be runnable locally after cloning the repository.