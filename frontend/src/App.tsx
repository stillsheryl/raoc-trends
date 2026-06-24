import { useState } from "react";
import { api } from "./api";
import { ABComparison } from "./components/ABComparison";
import { EmbeddingScatter } from "./components/EmbeddingScatter";
import { IngestControl } from "./components/IngestControl";
import { RetrievalStats } from "./components/RetrievalStats";
import { TrendsPanel } from "./components/TrendsPanel";
import { useAsync } from "./hooks";

function HealthPill() {
  const { data, error } = useAsync(() => api.health(), []);
  const ok = data?.status === "ok";
  const dotClass = ok ? "bg-rag shadow-[0_0_0_3px_rgba(74,222,128,0.18)]" : error ? "bg-danger shadow-[0_0_0_3px_rgba(248,113,113,0.18)]" : "bg-faint";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-elev px-3 py-[7px] text-[13px] text-dim">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      {ok ? "API connected" : error ? "API unreachable" : "Connecting…"}
    </span>
  );
}

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-16 pt-7">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="text-[26px]">RAOC Community Voices</h1>
          <p className="mt-1.5 max-w-[640px] text-sm leading-relaxed text-dim">
            Predicting what r/RandomActsofCards will request next — a RAG pipeline grounded in real{" "}
            <code>[Request]</code> posts, compared against a plain LLM baseline.
          </p>
        </div>
        <HealthPill />
      </header>

      <div className="md:grid grid-cols-1 gap-5 md:grid-cols-2 max-md:flex max-md:flex-col max-md:gap-5">
        <IngestControl onIngested={refresh} />
        <ABComparison onGenerated={refresh} />
        <TrendsPanel refreshKey={refreshKey} />
        <EmbeddingScatter refreshKey={refreshKey} />
        <RetrievalStats refreshKey={refreshKey} />
      </div>
    </div>
  );
}
