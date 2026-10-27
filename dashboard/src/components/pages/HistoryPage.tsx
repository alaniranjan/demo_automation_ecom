'use client';

import { useMemo, useState, type ComponentType, type SVGProps } from 'react';
import { formatDuration, formatPercent } from '@/lib/format';
import type { RunRecord, RunTrigger, TestStatus } from '@/lib/types';
import { ActivityList, buildFeed } from '../ActivityFeed';
import { Card } from '../Card';
import { TrendChart } from '../dashboard/TrendChart';
import { Select } from '../dropdowns';
import {
  ClockIcon,
  DownloadIcon,
  GlobeIcon,
  GridIcon,
  HistoryIcon,
  LayersIcon,
  SearchIcon,
  ServerIcon,
  TerminalIcon,
  TrashIcon,
  TrendIcon,
  XCircleIcon,
} from '../icons';
import { EmptyState, PageHeader, buttonStyles } from '../PageHeader';
import { useDashboard } from '../providers/DashboardProvider';
import { RunsTable } from '../RunsTable';
import { STATUS_META } from '../status';
import { passRateOf, runOutcome, suiteIcon } from '../suites';
import { Modal } from '../ui';
import { PageSkeleton } from './PageSkeleton';

type OutcomeFilter = 'all' | Extract<TestStatus, 'passed' | 'failed' | 'flaky'>;
const OUTCOME_FILTERS: OutcomeFilter[] = ['all', 'passed', 'failed', 'flaky'];
const PAGE_SIZE = 20;

function StatTile({
  label,
  value,
  hint,
  Icon,
  iconClass,
}: {
  label: string;
  value: string;
  hint: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClass: string;
}) {
  return (
    <div className="group rounded-xl border border-line bg-surface p-4 shadow-card transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-2">{label}</span>
        <span
          className={`grid size-9 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-110 ${iconClass}`}
        >
          <Icon width={18} height={18} />
        </span>
      </div>
      <p className="mt-2 text-[26px] font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-3">{hint}</p>
    </div>
  );
}

