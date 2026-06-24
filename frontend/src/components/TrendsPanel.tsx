import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api";
import { useAsync } from "../hooks";
import { EmptyState, ErrorState, Loading, Panel } from "./Panel";

const AXIS = { stroke: "#8593a8", fontSize: 11 };

function fmtDate(d: string) {
  const parts = d.split("-");
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
}

export function TrendsPanel({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error, reload } = useAsync(() => api.trends(), [refreshKey]);

  return (
    <Panel
      className="col-span-2"
      title="Trends"
      description="Post volume and comment engagement over time, plus the most common words in [Request] titles."
    >
      {loading && <Loading />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && (
        <>
          <div className="mb-3 flex gap-5">
            <div className="flex flex-col">
              <span className="text-[22px] font-bold">{data.total_posts}</span>
              <span className="text-xs text-faint">Total [Request] posts</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[22px] font-bold">{data.volume_over_time.length}</span>
              <span className="text-xs text-faint">Days with activity</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[22px] font-bold">
                {data.volume_over_time.reduce((s, p) => s + p.total_comments, 0)}
              </span>
              <span className="text-xs text-faint">Total comments</span>
            </div>
          </div>

          {data.total_posts === 0 ? (
            <EmptyState message="No posts yet — run an ingestion below to populate the dashboard." />
          ) : (
            <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.4fr_1fr]">
              <div>
                <div className="mb-2 text-[12.5px] text-faint">Volume &amp; engagement over time</div>
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={data.volume_over_time} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6ea8fe" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#6ea8fe" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1b2433" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDate} {...AXIS} />
                    <YAxis yAxisId="left" {...AXIS} allowDecimals={false} />
                    <YAxis yAxisId="right" orientation="right" {...AXIS} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="post_count"
                      name="Posts"
                      stroke="#6ea8fe"
                      fill="url(#vol)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="total_comments"
                      name="Comments"
                      stroke="#b794f6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="mb-2 text-[12.5px] text-faint">Top title keywords</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.top_keywords.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#1b2433" horizontal={false} />
                    <XAxis type="number" {...AXIS} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="keyword"
                      width={84}
                      {...AXIS}
                      tick={{ fill: "#93a1b5", fontSize: 12 }}
                    />
                    <Tooltip cursor={{ fill: "rgba(110,168,254,0.08)" }} />
                    <Bar dataKey="count" name="Mentions" fill="#4ade80" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
