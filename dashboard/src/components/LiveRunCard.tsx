'use client';

import { useEffect, useRef } from 'react';
import { formatDuration } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { TargetIcon, targetLabel } from './browsers';
import { Card } from './Card';
import { ExternalIcon, StopIcon, TerminalIcon } from './icons';
import { buttonStyles } from './PageHeader';
import { useDashboard } from './providers/DashboardProvider';

function lineClass(line: string): string {
  if (line.startsWith('$ ')) return 'text-[#8fb8f0]';
  if (/✘|\bfailed\b|Error:/.test(line)) return 'text-[#ff8f8f]';
  if (/✓|\bpassed\b/.test(line)) return 'text-[#86e08a]';
  if (/\bflaky\b/.test(line)) return 'text-[#f6c75a]';
  return '';
}

/** Live progress (from the live reporter), tests executing right now, and the runner's console. */
export function LiveRunCard() {
  const { run, lines, busy, live, activeRun, cancelRun, results } = useDashboard();
  const projects = results?.catalog?.projects ?? [];
  const now = useNow(1000);
  const consoleRef = useRef<HTMLPreElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    const element = consoleRef.current;
    if (element && stickToBottomRef.current) element.scrollTop = element.scrollHeight;
  }, [lines]);

  const relevantLive =
    live && (activeRun ? new Date(live.startedAt).getTime() >= new Date(activeRun.startedAt).getTime() - 5000 : true)
      ? live
      : null;
  const counts = relevantLive?.counts;
  const completed = counts ? counts.passed + counts.failed + counts.flaky + counts.skipped : 0;
  const total = relevantLive?.total ?? 0;
  const finished = !activeRun && relevantLive?.status === 'done';
  const percent =
    activeRun?.phase === 'reporting' || finished ? 100 : total ? Math.round((completed / total) * 100) : 0;
  const elapsed =
    activeRun && now !== null
      ? now - new Date(activeRun.startedAt).getTime()
      : run?.startedAt && run.finishedAt
        ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
        : null;
  const failing = (counts?.failed ?? 0) > 0;

  return (
    <Card
      title={activeRun ? `Run #${activeRun.runId ?? '…'}` : run?.runId ? `Last run #${run.runId}` : 'Live run'}
      subtitle={
        activeRun
          ? `${activeRun.label}${activeRun.source === 'terminal' ? ' · started from a terminal' : ''}`
          : 'Start a run to stream its progress here'
      }
      actions={
        (busy || run?.externalUrl) && (
          <div className="flex flex-wrap gap-2">
            {run?.externalUrl && (
              <a href={run.externalUrl} target="_blank" rel="noreferrer" className={buttonStyles.secondary}>
                View on GitHub <ExternalIcon width={13} height={13} />
              </a>
            )}
            {busy && (
              <button
                type="button"
                onClick={() => void cancelRun()}
                className={`${buttonStyles.secondary} text-critical-text`}
              >
                <StopIcon width={13} height={13} /> Stop run
              </button>
            )}
          </div>
        )
      }
      className="flex flex-col"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Progress', value: total ? `${completed}/${total}` : '-' },
          {
            label: 'Running',
            value: String(activeRun ? (relevantLive?.running.length ?? 0) : 0),
            tone: 'text-warning-text',
          },
          {
            label: 'Passed',
            value: String(counts ? counts.passed + counts.flaky : 0),
            tone: 'text-good-text',
          },
          {
            label: 'Failed',
            value: String(counts?.failed ?? 0),
            tone: failing ? 'text-critical-text' : '',
          },
          {
            label: 'Elapsed',
            value: elapsed === null ? '-' : formatDuration(Math.max(0, elapsed)),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-surface-2/70 px-3 py-2.5 transition-colors duration-200 hover:bg-surface-2"
          >
            <p className="text-[11px] font-medium text-ink-3">{stat.label}</p>
            <p className={`mt-0.5 text-lg font-semibold tabular-nums text-ink ${stat.tone ?? ''}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-smooth ${failing ? 'bg-critical' : 'bg-good'} ${activeRun ? 'progress-active' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {activeRun && relevantLive && relevantLive.running.length > 0 && (
        <ul className="mt-4 space-y-2">
          {relevantLive.running.map((test) => (
            <li key={test.id} className="animate-enter rounded-xl border border-line px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
                  <TargetIcon name={test.project} projects={projects} width={16} height={16} className="shrink-0" />
                  <span className="sr-only">{targetLabel(test.project, projects)}:</span>
                  <span className="truncate">{test.title}</span>
                </p>
                {now !== null && (
                  <span className="shrink-0 text-xs tabular-nums text-ink-3">
                    {formatDuration(Math.max(0, now - new Date(test.startedAt).getTime()))}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate font-mono text-xs text-ink-3">
                {test.step ?? 'Starting'}
                {test.url && ` · ${test.url}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col overflow-hidden rounded-xl bg-console ring-1 ring-black/10">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-[11px] text-[#8a8983]">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <TerminalIcon width={13} height={13} className="ml-2" />
          Console
        </div>
        <pre
          ref={consoleRef}
          onScroll={(event) => {
            const element = event.currentTarget;
            stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
          }}
          className="max-h-90 min-h-24 overflow-auto p-4 font-mono text-[12px] leading-5 text-console-ink"
          aria-label="Run output"
          tabIndex={0}
        >
          {lines.length === 0 ? (
            <span className="text-[#8a8983]">
              {activeRun?.source === 'terminal'
                ? 'This run was started from a terminal; its output stays there. Progress above is live.'
                : 'Waiting for a run. Pick a suite or spec files and press Run.'}
            </span>
          ) : (
            lines.map((line, index) => (
              <div key={index} className={lineClass(line)}>
                {line || ' '}
              </div>
            ))
          )}
        </pre>
      </div>
    </Card>
  );
}
