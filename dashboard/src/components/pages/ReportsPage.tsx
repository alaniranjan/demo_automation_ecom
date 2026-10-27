'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { formatDuration, formatStartTime } from '@/lib/format';
import type { RunRecord, TestStatus } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { RunTargets } from '../browsers';
import { Card } from '../Card';
import { ActionMenu } from '../dropdowns';
import {
  ChartIcon,
  ExternalIcon,
  EyeIcon,
  LoaderIcon,
  MoreIcon,
  PlayIcon,
  SearchIcon,
  TableIcon,
  TrashIcon,
} from '../icons';
import { EmptyState, PageHeader, buttonStyles } from '../PageHeader';
import { useDashboard } from '../providers/DashboardProvider';
import { StatusPill } from '../RunsTable';
import { Checkbox, SelectionBar } from '../SelectionBar';
import { STATUS_META } from '../status';
import { runOutcome } from '../suites';
import { Modal } from '../ui';
import { PageSkeleton } from './PageSkeleton';

type OutcomeFilter = 'all' | TestStatus;
const OUTCOME_FILTERS: OutcomeFilter[] = ['all', 'passed', 'failed', 'flaky'];
/** A run without a report this soon after it finished is still having it generated. */
const GENERATING_WINDOW_MS = 5 * 60_000;

