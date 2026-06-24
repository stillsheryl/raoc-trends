import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api, type ABResponse } from "../api";
import { ErrorState, Loading, Panel } from "./Panel";

const TOP_N_CHOICES = [10, 25, 50, 100];

// Sections 3-5 of the briefing are rendered as colored tag rows.
const TAG_CATEGORIES = ["Themes", "Emotions", "Occasions"] as const;
const CATEGORY_COLORS: Record<string, string> = {
  Themes: "var(--color-accent)",
  Emotions: "var(--color-accent2)",
  Occasions: "var(--color-rag)",
};

type TagSection = { label: string; tags: string[] };

/**
 * Splits a briefing at section "3.": everything before stays markdown, while
 * sections 3-5 (Themes / Emotions / Occasions) become category + tag rows.
 */
function parseBriefing(text: string): { body: string; sections: TagSection[] } {
  const split = text.match(/(?:^|\n)\s*\*{0,2}3\.\s/);
  if (!split || split.index === undefined) {
    return { body: text, sections: [] };
  }
  const start = split.index + (split[0].startsWith("\n") ? 1 : 0);
  const body = text.slice(0, start).trimEnd();
  const tail = text.slice(start);

  const sections: TagSection[] = [];
  const parts = tail.split(/(?:^|\n)\s*\*{0,2}\d+\.\s*/).filter((p) => p.trim());
  for (const part of parts) {
    const clean = part.replace(/\*\*/g, "").trim();
    const label = TAG_CATEGORIES.find((c) =>
      clean.toLowerCase().startsWith(c.toLowerCase()),
    );
    if (!label) continue;
    const rest = clean.slice(label.length).replace(/^[\s:—–-]+/, "");
    const tags = rest
      .split(",")
      .map((t) => t.trim().replace(/\.$/, "").trim())
      .filter(Boolean);
    if (tags.length) sections.push({ label, tags });
  }

  return { body, sections };
}

function Briefing({ text }: { text: string }) {
  const { body, sections } = parseBriefing(text);
  return (
    <>
      <div className="markdown">
        <ReactMarkdown>{body}</ReactMarkdown>
      </div>
      {sections.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {sections.map((s) => {
            const color = CATEGORY_COLORS[s.label] ?? "var(--color-accent)";
            return (
              <div key={s.label} className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[13px] font-semibold text-dim">{s.label}</span>
                {s.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      color,
                      backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                      borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function ABComparison({ onGenerated }: { onGenerated?: () => void }) {
  const [data, setData] = useState<ABResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [topN, setTopN] = useState(25);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  async function run() {
    const n = topN;
    setShowModal(false);
    setLoading(true);
    setError(null);
    try {
      setData(await api.abComparison(n));
      onGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      className="col-span-2"
      title="A/B Comparison — Plain LLM vs RAG-grounded"
      description="Same prompt, two ways: a plain model with no context vs. one grounded in retrieved [Request] posts."
      actions={
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
          disabled={loading}
          type="button"
        >
          {loading ? "Generating…" : data ? "Regenerate" : "Generate"}
        </button>
      }
    >
      {loading && <Loading label="Calling Gemini (plain + RAG)…" />}
      {!loading && error && <ErrorState message={error} onRetry={() => setShowModal(true)} />}
      {!loading && !error && !data && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-7 text-center text-sm text-faint">
          Click <strong>Generate</strong> to produce both briefings side by side.
        </div>
      )}
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <article className="rounded-xl border border-line border-t-[3px] border-t-plain bg-bg p-4">
              <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
                <span className="rounded-full bg-[rgba(251,191,36,0.15)] px-2 py-0.5 text-[11px] font-semibold text-plain">
                  PLAIN
                </span>
                No retrieval — model's prior knowledge only
              </div>
              <Briefing text={data.plain} />
            </article>
            <article className="rounded-xl border border-line border-t-[3px] border-t-rag bg-bg p-4">
              <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
                <span className="rounded-full bg-[rgba(74,222,128,0.15)] px-2 py-0.5 text-[11px] font-semibold text-rag">
                  RAG
                </span>
                Grounded in {data.context_post_count} retrieved posts
              </div>
              <Briefing text={data.rag} />
            </article>
          </div>
          {data.retrieved.length > 0 && (
            <details className="mt-3.5">
              <summary className="cursor-pointer text-[13px] text-faint">
                {data.retrieved.length} posts used as context
              </summary>
              <ul className="mt-2 list-disc pl-5 text-[13px] leading-relaxed">
                {data.retrieved.map((p) => (
                  <li key={p.post_id}>
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                        {p.title}
                      </a>
                    ) : (
                      p.title
                    )}{" "}
                    <span className="text-faint">· dist {p.distance.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {showModal && (
        <div
          className="modal-fade fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,8,13,0.66)] p-5 backdrop-blur-[3px]"
          onClick={() => setShowModal(false)}
          role="presentation"
        >
          <div
            className="modal-pop w-full max-w-[420px] rounded-2xl border border-line bg-elev p-[22px] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Generate A/B comparison"
          >
            <h3 className="text-[17px]">Generate A/B comparison</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-dim">
              Choose how many retrieved <code>[Request]</code> posts to ground the RAG output in.
            </p>

            <div className="mb-[22px] mt-[18px] flex flex-col gap-2.5">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-accent bg-[rgba(110,168,254,0.08)] px-3.5 py-3">
                <span className="flex-1 text-sm">Posts to use</span>
                <select
                  value={topN}
                  onChange={(e) => setTopN(Number(e.target.value))}
                  className="rounded-lg border border-line bg-elev2 px-2 py-[5px] text-ink"
                >
                  {TOP_N_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n} posts
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={() => setShowModal(false)} className="btn">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={run}>
                Run comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