export function HistoryPage() {
  const { results, live, refresh } = useDashboard();
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [suite, setSuite] = useState('all');
  const [trigger, setTrigger] = useState<RunTrigger | 'all'>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const runs = useMemo(() => results?.runs ?? [], [results]);
  const suites = useMemo(() => [...new Map(runs.map((run) => [run.suite, run.suiteLabel])).entries()], [runs]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...runs]
      .reverse()
      .filter(
        (run: RunRecord) =>
          (outcome === 'all' || runOutcome(run) === outcome) &&
          (suite === 'all' || run.suite === suite) &&
          (trigger === 'all' || run.trigger === trigger) &&
          (!needle || run.id.toLowerCase().includes(needle) || run.suiteLabel.toLowerCase().includes(needle)),
      );
  }, [runs, outcome, suite, trigger, query]);

  if (!results) return <PageSkeleton />;

  const averagePassRate = runs.length ? runs.reduce((sum, run) => sum + passRateOf(run), 0) / runs.length : 0;
  const averageDuration = runs.length ? runs.reduce((sum, run) => sum + run.duration, 0) / runs.length : 0;
  const failedRuns = runs.filter((run) => run.counts.failed > 0).length;

  async function clearHistory() {
    setClearing(true);
    await fetch('/api/runs', { method: 'DELETE' });
    await refresh();
    setClearing(false);
    setConfirmClear(false);
  }

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Execution History"
        description={`Every run stored by the backend (${results.meta.storeFile}), from the dashboard or a terminal.`}
        actions={
          <>
            {/* A file download from the API, not a page navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/runs?download=1" className={buttonStyles.secondary}>
              <DownloadIcon width={14} height={14} /> Export JSON
            </a>
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={runs.length === 0}
              className={`${buttonStyles.secondary} text-critical-text`}
            >
              <TrashIcon width={14} height={14} /> Clear history
            </button>
          </>
        }
      />

      {runs.length === 0 ? (
        <EmptyState
          title="No history yet"
          description="Runs are stored automatically as soon as results exist. Start a suite to begin."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile
              label="Total runs"
              value={String(runs.length)}
              hint={`Up to ${results.meta.maxRuns} are kept`}
              Icon={HistoryIcon}
              iconClass="bg-accent-soft text-accent-strong"
            />
            <StatTile
              label="Average pass rate"
              value={formatPercent(Math.round(averagePassRate * 1000) / 1000)}
              hint="Across all stored runs"
              Icon={TrendIcon}
              iconClass="bg-good-soft text-good-text"
            />
            <StatTile
              label="Average duration"
              value={formatDuration(averageDuration)}
              hint="Wall-clock time per run"
              Icon={ClockIcon}
              iconClass="bg-accent-soft text-accent-strong"
            />
            <StatTile
              label="Runs with failures"
              value={String(failedRuns)}
              hint={`${runs.length - failedRuns} fully green`}
              Icon={XCircleIcon}
              iconClass="bg-critical-soft text-critical-text"
            />
          </div>

          <TrendChart runs={runs} limit={30} title="Results over time" />

          <Card title="All runs" subtitle={`${filtered.length} of ${runs.length} runs`} flush>
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
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <span className="sr-only">Search runs</span>
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search run ID"
                    className="h-9 w-44 rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-3"
                  />
                </label>
                <Select
                  label="Suite"
                  value={suite}
                  onChange={setSuite}
                  options={[
                    { value: 'all', label: 'All suites', count: runs.length, icon: LayersIcon },
                    ...suites.map(([key, label]) => ({
                      value: key,
                      label,
                      count: runs.filter((run) => run.suite === key).length,
                      icon: suiteIcon(key),
                    })),
                  ]}
                  className="w-44"
                />
                <Select
                  label="Source"
                  value={trigger}
                  onChange={setTrigger}
                  options={[
                    { value: 'all', label: 'Any source', count: runs.length, icon: GlobeIcon },
                    {
                      value: 'dashboard',
                      label: 'Dashboard',
                      count: runs.filter((run) => run.trigger === 'dashboard').length,
                      icon: GridIcon,
                    },
                    {
                      value: 'terminal',
                      label: 'Terminal',
                      count: runs.filter((run) => run.trigger === 'terminal').length,
                      icon: TerminalIcon,
                    },
                    {
                      value: 'ci',
                      label: 'GitHub Actions',
                      count: runs.filter((run) => run.trigger === 'ci').length,
                      icon: ServerIcon,
                    },
                  ]}
                  className="w-44"
                  align="end"
                />
              </div>
            </div>
            <div className="border-t border-line">
              <RunsTable runs={filtered.slice(0, limit)} emptyMessage="No runs match these filters." />
            </div>
            {filtered.length > limit && (
              <div className="border-t border-line p-3 text-center">
                <button
                  type="button"
                  onClick={() => setLimit((value) => value + PAGE_SIZE)}
                  className={buttonStyles.ghost}
                >
                  Show {Math.min(PAGE_SIZE, filtered.length - limit)} more
                </button>
              </div>
            )}
          </Card>
        </>
      )}

      <div id="activity" className="scroll-mt-24">
        <Card title="Activity log" subtitle="Runs started and finished, failures and live test events">
          <div className="max-h-[480px] overflow-y-auto pr-1">
            <ActivityList items={buildFeed(results.activity, live)} />
          </div>
        </Card>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear execution history?"
        size="max-w-md"
        footer={
          <>
            <button type="button" onClick={() => setConfirmClear(false)} className={buttonStyles.secondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void clearHistory()}
              disabled={clearing}
              className={`${buttonStyles.primary} bg-critical hover:bg-critical`}
            >
              <TrashIcon width={14} height={14} /> Delete {runs.length} runs
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          This permanently deletes {runs.length} stored runs and the activity log from{' '}
          <span className="font-mono">{results.meta.storeFile}</span>. Test reports and the latest results are not
          affected. Export the history first if you want to keep a copy.
        </p>
      </Modal>
    </div>
  );
}
