import { useEffect, useState } from "react";
import { api, type IngestResponse, type IngestWindow } from "../api";
import { Panel } from "./Panel";

const WINDOWS: { key: IngestWindow; label: string }[] = [
  { key: "day", label: "Past day" },
  { key: "week", label: "Past week" },
  { key: "month", label: "Past month" },
];

const LIMIT_CHOICES = [10, 25, 50, 100];

function optClass(selected: boolean) {
  return `flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3.5 py-3 transition-colors ${
    selected ? "border-accent bg-[rgba(110,168,254,0.08)]" : "border-line hover:border-line2"
  }`;
}

export function IngestControl({ onIngested }: { onIngested: () => void }) {
  const [pending, setPending] = useState<IngestWindow | null>(null);
  const [useLimit, setUseLimit] = useState(false);
  const [limitValue, setLimitValue] = useState(25);

  const [running, setRunning] = useState<IngestWindow | null>(null);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingLabel = WINDOWS.find((w) => w.key === pending)?.label ?? "";

  function openModal(window: IngestWindow) {
    setUseLimit(false);
    setLimitValue(25);
    setPending(window);
  }

  function closeModal() {
    setPending(null);
  }

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  async function confirm() {
    if (!pending) return;
    const window = pending;
    const limit = useLimit ? limitValue : undefined;
    setPending(null);
    setRunning(window);
    setError(null);
    setResult(null);
    try {
      const res = await api.ingest(window, limit);
      setResult(res);
      onIngested();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  return (
    <Panel
      className="col-span-2"
      title="Ingestion"
      description="Pull [Request] posts from Arctic Shift. Start with a day, scale up as needed (idempotent)."
    >
      <div className="flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            onClick={() => openModal(w.key)}
            disabled={running !== null}
            type="button"
            className="btn"
          >
            {running === w.key ? "Running…" : w.label}
          </button>
        ))}
      </div>

      {running && (
        <div className="mt-4">
          <div className="mb-2.5 flex items-center gap-2 text-[13.5px] font-semibold text-rag">
            <span className="pulse-ring h-[9px] w-[9px] rounded-full bg-rag" />
            Fetching data — {WINDOWS.find((w) => w.key === running)?.label.toLowerCase()}…
          </div>
          <div
            className="relative h-[9px] overflow-hidden rounded-full bg-[rgba(74,222,128,0.12)]"
            role="progressbar"
            aria-label="Fetching data"
          >
            <div
              className="indeterminate-bar absolute left-0 top-0 h-full w-2/5 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, rgba(74,222,128,0) 0%, rgba(74,222,128,0.6) 40%, #4ade80 50%, rgba(74,222,128,0.6) 60%, rgba(74,222,128,0) 100%)",
              }}
            />
          </div>
        </div>
      )}

      {!running && (
        <div className="mt-3.5 text-[13.5px]">
          {error && <span className="text-danger">⚠ {error}</span>}
          {result && (
            <span className="text-faint">
              Ingested <strong className="text-ink">{result.window}</strong>: fetched {result.fetched},
              new {result.new_posts}, embedded {result.embedded}.
            </span>
          )}
          {!error && !result && (
            <span className="text-faint">
              First run downloads the embedding model, so it may take a bit.
            </span>
          )}
        </div>
      )}

      {pending && (
        <div
          className="modal-fade fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,8,13,0.66)] p-5 backdrop-blur-[3px]"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="modal-pop w-full max-w-[420px] rounded-2xl border border-line bg-elev p-[22px] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Ingest ${pendingLabel}`}
          >
            <h3 className="text-[17px]">Ingest — {pendingLabel}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-dim">
              Optionally cap how many <code>[Request]</code> posts to fetch from this window.
            </p>

            <div className="mb-[22px] mt-[18px] flex flex-col gap-2.5">
              <label className={optClass(!useLimit)}>
                <input
                  type="radio"
                  name="limit-mode"
                  className="accent-accent"
                  checked={!useLimit}
                  onChange={() => setUseLimit(false)}
                />
                <span className="flex-1 text-sm">No limit — fetch all posts in the window</span>
              </label>

              <label className={optClass(useLimit)}>
                <input
                  type="radio"
                  name="limit-mode"
                  className="accent-accent"
                  checked={useLimit}
                  onChange={() => setUseLimit(true)}
                />
                <span className="flex-1 text-sm">Limit to</span>
                <select
                  value={limitValue}
                  disabled={!useLimit}
                  onChange={(e) => setLimitValue(Number(e.target.value))}
                  onClick={() => setUseLimit(true)}
                  className="rounded-lg border border-line bg-elev2 px-2 py-[5px] text-ink disabled:opacity-45"
                >
                  {LIMIT_CHOICES.map((n) => (
                    <option key={n} value={n}>
                      {n} posts
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2.5">
              <button type="button" onClick={closeModal} className="btn">
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={confirm}>
                Fetch data
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
