'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { formatDuration, formatPercent, formatStartTime } from '@/lib/format';
import { TEST_STATUSES, type RunRecord, type TestStatus } from '@/lib/types';
import { TargetIcon, targetLabel } from './browsers';
import { ChevronIcon, DownloadIcon, RefreshIcon } from './icons';
import { buttonStyles } from './PageHeader';
import { useDashboard } from './providers/DashboardProvider';
import { rerunRequest } from './runActions';
import { STATUS_META, StatusBadge } from './status';
import { passRateOf, runOutcome } from './suites';
import { MediaBadges, MediaGallery } from './TestMedia';
import { Modal } from './ui';

const STATUS_ORDER: Record<TestStatus, number> = {
  failed: 0,
  flaky: 1,
  skipped: 2,
  passed: 3,
};

/** Full details of one stored run, loaded from /api/runs/{id}. */
export function RunDetailsDialog() {
  const { viewedRunId, viewRun, results, startRun, activeRun } = useDashboard();
  const router = useRouter();
  const projects = results?.catalog?.projects ?? [];
  const [run, setRun] = useState<RunRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TestStatus | 'all'>('all');
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  useEffect(() => {
    if (!viewedRunId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(null);
    setError(null);
    setFilter('all');
    setExpandedTest(null);
    fetch(`/api/runs/${encodeURIComponent(viewedRunId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(((await response.json()) as { error?: string }).error ?? `HTTP ${response.status}`);
        return (await response.json()) as RunRecord;
      })
      .then((data) => !cancelled && setRun(data))
      .catch(
        (reason: unknown) => !cancelled && setError(reason instanceof Error ? reason.message : 'Could not load run'),
      );
    return () => {
      cancelled = true;
    };
  }, [viewedRunId]);

  const tests = useMemo(
    () =>
      [...(run?.tests ?? [])]
        .filter((test) => filter === 'all' || test.status === filter)
        .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [run, filter],
  );
  const request = run ? rerunRequest(run, results?.catalog ?? null) : null;

  async function rerun() {
    if (!request) return;
    const message = await startRun(request);
    if (message) {
      setError(message);
      return;
    }
    viewRun(null);
    router.push('/runs');
  }

  return (
    <Modal
      open={viewedRunId !== null}
      onClose={() => viewRun(null)}
      title={viewedRunId ?? ''}
      subtitle={
        run
          ? `${run.suiteLabel} · ${run.trigger === 'dashboard' ? 'Started from dashboard' : 'Started from terminal'}`
          : 'Loading…'
      }
      footer={
        run && (
          <>
            <a href={`/api/runs/${encodeURIComponent(run.id)}?download=1`} className={buttonStyles.secondary}>
              <DownloadIcon width={14} height={14} /> Download JSON
            </a>
            {request && (
              <button
                type="button"
                onClick={() => void rerun()}
                disabled={Boolean(activeRun)}
                className={buttonStyles.primary}
              >
                <RefreshIcon width={14} height={14} /> Re-run
              </button>
            )}
          </>
        )
      }
    >
      {error && <p className="mb-4 rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical-text">{error}</p>}
      {!run && !error && <div className="h-40 animate-pulse rounded-xl bg-surface-2" />}
      {run && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Status', <StatusBadge key="s" status={runOutcome(run)} />],
              ['Started', formatStartTime(run.startTime)],
              ['Duration', formatDuration(run.duration)],
              ['Pass rate', formatPercent(Math.round(passRateOf(run) * 1000) / 1000)],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-surface-2/70 px-3 py-2.5">
                <p className="text-xs text-ink-3">{label}</p>
                <div className="mt-1 text-sm font-medium text-ink">{value}</div>
              </div>
            ))}
          </div>

          <div role="radiogroup" aria-label="Filter tests" className="flex flex-wrap gap-1.5">
            {(['all', ...TEST_STATUSES] as const).map((option) => {
              const count = option === 'all' ? run.total : run.counts[option];
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={filter === option}
                  onClick={() => setFilter(option)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors ${
                    filter === option
                      ? 'border-accent bg-accent-soft text-ink'
                      : 'border-line text-ink-2 hover:bg-surface-2'
                  }`}
                >
                  {option !== 'all' && (
                    <span className="size-2 rounded-full" style={{ background: STATUS_META[option].color }} />
                  )}
                  {option === 'all' ? 'All' : STATUS_META[option].label}
                  <span className="tabular-nums text-ink-3">{count}</span>
                </button>
              );
            })}
          </div>

          {run.tests?.some((test) => test.attachments?.length) && (
            <p className="text-xs text-ink-3">Failed tests keep a screenshot and a video of the whole scenario; click one to see them.</p>
          )}
          {run.tests && run.tests.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2/60 text-xs text-ink-3">
                  <tr>
                    <th className="py-2 pl-4 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Test</th>
                    <th className="hidden py-2 pr-3 font-medium sm:table-cell">Feature</th>
                    <th className="py-2 pr-3 font-medium">Media</th>
                    <th className="py-2 pr-4 text-right font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test, index) => {
                    const key = `${test.file}-${test.title}-${index}`;
                    const hasMedia = Boolean(test.attachments?.length);
                    const isOpen = expandedTest === key;
                    return (
                      <Fragment key={key}>
                        <tr
                          onClick={() => hasMedia && setExpandedTest(isOpen ? null : key)}
                          className={`border-t border-line align-top transition-colors ${hasMedia ? 'cursor-pointer hover:bg-surface-2/60' : ''} ${isOpen ? 'bg-surface-2/60' : ''}`}
                        >
                          <td className="py-2.5 pl-4 pr-3">
                            <StatusBadge status={test.status} />
                          </td>
                          <td className="py-2.5 pr-3">
                            <p className="flex items-center gap-1.5 text-ink">
                              {hasMedia && (
                                <ChevronIcon
                                  width={14}
                                  height={14}
                                  className={`shrink-0 text-ink-3 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                                />
                              )}
                              {test.title}
                            </p>
                            {test.error && (
                              <p className="mt-0.5 line-clamp-2 font-mono text-xs text-critical-text">{test.error}</p>
                            )}
                            {!test.error && (test.describe || test.project) && (
                              <p className="flex items-center gap-1.5 text-xs text-ink-3">
                                {test.describe}
                                {test.describe && test.project && ' · '}
                                {test.project && (
                                  <>
                                    <TargetIcon name={test.project} projects={projects} width={12} height={12} />
                                    {targetLabel(test.project, projects)}
                                  </>
                                )}
                              </p>
                            )}
                          </td>
                          <td className="hidden py-2.5 pr-3 text-ink-2 sm:table-cell">{test.feature}</td>
                          <td className="py-2.5 pr-3">
                            <MediaBadges attachments={test.attachments ?? []} />
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-ink-2">
                            {test.duration ? formatDuration(test.duration) : '-'}
                          </td>
                        </tr>
                        {isOpen && test.attachments && (
                          <tr className="border-t border-line bg-surface-2/30">
                            <td colSpan={5} className="animate-enter p-4">
                              <MediaGallery
                                attachments={test.attachments}
                                title={test.title}
                                project={projects.find((entry) => entry.name === test.project)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {tests.length === 0 && (
                    <tr className="border-t border-line">
                      <td colSpan={5} className="py-6 text-center text-sm text-ink-3">
                        No tests with this status.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-3">
              Per-test results were not recorded for this run (it predates the backend store).
            </p>
          )}

          {run.args.length > 0 && <p className="font-mono text-xs text-ink-3">playwright test {run.args.join(' ')}</p>}
        </div>
      )}
    </Modal>
  );
}
