import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-2">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-smooth active:translate-y-0 disabled:pointer-events-none disabled:opacity-50';

export const buttonStyles = {
  primary: `${base} bg-accent text-on-accent shadow-sm hover:-translate-y-px hover:bg-accent-strong hover:shadow-md`,
  secondary: `${base} border border-line bg-surface text-ink shadow-card hover:-translate-y-px hover:border-accent/40 hover:shadow-md`,
  ghost: `${base} text-ink-2 hover:bg-surface-2 hover:text-ink`,
};

/** Centered placeholder for pages with nothing to show yet. */
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
