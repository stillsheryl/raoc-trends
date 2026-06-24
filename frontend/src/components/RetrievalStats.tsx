import { api } from "../api";
import { useAsync } from "../hooks";
import { EmptyState, ErrorState, Loading, Panel } from "./Panel";

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TH = "border-b border-line px-2.5 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-faint";
const TD = "border-b border-line/50 px-2.5 py-[9px] align-top";

export function RetrievalStats({ refreshKey }: { refreshKey: number }) {
  const { data, loading, error, reload } = useAsync(() => api.retrievalStats(15), [refreshKey]);

  const ranked = data ? data.filter((d) => d.retrieval_count > 0) : [];

  return (
    <Panel
      title="Retrieval Stats"
      description="Which posts get pulled into RAG context most often (retrieval_count)."
    >
      {loading && <Loading />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && (ranked.length === 0 ? (
        <EmptyState message="No retrievals yet — run an A/B comparison to populate this." />
      ) : (
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className={`${TH} text-left`}>Post</th>
              <th className={`${TH} text-right`}>Retrievals</th>
              <th className={`${TH} text-right`}>Last used</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.post_id}>
                <td className={`${TD} max-w-[360px]`}>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {r.title}
                    </a>
                  ) : (
                    r.title
                  )}
                </td>
                <td className={`${TD} text-right`}>
                  <span className="inline-block min-w-[26px] rounded-lg border border-line bg-elev2 px-2 py-0.5 text-center font-semibold tabular-nums text-accent">
                    {r.retrieval_count}
                  </span>
                </td>
                <td className={`${TD} text-right tabular-nums text-dim`}>{fmtWhen(r.last_retrieved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </Panel>
  );
}
