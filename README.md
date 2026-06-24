# RAOC Community Voices

A RAG-powered "Community Voices" app for requests made on the Reddit community [r/RandomActsofCards.](https://www.reddit.com/r/RandomActsofCards/) RandomActsofCards is a place where people can send or receive cards, and this project focuses specifically on`[Request]` posts, where people make requests for others in the community to send them mail.

The app ingests real `[Request]` posts, embeds them, and uses retrieval-augmented
generation to produce a weekly briefing of **what the community has been
requesting** and **what it's likely to request next**. Every briefing is
A/B-compared against a plain (non-RAG) LLM baseline so you can see the value the
retrieved context adds.

## Repository layout

This project is split into two apps under one repo:


| Folder                            | Stack                                             | What it does                                                                                |
| --------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `[backend/](backend/README.md)`   | Python · FastAPI · PostgreSQL + pgvector · Gemini | Ingestion pipeline, local embeddings, RAG retrieval + generation, and the HTTP API.         |
| `[frontend/](frontend/README.md)` | React · TypeScript · Vite · Tailwind              | Dashboard that visualizes the A/B comparison, trends, embedding space, and retrieval stats. |


Each folder has its own README with detailed setup and run instructions.

## Conversation logs

The Markdown files at the project root capture the AI-assisted planning and build
process across different tools, shared for transparency into how the project came
together:


| File                                     | Tool / contents                           |
| ---------------------------------------- | ----------------------------------------- |
| `[plan.md](plan.md)`                     | The plan of record the build follows.     |
| `[chatGptSummary.md](chatGptSummary.md)` | Planning discussion with ChatGPT.         |
| `[claudeSummary.md](claudeSummary.md)`   | Planning conversation log with Claude.    |
| `[cursorSummary.md](cursorSummary.md)`   | Build summary of the work done in Cursor. |


## Getting started

Full instructions live in `[backend/README.md](backend/README.md)` and
`[frontend/README.md](frontend/README.md)`. At a high level:

1. **Start the backend** — Postgres via Docker (`docker compose up -d`), then the
  API (`uv run uvicorn app.main:app --reload --port 8000`). Requires a
   `GEMINI_API_KEY` in `backend/.env`.
2. **Start the frontend** — `npm install && npm run dev` (serves at
  `http://localhost:5173`, talks to the API at `http://localhost:8000`).

### Fetching data

Reddit data comes from the free [Arctic Shift](https://github.com/ArthurHeitmann/arctic_shift)
archive (no API key needed). You can ingest posts two ways:

- **Backend script** — run the ingestion CLI directly:

```bash
cd backend
uv run python -m app.ingest --window day     # then week / month to scale up
```

- **Frontend UI** — use the **Ingestion** panel in the dashboard to trigger a
day/week/month pull (this calls the backend's `POST /ingest/run` endpoint).

Ingestion is idempotent — posts are upserted on their Reddit ID, so reruns never
create duplicates and embeddings are only generated for new posts. Once data is
loaded, use the **Generate** button on the A/B Comparison panel to produce the
briefing.