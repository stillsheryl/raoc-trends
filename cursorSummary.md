# Build summary of the work done in Cursor (work performed by Claude Opus 4.8)

A summary of the work done to build the **Community Voices** app for
**r/RandomActsofCards**: a RAG pipeline that predicts what the community will
request next, compared against a plain (non-RAG) LLM baseline.

---

## 1. Project Overview

- **Goal:** generate a "Community Voices" document for r/RandomActsofCards,
  focused only on `[Request]` posts (case-insensitive), using a RAG pipeline
  grounded in real post data and A/B-tested against a plain LLM.
- **Structure:** two apps nested under `raoc-trends/`:
  - `backend/` — Python (FastAPI) API + ingestion pipeline
  - `frontend/` — React (Vite + TypeScript) dashboard
- Plan of record lives in `plan.md`.

---

## 2. Key Decisions

| Area | Decision |
| --- | --- |
| LLM | Google **Gemini 2.5 Flash** (`gemini-2.5-flash`) — resolved an earlier gemini/Claude contradiction |
| Embeddings | Local **`BAAI/bge-large-en-v1.5`** (1024-dim) via `sentence-transformers` |
| Backend framework | **FastAPI** + Uvicorn |
| Database | **PostgreSQL + pgvector** via Docker Compose (`pgvector/pgvector:pg16`) |
| Python tooling | **uv** |
| Frontend | **Vite + React + TypeScript**, **Tailwind CSS v4**, recharts, react-markdown |
| Data source | **Arctic Shift API** (see pivot below) |
| Retrieval top-N | default 20 (UI lets you pick 10/25/50/100) |
| `author` field | kept (cheap, useful for debugging) |
| Scheduling | idempotent ingest CLI runnable via system `cron` (sample crontab in README) |

---

## 3. Major Pivot: Reddit API → Arctic Shift

The original plan used the Reddit API via `praw`, but during setup we found:

- Reddit's **official API approval queue is effectively closed** (almost always denied).
- **Unauthenticated `.json` endpoints were blocked in 2026** (403, enforced via
  TLS fingerprinting + IP reputation) — direct scraping is not viable and
  violates ToS.

