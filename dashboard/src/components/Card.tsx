import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Removes body padding so tables can run edge to edge; the header keeps its padding. */
  flush?: boolean;
  children: ReactNode;
}

export function Card({ title, subtitle, actions, className = '', flush = false, children }: CardProps) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-line bg-surface shadow-card transition-shadow duration-300 ease-smooth hover:shadow-md ${
        flush ? 'overflow-hidden' : 'p-5'
      } ${className}`}
    >
      {(title || actions) && (
        <header className={`mb-4 flex flex-wrap items-start justify-between gap-3 ${flush ? 'px-5 pt-5' : ''}`}>
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Small toggle between a chart and its table view. */
export function ViewToggle({ showTable, onChange }: { showTable: boolean; onChange: (showTable: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!showTable)}
      className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
      aria-pressed={showTable}
    >
      {showTable ? 'Show chart' : 'Show table'}
    </button>
  );
}
