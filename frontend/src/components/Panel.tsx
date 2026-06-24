import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, description, actions, className, children }: PanelProps) {
  return (
    <section
      className={`flex min-h-[120px] flex-col rounded-2xl border border-line bg-gradient-to-b from-elev to-bg p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]${
        className ? ` ${className}` : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px]">{title}</h2>
          {description && <div className="mt-0.5 text-[12.5px] text-faint">{description}</div>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-7 text-center text-sm text-dim">
      <div className="h-[22px] w-[22px] animate-spin rounded-full border-[2.5px] border-line border-t-accent" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-7 text-center text-sm text-danger">
      <span>⚠ {message}</span>
      {onRetry && (
        <button onClick={onRetry} type="button" className="btn">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-7 text-center text-sm text-faint">
      {message}
    </div>
  );
}
