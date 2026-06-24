import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { api, type ScatterPoint } from "../api";
import { useAsync } from "../hooks";
import { EmptyState, ErrorState, Loading, Panel } from "./Panel";

const CLUSTER_COLORS = [
  "#6ea8fe",
  "#4ade80",
  "#fbbf24",
  "#b794f6",
  "#f87171",
  "#22d3ee",
  "#fb923c",
  "#a3e635",
];

const AXIS = { stroke: "#8593a8", fontSize: 11 };

interface TipProps {
  active?: boolean;
  payload?: { payload: ScatterPoint }[];
}

function ScatterTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="max-w-[280px] rounded-[10px] border border-line bg-elev2 px-2.5 py-2 text-[12.5px]">
      <div className="font-semibold" style={{ color: CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length] }}>
        Cluster {p.cluster}
      </div>
      <div className="mt-0.5 text-ink">{p.title}</div>
    </div>
  );
}

export function EmbeddingScatter({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error, reload } = useAsync(() => api.scatter(5), [refreshKey]);

  const clusters = data ? [...new Set(data.map((p) => p.cluster))].sort((a, b) => a - b) : [];

  return (
    <Panel
      title="Embedding Space"
      description="BGE vectors projected to 2D (PCA), colored by k-means cluster."
    >
      {loading && <Loading />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && (data.length === 0 ? (
        <EmptyState message="No embeddings yet — ingest some posts first." />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
              <CartesianGrid stroke="#1b2433" />
              <XAxis type="number" dataKey="x" name="PC1" {...AXIS} tickFormatter={(v) => v.toFixed(1)} />
              <YAxis type="number" dataKey="y" name="PC2" {...AXIS} tickFormatter={(v) => v.toFixed(1)} />
              <ZAxis range={[60, 60]} />
              <Tooltip content={<ScatterTip />} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={data} fillOpacity={0.8}>
                {data.map((p) => (
                  <Cell key={p.post_id} fill={CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-2.5 flex flex-wrap gap-3">
            {clusters.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 text-xs text-faint">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: CLUSTER_COLORS[c % CLUSTER_COLORS.length] }}
                />
                Cluster {c}
              </span>
            ))}
          </div>
        </>
      ))}
    </Panel>
  );
}
