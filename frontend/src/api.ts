const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export interface RetrievedPost {
  post_id: string;
  reddit_id: string;
  title: string;
  url: string | null;
  distance: number;
}

export interface ABResponse {
  plain: string;
  rag: string;
  context_post_count: number;
  retrieved: RetrievedPost[];
}

export interface TrendPoint {
  date: string;
  post_count: number;
  total_comments: number;
}

export interface KeywordCount {
  keyword: string;
  count: number;
}

export interface TrendsResponse {
  total_posts: number;
  volume_over_time: TrendPoint[];
  top_keywords: KeywordCount[];
}

export interface ScatterPoint {
  post_id: string;
  title: string;
  x: number;
  y: number;
  cluster: number;
}

export interface RetrievalStat {
  post_id: string;
  reddit_id: string;
  title: string;
  url: string | null;
  retrieval_count: number;
  last_retrieved: string | null;
}

export type IngestWindow = "day" | "week" | "month";

export interface IngestResponse {
  window: string;
  fetched: number;
  new_posts: number;
  embedded: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      // ignore JSON parse failures; fall back to status text
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  abComparison: (topN?: number) =>
    request<ABResponse>(`/ab${topN ? `?top_n=${topN}` : ""}`),
  trends: () => request<TrendsResponse>("/trends"),
  scatter: (nClusters = 5) =>
    request<ScatterPoint[]>(`/embeddings/scatter?n_clusters=${nClusters}`),
  retrievalStats: (limit = 15) =>
    request<RetrievalStat[]>(`/retrieval-stats?limit=${limit}`),
  ingest: (window: IngestWindow, limit?: number) =>
    request<IngestResponse>("/ingest/run", {
      method: "POST",
      body: JSON.stringify({ window, limit: limit ?? null }),
    }),
};

export { API_BASE };
