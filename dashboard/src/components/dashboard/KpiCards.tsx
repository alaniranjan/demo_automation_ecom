'use client';

import type { ComponentType, SVGProps } from 'react';
import { formatPercent } from '@/lib/format';
import type { RunRecord, RunSummary } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { CheckCircleIcon, LoaderIcon, MinusCircleIcon, PlayIcon, XCircleIcon } from '../icons';
import { useDashboard } from '../providers/DashboardProvider';

type Tone = 'accent' | 'good' | 'critical' | 'warning' | 'live';

const TONES: Record<Tone, { card: string; tile: string; hint: string }> = {
  accent: { card: 'border-line bg-surface', tile: 'bg-accent-soft text-accent-strong', hint: 'text-good-text' },
  good: { card: 'border-good/25 bg-good/8', tile: 'bg-good text-white', hint: 'text-good-text' },
  critical: { card: 'border-critical/30 bg-critical/8', tile: 'bg-critical text-white', hint: 'text-ink-2' },
  warning: { card: 'border-warning/30 bg-warning/8', tile: 'bg-warning text-black/80', hint: 'text-ink-2' },
  live: { card: 'border-accent/30 bg-accent/8', tile: 'bg-accent text-white', hint: 'text-accent-strong' },
};

function KpiCard({
  label,
  value,
  hint,
  tone,
  Icon,
  spin = false,
}: {
  label: string;
  value: string;
  hint: string;
  tone: Tone;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  spin?: boolean;
}) {
  const style = TONES[tone];
  return (
    <div
      className={`group flex flex-col rounded-xl border p-4 shadow-card transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-lg ${style.card}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${style.tile}`}>
          <Icon width={18} height={18} className={spin ? 'animate-spin [animation-duration:2.5s]' : ''} />
        </span>
        <p className="min-w-0 truncate text-[13px] text-ink-2">{label}</p>
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</p>
      <p className={`mt-2 truncate text-xs ${style.hint}`}>{hint}</p>
    </div>
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** KPI row for the given runs and latest-run summary (already scoped to the selected folder). */
export function KpiCards({ runs, summary, scope }: { runs: RunRecord[]; summary: RunSummary | null; scope: string | null }) {
  const { live, activeRun } = useDashboard();
  const now = useNow(60_000);
  const counts = summary?.counts;
  const total = summary?.total ?? 0;
  const share = (value: number) => (total ? formatPercent(Math.round((value / total) * 1000) / 1000) : '0%');
  const lastWeek = now === null ? 0 : runs.filter((run) => now - new Date(run.startTime).getTime() < WEEK_MS).length;
  const running = activeRun ? (live?.active ? live.running.length : 0) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-5">
      <KpiCard label="Total Runs" value={String(runs.length)} hint={`+${lastWeek} from last 7 days`} tone="accent" Icon={PlayIcon} />
      <KpiCard
        label="Passed Tests"
        value={String(counts ? counts.passed + counts.flaky : 0)}
        hint={`${formatPercent(Math.round((summary?.passRate ?? 0) * 1000) / 1000)} pass rate`}
        tone="good"
        Icon={CheckCircleIcon}
      />
      <KpiCard label="Failed Tests" value={String(counts?.failed ?? 0)} hint={`${share(counts?.failed ?? 0)} of ${scope ?? 'latest run'}`} tone="critical" Icon={XCircleIcon} />
      <KpiCard label="Skipped Tests" value={String(counts?.skipped ?? 0)} hint={`${share(counts?.skipped ?? 0)} of ${scope ?? 'latest run'}`} tone="warning" Icon={MinusCircleIcon} />
      <KpiCard
        label="Running Tests"
        value={String(running)}
        hint={activeRun ? 'Currently executing' : 'Runner idle'}
        tone="live"
        Icon={LoaderIcon}
        spin={Boolean(activeRun)}
      />
    </div>
  );
}
