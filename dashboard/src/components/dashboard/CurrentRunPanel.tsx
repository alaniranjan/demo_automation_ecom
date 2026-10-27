'use client';

import Link from 'next/link';
import { formatDuration, formatRelative } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { Card } from '../Card';
import { LoaderIcon, PlayIcon, StopIcon } from '../icons';
import { buttonStyles } from '../PageHeader';
import { useDashboard } from '../providers/DashboardProvider';
import { StatusPill } from '../RunsTable';
import { runOutcome } from '../suites';

function Stat({ label, value, tone = 'text-ink' }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

/** What is executing right now (dashboard or terminal run), fed by the live reporter. */
export function CurrentRunPanel() {
  const { activeRun, live, results, busy, cancelRun, setRunDialogOpen, startRun } = useDashboard();
  const now = useNow(1000);
  const lastRun = results?.runs.at(-1);
  const allSuite = results?.catalog?.suites.find((suite) => suite.grep === null);

  if (!activeRun) {
    return (
      <Card title="Current Run" actions={<span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2">Idle</span>}>
        <p className="text-sm text-ink-2">No run in progress.</p>
        {lastRun && (
          <div className="mt-4 rounded-xl bg-surface-2/70 p-3">
            <p className="text-xs text-ink-3">Last run</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-ink">{lastRun.id}</span>
              <StatusPill status={runOutcome(lastRun)} />
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {lastRun.suiteLabel} · {now !== null ? formatRelative(lastRun.startTime, now) : ''} · {formatDuration(lastRun.duration)}
            </p>
          </div>
        )}
        {results?.meta.canRun === false ? (
          <p className="mt-4 text-xs text-ink-3">View-only: tests run on GitHub Actions on every push to main.</p>
        ) : (
          <div className="mt-4 flex gap-2">
            {allSuite && (
              <button type="button" onClick={() => void startRun({ suite: allSuite.script })} className={`${buttonStyles.primary} flex-1`}>
                <PlayIcon width={13} height={13} /> Run all
              </button>
            )}
            <button type="button" onClick={() => setRunDialogOpen(true)} className={`${buttonStyles.secondary} flex-1`}>
              Select tests
            </button>
          </div>
        )}
      </Card>
    );
  }

  // Live data belongs to this run only if it started after the run was launched.
  const liveForRun = live && new Date(live.startedAt).getTime() >= new Date(activeRun.startedAt).getTime() - 5000 ? live : null;
  const counts = liveForRun?.counts;
  const completed = counts ? counts.passed + counts.failed + counts.flaky + counts.skipped : 0;
  const total = liveForRun?.total ?? 0;
  const percent = activeRun.phase === 'reporting' ? 100 : total ? Math.round((completed / total) * 100) : 0;
  const current = liveForRun?.running[0];
  const baseURL = results?.meta.baseURL;

  return (
    <Card
      title="Current Run"
      actions={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-strong">
          <LoaderIcon width={12} height={12} className="animate-spin [animation-duration:2.5s]" />
          {activeRun.phase === 'reporting' ? 'Reporting' : 'Running'}
        </span>
      }
    >
      <p className="text-sm font-semibold text-ink">
        Run ID: <span className="font-mono">#{activeRun.runId ?? '…'}</span>
      </p>
      <p className="mt-0.5 text-xs text-ink-3">
        {activeRun.label}
        {activeRun.source === 'terminal' && ' · started from a terminal'}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-active h-full rounded-full bg-accent transition-[width] duration-500 ease-smooth" style={{ width: `${percent}%` }} />
        </div>
        <span className="w-10 text-right text-sm font-medium tabular-nums text-ink">{percent}%</span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Stat label="Running" value={liveForRun?.running.length ?? 0} tone="text-warning-text" />
        <Stat label="Passed" value={counts ? counts.passed + counts.flaky : 0} tone="text-good-text" />
        <Stat label="Failed" value={counts?.failed ?? 0} tone="text-critical-text" />
        <Stat label="Skipped" value={counts?.skipped ?? 0} />
      </div>

      <dl className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
        <div>
          <dt className="text-xs text-ink-3">Current Test</dt>
          <dd className="mt-0.5 flex items-start justify-between gap-3">
            <span className="min-w-0 break-words font-medium text-ink">
              {activeRun.phase === 'reporting' ? 'Generating Allure report' : (current?.title ?? 'Starting workers…')}
            </span>
            {current && now !== null && (
              <span className="shrink-0 text-xs tabular-nums text-ink-3">{formatDuration(Math.max(0, now - new Date(current.startedAt).getTime()))}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">{current?.url ? 'Last navigation' : 'Base URL'}</dt>
          <dd className="mt-0.5 break-all text-ink">{current?.url ?? baseURL ?? '-'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Step</dt>
          <dd className="mt-0.5 break-words text-ink">{current?.step ?? '-'}</dd>
        </div>
      </dl>

      {busy ? (
        <button
          type="button"
          onClick={() => void cancelRun()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-critical/60 bg-critical/10 py-2.5 text-sm font-medium text-critical-text transition-all duration-200 hover:bg-critical/20"
        >
          <StopIcon width={14} height={14} /> Stop Run
        </button>
      ) : (
        <p className="mt-5 text-xs text-ink-3">This run was started outside the dashboard; stop it from its terminal.</p>
      )}
      <Link href="/runs" className="mt-3 block text-center text-xs font-medium text-accent-strong hover:underline">
        Open live console
      </Link>
    </Card>
  );
}
