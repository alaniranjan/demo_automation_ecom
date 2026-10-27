'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatDuration, formatStartTime } from '@/lib/format';
import type { RunRecord, TestStatus } from '@/lib/types';
import { RunTargets } from './browsers';
import { ActionMenu } from './dropdowns';
import { EyeIcon, MoreIcon, RefreshIcon, TrashIcon } from './icons';
import { buttonStyles } from './PageHeader';
import { useDashboard } from './providers/DashboardProvider';
import { rerunRequest } from './runActions';
import { STATUS_META } from './status';
import { runOutcome } from './suites';
import { Checkbox, SelectionBar } from './SelectionBar';
import { Modal } from './ui';

const SOLID_STATUS: Record<TestStatus, string> = {
  passed: 'bg-good text-white',
  failed: 'bg-critical text-white',
  flaky: 'bg-serious text-white',
  skipped: 'bg-warning text-black/80',
};

export function StatusPill({ status }: { status: TestStatus }) {
  return (
    <span
      className={`inline-flex min-w-[4.5rem] justify-center rounded-md px-2.5 py-1 text-xs font-semibold ${SOLID_STATUS[status]}`}
    >
      {STATUS_META[status].label}
    </span>
  );
}

function RowActions({ run, onDelete }: { run: RunRecord; onDelete: (run: RunRecord) => void }) {
  const { results, startRun, activeRun, viewRun } = useDashboard();
  const router = useRouter();
  const request = rerunRequest(run, results?.catalog ?? null);

  return (
    <ActionMenu
      label={`Actions for ${run.id}`}
      trigger={<MoreIcon />}
      items={[
        { label: 'View', icon: EyeIcon, onSelect: () => viewRun(run.id) },
        {
          label: activeRun ? 'Re-run (runner busy)' : 'Re-run',
          icon: RefreshIcon,
          disabled: !request || Boolean(activeRun),
          onSelect: async () => {
            if (request && !(await startRun(request))) router.push('/runs');
          },
        },
        { label: 'Delete', icon: TrashIcon, tone: 'danger', separated: true, onSelect: () => onDelete(run) },
      ]}
    />
  );
}

/** Runs in the dashboard's table style: ID, start, duration, status, counts and actions. */
export function RunsTable({
  runs,
  emptyMessage = 'No runs recorded yet.',
}: {
  runs: RunRecord[];
  emptyMessage?: string;
}) {
  const { viewRun, viewedRunId, refresh, results } = useDashboard();
  const projects = results?.catalog?.projects ?? [];
  const [pendingDelete, setPendingDelete] = useState<RunRecord[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Selections of runs that are filtered out or gone no longer count.
  const selectedRuns = runs.filter((run) => selected.has(run.id));

  function askDelete(targets: RunRecord[]) {
    if (targets.length === 0) return;
    setDeleteError(null);
    setPendingDelete(targets);
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const all = runs.length > 0 && selectedRuns.length === runs.length;
    setSelected(all ? new Set() : new Set(runs.map((run) => run.id)));
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const ids = pendingDelete.map((run) => run.id);
    setDeleting(true);
    const response = await fetch('/api/runs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setDeleting(false);
    if (!response.ok) {
      setDeleteError(
        ((await response.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${response.status}`,
      );
      return;
    }
    if (viewedRunId && ids.includes(viewedRunId)) viewRun(null);
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    setPendingDelete(null);
    await refresh();
  }

  return (
    <div>
      {runs.length > 0 && (
        <SelectionBar
          noun="runs"
          shown={runs.length}
          selected={selectedRuns.length}
          onToggleAll={toggleAll}
          onDeleteSelected={() => askDelete(selectedRuns)}
          onDeleteAll={() => askDelete(runs)}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-215 text-left text-sm">
          <thead className="text-xs text-ink-3">
            <tr className="border-b border-line">
              <th scope="col" className="w-10 py-3 pl-5 pr-2">
                <Checkbox
                  checked={runs.length > 0 && selectedRuns.length === runs.length}
                  indeterminate={selectedRuns.length > 0 && selectedRuns.length < runs.length}
                  onChange={toggleAll}
                  label="Select all runs shown"
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
              <th scope="col" className="hidden py-3 pr-3 font-medium md:table-cell">
                Duration
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
              <th scope="col" className="hidden py-3 pr-3 text-right font-medium sm:table-cell">
                Skipped
              </th>
              <th scope="col" className="py-3 pr-5 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const outcome = runOutcome(run);
              return (
                <tr
                  key={run.id}
                  tabIndex={0}
                  aria-label={`Open run ${run.id}`}
                  onClick={() => viewRun(run.id)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      viewRun(run.id);
                    }
                  }}
                  className={`group/row cursor-pointer border-b border-line transition-colors duration-150 last:border-0 hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:outline-none ${
                    selected.has(run.id) ? 'bg-accent-soft/50' : ''
                  }`}
                >
                  <td className="py-3 pl-5 pr-2">
                    <Checkbox
                      checked={selected.has(run.id)}
                      onChange={() => toggle(run.id)}
                      label={`Select run ${run.id}`}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: STATUS_META[outcome].color }}
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
                  <td className="hidden py-3 pr-3 tabular-nums text-ink-2 md:table-cell">
                    {formatDuration(run.duration)}
                  </td>
                  <td className="py-3 pr-3">
                    <StatusPill status={outcome} />
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-ink">{run.counts.passed + run.counts.flaky}</td>
                  <td
                    className={`py-3 pr-3 text-right tabular-nums ${run.counts.failed > 0 ? 'font-medium text-critical-text' : 'text-ink-2'}`}
                  >
                    {run.counts.failed}
                  </td>
                  <td className="hidden py-3 pr-3 text-right tabular-nums text-ink-2 sm:table-cell">
                    {run.counts.skipped}
                  </td>
                  {/* Clicks inside the menu must not also open the row. */}
                  <td
                    className="py-3 pr-5"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <span className="flex items-center justify-end">
                      <RowActions run={run} onDelete={(target) => askDelete([target])} />
                    </span>
                  </td>
                </tr>
              );
            })}
            {runs.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-sm text-ink-3">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={
          pendingDelete?.length === 1
            ? `Delete run ${pendingDelete[0]?.id}?`
            : `Delete ${pendingDelete?.length ?? 0} runs?`
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
                  ? 'Delete run'
                  : `Delete ${pendingDelete?.length ?? 0} runs`}
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          {pendingDelete?.length === 1 && pendingDelete[0]
            ? `This permanently removes the run (${pendingDelete[0].suiteLabel}, ${formatStartTime(pendingDelete[0].startTime)}), its`
            : `This permanently removes these ${pendingDelete?.length ?? 0} runs (${pendingDelete
                ?.slice(0, 4)
                .map((run) => run.id)
                .join(', ')}${(pendingDelete?.length ?? 0) > 4 ? ', …' : ''}), their`}{' '}
          per-test results, archived screenshots and videos, and Allure reports. Other runs are not affected.
        </p>
        {deleteError && <p className="mt-3 text-sm text-critical-text">{deleteError}</p>}
      </Modal>
    </div>
  );
}
