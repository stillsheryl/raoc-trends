# RAOC Community Voices — Frontend

React + TypeScript (Vite) dashboard for the Community Voices app. It visualizes
the backend's RAG pipeline: an A/B comparison (plain LLM vs. RAG-grounded),
trend charts, a 2D embedding scatter, and retrieval stats.

## Stack

- **Vite + React + TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`) — utility-first styling
- **recharts** — trend, scatter, and keyword charts
- **react-markdown** — renders the LLM briefings

## Prerequisites

- Node.js 18+ (tested on 22)
- The backend running at `http://localhost:8000` (see `../backend/README.md`)

## Setup

```bash
cd frontend
npm install
```

Optionally configure the API base URL (defaults to `http://localhost:8000`):

```bash
cp .env.example .env   # then edit VITE_API_BASE if needed
```

## Run

```bash
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

## Panels

- **Ingestion** — trigger day/week/month pulls from Arctic Shift.
- **A/B Comparison** — plain LLM vs. RAG-grounded briefing (requires `GEMINI_API_KEY` on the backend).
- **Trends** — post volume + comment engagement over time, and top title keywords.
- **Embedding Space** — PCA projection of BGE vectors colored by k-means cluster.
- **Retrieval Stats** — posts most frequently pulled into RAG context.

> CORS: the backend allows `http://localhost:5173` by default (`CORS_ORIGINS` in `../backend/.env`).