function reportUrl(runId: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/report/index.html`;
}

type ReportState = 'ready' | 'generating' | 'missing';

function reportState(run: RunRecord, now: number | null): ReportState {
  if (run.report) return 'ready';
  const finished = new Date(run.startTime).getTime() + run.duration;
  return now !== null && now - finished < GENERATING_WINDOW_MS ? 'generating' : 'missing';
}

function ReportCell({ run, state }: { run: RunRecord; state: ReportState }) {
  if (state === 'ready') {
    return (
      <a
        href={reportUrl(run.id)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-accent-strong"
      >
        <ChartIcon width={13} height={13} /> Allure <ExternalIcon width={11} height={11} />
      </a>
    );
  }
  if (state === 'generating') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
        <LoaderIcon width={13} height={13} className="animate-spin [animation-duration:2.5s]" /> Generating…
      </span>
    );
  }
  return (
    <span
      className="text-xs text-ink-3"
      title="Runs older than the last 20, or recorded before per-run reports, have no report"
    >
      Not available
    </span>
  );
}

/** One Allure report per run, generated when the run finishes (passed or failed), in a table with a preview below. */
export function ReportsPage() {
  const { results, viewRun, refresh } = useDashboard();
  const now = useNow(5000);
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const runs = useMemo(() => [...(results?.runs ?? [])].reverse(), [results]);
  const projects = results?.catalog?.projects ?? [];

  if (!results) return <PageSkeleton />;

  const needle = query.trim().toLowerCase();
  const filtered = runs.filter(
    (run) =>
      (outcome === 'all' || runOutcome(run) === outcome) &&
      (!needle || `${run.id} ${run.suiteLabel}`.toLowerCase().includes(needle)),
  );
  const withReport = runs.filter((run) => run.report);
  const preview = withReport.find((run) => run.id === previewId) ?? withReport[0];

  // Only runs that still have a report can be selected; deleting keeps the runs themselves.
  const deletable = filtered.filter((run) => run.report).map((run) => run.id);
  const selectedIds = deletable.filter((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selectedIds.length === deletable.length ? new Set() : new Set(deletable));
  }

  function askDelete(ids: string[]) {
    if (ids.length === 0) return;
    setDeleteError(null);
    setPendingDelete(ids);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const response = await fetch('/api/run-reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: pendingDelete }),
    });
    setDeleting(false);
    if (!response.ok) {
      setDeleteError(
        ((await response.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${response.status}`,
      );
      return;
    }
    const ids = pendingDelete;
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    setPendingDelete(null);
    await refresh();
  }

  function showPreview(run: RunRecord) {
    if (!run.report) return;
    setPreviewId(run.id);
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Allure Reports"
        description="Every run gets its own Allure report, generated as soon as it finishes, passed or failed."
        actions={
          results.reports.playwright && (
            <a
              href="/api/reports/playwright/index.html"
              target="_blank"
              rel="noreferrer"
              className={buttonStyles.secondary}
            >
              <TableIcon width={14} height={14} /> Latest Playwright report
            </a>
          )
        }
      />

      {runs.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Each run's Allure report appears here when it finishes. Start one to see it."
          action={
            <Link href="/runs" className={buttonStyles.primary}>
              <PlayIcon width={14} height={14} /> Start a run
            </Link>
          }
        />
      ) : (
        <>
          <Card
            title="Run reports"
            subtitle={`${withReport.length} report${withReport.length === 1 ? '' : 's'} kept · ${filtered.length} of ${runs.length} runs shown`}
            flush
          >
            <div className="flex flex-col gap-3 px-5 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div role="radiogroup" aria-label="Filter by outcome" className="flex flex-wrap gap-1.5">
                {OUTCOME_FILTERS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={outcome === option}
                    onClick={() => setOutcome(option)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-all duration-200 ${
                      outcome === option
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-line text-ink-2 hover:bg-surface-2'
                    }`}
                  >
                    {option !== 'all' && (
                      <span className="size-2 rounded-full" style={{ background: STATUS_META[option].color }} />
                    )}
                    {option === 'all' ? 'All runs' : STATUS_META[option].label}
                  </button>
                ))}
              </div>
              <label className="relative">
                <span className="sr-only">Search runs</span>
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search run ID or suite"
                  className="h-9 w-56 rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-3"
                />
              </label>
            </div>

            <div className="border-t border-line">
              {deletable.length > 0 && (
                <SelectionBar
                  noun="reports"
                  shown={deletable.length}
                  selected={selectedIds.length}
                  onToggleAll={toggleAll}
                  onDeleteSelected={() => askDelete(selectedIds)}
                  onDeleteAll={() => askDelete(deletable)}
                />
              )}
            </div>
            <div className="max-h-128 overflow-auto">
              <table className="w-full min-w-245 text-left text-sm">
                <thead className="sticky top-0 z-10 bg-surface text-xs text-ink-3">
                  <tr className="border-b border-line">
                    <th scope="col" className="w-10 py-3 pl-5 pr-2">
                      <Checkbox
                        checked={deletable.length > 0 && selectedIds.length === deletable.length}
                        indeterminate={selectedIds.length > 0 && selectedIds.length < deletable.length}
                        onChange={toggleAll}
                        label="Select all reports shown"
                      />
                    </th>
                    <th scope="col" className="py-3 pr-3 font-medium">
                      Run ID
                    </th>
                    <th scope="col" className="py-3 pr-3 font-medium">
                      Browser / Device
                    </th>
                    <th scope="col" className="py-3 pr-3 font-medium">
                      Start Time
                    </th>
                    <th scope="col" className="py-3 pr-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-3 pr-3 text-right font-medium">
                      Passed
                    </th>
                    <th scope="col" className="py-3 pr-3 text-right font-medium">
                      Failed
                    </th>
                    <th scope="col" className="hidden py-3 pr-3 text-right font-medium md:table-cell">
                      Duration
                    </th>
                    <th scope="col" className="py-3 pr-3 font-medium">
                      Report
                    </th>
                    <th scope="col" className="py-3 pr-5 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((run) => {
                    const state = reportState(run, now);
                    const active = preview?.id === run.id;
                    return (
                      <tr
                        key={run.id}
                        tabIndex={run.report ? 0 : -1}
                        aria-label={run.report ? `Preview the report of ${run.id}` : undefined}
                        onClick={() => showPreview(run)}
                        onKeyDown={(event) => {
                          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            showPreview(run);
                          }
                        }}
                        className={`group/row border-b border-line transition-colors duration-150 last:border-0 focus-visible:outline-none ${
                          run.report ? 'cursor-pointer hover:bg-surface-2/60 focus-visible:bg-surface-2/60' : ''
                        } ${active || selected.has(run.id) ? 'bg-accent-soft/60' : ''}`}
                      >
                        <td className="py-3 pl-5 pr-2">
                          {run.report && (
                            <Checkbox
                              checked={selected.has(run.id)}
                              onChange={() => toggle(run.id)}
                              label={`Select the report of ${run.id}`}
                            />
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <span className="flex items-center gap-2.5">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ background: STATUS_META[runOutcome(run)].color }}
                              aria-hidden="true"
                            />
                            <span className="min-w-0">
                              <span className="block font-mono text-[13px] text-ink transition-colors group-hover/row:text-accent-strong">
                                #{run.id}
                              </span>
                              <span className="block truncate text-xs text-ink-3">
                                {run.suiteLabel} · {run.trigger}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <RunTargets run={run} projects={projects} />
                        </td>
                        <td className="py-3 pr-3 text-ink-2">{formatStartTime(run.startTime)}</td>
                        <td className="py-3 pr-3">
                          <StatusPill status={runOutcome(run)} />
                        </td>
                        <td className="py-3 pr-3 text-right tabular-nums text-ink">
                          {run.counts.passed + run.counts.flaky}
                        </td>
                        <td
                          className={`py-3 pr-3 text-right tabular-nums ${run.counts.failed > 0 ? 'font-medium text-critical-text' : 'text-ink-2'}`}
                        >
                          {run.counts.failed}
                        </td>
                        <td className="hidden py-3 pr-3 tabular-nums text-ink-2 md:table-cell md:text-right">
                          {formatDuration(run.duration)}
                        </td>
                        <td className="py-3 pr-3">
                          <ReportCell run={run} state={state} />
                        </td>
                        {/* Clicks inside the menu must not also preview the row. */}
                        <td
                          className="py-3 pr-5"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <span className="flex items-center justify-end">
                            <ActionMenu
                              label={`Actions for ${run.id}`}
                              trigger={<MoreIcon />}
                              items={[
                                {
                                  label: 'Preview report',
                                  icon: ChartIcon,
                                  disabled: !run.report,
                                  onSelect: () => showPreview(run),
                                },
                                {
                                  label: 'Open in new tab',
                                  icon: ExternalIcon,
                                  disabled: !run.report,
                                  onSelect: () => window.open(reportUrl(run.id), '_blank', 'noopener'),
                                },
                                {
                                  label: 'Run details',
                                  icon: EyeIcon,
                                  separated: true,
                                  onSelect: () => viewRun(run.id),
                                },
                                {
                                  label: 'Delete report',
                                  icon: TrashIcon,
                                  tone: 'danger',
                                  disabled: !run.report,
                                  onSelect: () => askDelete([run.id]),
                                },
                              ]}
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-5 py-10 text-center text-sm text-ink-3">
                        No runs match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div ref={previewRef} className="scroll-mt-20">
            {preview ? (
              <Card
                title={`Allure report · ${preview.id}`}
                subtitle={`${preview.suiteLabel} · ${formatStartTime(preview.startTime)} · click another row to switch`}
                flush
                actions={
                  <a href={reportUrl(preview.id)} target="_blank" rel="noreferrer" className={buttonStyles.secondary}>
                    Open full report <ExternalIcon width={14} height={14} />
                  </a>
                }
              >
                <div className="relative border-t border-line bg-surface-2">
                  {loaded !== preview.id && (
                    <div className="absolute inset-0 grid place-items-center text-sm text-ink-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        Loading report…
                      </span>
                    </div>
                  )}
                  <iframe
                    key={preview.id}
                    src={reportUrl(preview.id)}
                    title={`Allure report of ${preview.id}`}
                    onLoad={() => setLoaded(preview.id)}
                    className={`block h-[75vh] min-h-130 w-full transition-opacity duration-500 ${
                      loaded === preview.id ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </div>
              </Card>
            ) : (
              <EmptyState
                title="No report generated yet"
                description="The next run's Allure report is generated when it finishes and appears here."
              />
            )}
          </div>

          <Modal
            open={pendingDelete !== null}
            onClose={() => setPendingDelete(null)}
            title={
              pendingDelete?.length === 1
                ? `Delete the report of ${pendingDelete[0]}?`
                : `Delete ${pendingDelete?.length ?? 0} reports?`
            }
            size="max-w-md"
            footer={
              <>
                <button type="button" onClick={() => setPendingDelete(null)} className={buttonStyles.secondary}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                  className={`${buttonStyles.primary} bg-critical hover:bg-critical`}
                >
                  <TrashIcon width={14} height={14} />{' '}
                  {deleting
                    ? 'Deleting…'
                    : pendingDelete?.length === 1
                      ? 'Delete report'
                      : `Delete ${pendingDelete?.length ?? 0} reports`}
                </button>
              </>
            }
          >
            <p className="text-sm text-ink-2">
              This permanently removes the Allure report{pendingDelete?.length === 1 ? '' : 's'} of{' '}
              {pendingDelete?.slice(0, 4).join(', ')}
              {(pendingDelete?.length ?? 0) > 4 ? ', …' : ''}. The runs, their results, screenshots and videos stay in
              Execution History.
            </p>
            {deleteError && <p className="mt-3 text-sm text-critical-text">{deleteError}</p>}
          </Modal>
        </>
      )}
    </div>
  );
}