**Resolution:** switched to **[Arctic Shift](https://github.com/ArthurHeitmann/arctic_shift)**,
a maintained Pushshift successor with a free, **no-auth REST API**. This kept the
exact same subreddit, the `[Request]` filter, and ~all of the backend code.

- Endpoint: `GET /api/posts/search?subreddit=RandomActsofCards&after=<offset>&sort=asc&limit=100`
- Time windows map to relative offsets: day=`1d`, week=`7d`, month=`30d`
- Paginates by `created_utc`, dedupes by id, applies the strict `[Request]`
  title filter locally.
- Caveat: very recent posts (<~36h) may report `num_comments`/`score` as 0–1
  until the archive updates; freshness can lag by up to ~a month.
- Swapped dependency `praw` → `requests`; no Reddit credentials needed anymore.

---

## 4. Backend (`backend/`)

FastAPI app with the following modules under `app/`:

- `config.py` — settings from `.env` (DB URL, Arctic Shift base URL, Gemini key, model names, top-N).
- `db.py` — engine/session + idempotent schema bootstrap (auto-creates `vector` extension).
- `models.py` — SQLAlchemy models:
  - `reddit_posts` (id, reddit_id unique, title, body, author, created_at, ingested_at, num_comments, url)
  - `post_embeddings` (post_id FK, `VECTOR(1024)`, retrieval_count, last_retrieved)
- `reddit_client.py` — Arctic Shift ingestion (paginated, `[Request]` filter).
- `embeddings.py` — local BGE embeddings (lazy-loaded; query-instruction prefix for retrieval).
- `ingest.py` — ingestion pipeline + CLI; idempotent upsert on `reddit_id`, embeds only new posts.
- `rag.py` — pgvector cosine retrieval (`<=>`); increments `retrieval_count` + `last_retrieved`.
- `llm.py` — Gemini client wrapper.
- `generation.py` — A/B generation (plain vs RAG) with a shared prompt structure.
- `analytics.py` — trends (volume/comments/keywords), PCA + k-means embedding scatter, retrieval stats.
- `routers/` + `main.py` — API wiring + CORS.

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/ab` | Plain-LLM vs RAG-grounded A/B comparison (`top_n` param) |
| GET | `/trends` | Post volume over time + top title keywords |
| GET | `/embeddings/scatter` | 2D PCA projection colored by k-means cluster |
| GET | `/retrieval-stats` | Posts with the highest `retrieval_count` |
| POST | `/ingest/run` | Trigger ingestion (`{"window": "day"|"week"|"month", "limit": N?}`) |
| GET | `/health` | Liveness check |

---

## 5. Frontend (`frontend/`)

A dark, modern dashboard (Tailwind v4 utility-first) with these panels:

- **Ingestion** — day/week/month buttons; each opens a **modal** to optionally
  cap the fetch (No limit, or 10/25/50/100). Shows a green **indeterminate
  progress bar** ("Fetching data…") while running.
- **A/B Comparison** — "Generate" opens a **modal** to choose how many posts to
  use (10/25/50/100); renders plain vs RAG briefings side-by-side via
  react-markdown, with an expandable list of context posts.
- **Trends** — composed area+line chart (post volume + comment engagement) and a
  horizontal bar chart of top title keywords, plus headline metrics.
- **Embedding Space** — recharts scatter of PCA-projected BGE vectors colored by
  k-means cluster, with legend + hover tooltips.
- **Retrieval Stats** — ranked table of most-retrieved posts (count + last used).

Cross-panel refresh: ingestion **and** A/B generation both bump a shared
`refreshKey`, so Trends / Embedding Space / Retrieval Stats re-fetch
automatically and reflect updated `retrieval_count` immediately.

### Styling note
Converted entirely to **Tailwind CSS v4** (`@tailwindcss/vite`). `index.css`
holds only the `@theme` palette tokens, two `@apply` button classes, and the
bits utilities can't express: keyframe animations (pulse ring, indeterminate
bar, modal fade/pop), recharts theming, react-markdown output styles, and the
body background gradient.

---

## 6. Issues Encountered & Fixes

- **`uv` not installed / not on PATH:** installed via the official script; it
  added `~/.local/bin` to PATH in `~/.zshrc`. A pre-existing terminal needed
  `source ~/.local/bin/env` (or a new terminal) to pick it up.
- **`torch` Intel-Mac wheels:** the latest torch dropped x86_64 macOS wheels;
  pinned `torch>=2.2,<2.3` (last version with Intel-Mac wheels).
- **`transformers` 5.x import crash** (`NameError: name 'nn'`): the newest
  transformers wanted a newer torch and disabled its torch integration with
  2.2.x. Pinned `transformers>=4.41,<5` + `sentence-transformers<4`; kept `numpy<2`.
- **`ModuleNotFoundError: No module named 'app'`:** caused by running uvicorn
  from the repo root (using global pyenv). Fix: run from `backend/` so
  `uv run` uses the project `.venv` and `app` is importable.

---

## 7. How to Run Locally

### Backend
```bash
cd backend
uv sync
cp .env.example .env          # set GEMINI_API_KEY (Arctic Shift needs no key)
docker compose up -d          # Postgres + pgvector
uv run python -m app.ingest --window day   # then week / month as needed
uv run uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

---

## 8. Verified Working

- Backend: deps install, modules import, `ruff` clean, Postgres + pgvector
  schema bootstrap, real end-to-end ingest from Arctic Shift (15 `[Request]`
  posts → embeddings → pgvector cosine retrieval with `retrieval_count`
  tracking), API endpoints respond.
- Frontend: `npm run build` (tsc + vite) passes, no lint errors; dev server
  serves and CORS allows `localhost:5173`.

---

## 9. Outstanding / Optional Next Steps

- Set `GEMINI_API_KEY` in `backend/.env` and smoke-test the `/ab` panel
  end-to-end (the only feature that still needs the key).
- Ingest a larger `month` window to enrich charts/clusters.
- Optional: weekly cron entry for automated re-ingestion (sample in backend README).
