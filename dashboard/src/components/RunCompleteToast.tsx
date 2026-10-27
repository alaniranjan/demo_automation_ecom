'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { formatDuration } from '@/lib/format';
import { ArrowRightIcon, CheckCircleIcon, CloseIcon, StopIcon, XCircleIcon } from './icons';
import { useDashboard } from './providers/DashboardProvider';
import { runOutcome } from './suites';

const AUTO_HIDE_MS = 15_000;

/** "Run finished" notification; clicking it opens the run in Execution History. */
export function RunCompleteToast() {
  const { completedRun, dismissCompletedRun, results, viewRun } = useDashboard();
  const router = useRouter();

  useEffect(() => {
    if (!completedRun) return;
    const timer = setTimeout(dismissCompletedRun, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [completedRun, dismissCompletedRun]);

  if (!completedRun) return null;
  const record = results?.runs.find((run) => run.id === completedRun.runId);
  const cancelled = completedRun.phase === 'cancelled';
  const outcome = cancelled ? 'cancelled' : record ? runOutcome(record) : completedRun.phase === 'failed' ? 'failed' : 'passed';
  const failed = outcome === 'failed';

  const tone = cancelled
    ? { Icon: StopIcon, ring: 'border-line', iconClass: 'bg-neutral text-white', word: 'cancelled' }
    : failed
      ? { Icon: XCircleIcon, ring: 'border-critical/50', iconClass: 'bg-critical text-white', word: 'failed' }
      : { Icon: CheckCircleIcon, ring: 'border-good/50', iconClass: 'bg-good text-white', word: 'passed' };

  function open() {
    if (!completedRun) return;
    dismissCompletedRun();
    router.push('/history');
    if (record) viewRun(record.id);
  }

  return (
    <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-50 w-[min(24rem,calc(100vw-2.5rem))]">
      <div
        key={completedRun.sequence}
        className={`animate-enter group relative flex items-start gap-3 rounded-2xl border bg-surface p-4 pr-10 shadow-2xl shadow-black/40 transition-all duration-200 hover:-translate-y-0.5 ${tone.ring}`}
      >
        <button
          type="button"
          onClick={open}
          aria-label={`Open run ${completedRun.runId} in Execution History`}
          className="absolute inset-0 rounded-2xl focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tone.iconClass}`}>
          <tone.Icon width={18} height={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            Run {completedRun.runId} {tone.word}
          </p>
          {record && !cancelled && (
            <p className="mt-0.5 truncate text-xs text-ink-2">
              {record.counts.passed + record.counts.flaky}/{record.total} passed
              {record.counts.failed > 0 && ` · ${record.counts.failed} failed`} · {formatDuration(record.duration)} ·{' '}
              {record.suiteLabel}
            </p>
          )}
          <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-strong">
            View in Execution History{' '}
            <ArrowRightIcon width={12} height={12} className="transition-transform group-hover:translate-x-0.5" />
          </p>
        </div>
        <button
          type="button"
          onClick={dismissCompletedRun}
          aria-label="Dismiss"
          className="absolute right-2 top-2 z-10 rounded-md p-1 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
