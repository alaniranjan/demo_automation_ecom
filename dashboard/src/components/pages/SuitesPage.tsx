'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useMemo, useState } from 'react';
import { formatRelative } from '@/lib/format';
import { TEST_STATUSES, type TestStatus } from '@/lib/types';
import { useNow } from '@/lib/useNow';
import { Card } from '../Card';
import { Select } from '../dropdowns';
import { FeatureBreakdown } from '../FeatureBreakdown';
import { ALL_FOLDERS, folderOptions } from '../folders';
import { ChevronIcon, PlayIcon } from '../icons';
import { FeatureName, SpecBadges, SpecName, TestCaseTitle, confirmRealOrder } from '../specs';
import { EmptyState, PageHeader, buttonStyles } from '../PageHeader';
import { useDashboard } from '../providers/DashboardProvider';
import { StatusPill } from '../RunsTable';
import { StatusBadge } from '../status';
import { SuiteIcon, runOutcome } from '../suites';
import { TestTable } from '../TestTable';
import { PageSkeleton } from './PageSkeleton';

function isStatus(value: string | null): value is TestStatus {
  return (TEST_STATUSES as readonly string[]).includes(value ?? '');
}

export function SuitesPage() {
  const { results, startRun, activeRun } = useDashboard();
  const router = useRouter();
  const statusParam = useSearchParams().get('status');
  const now = useNow(60_000);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [folder, setFolder] = useState<string>(ALL_FOLDERS);
  const [error, setError] = useState<string | null>(null);

  // Latest outcome of each test, keyed by file + title.
  const latest = useMemo(() => {
    const map = new Map<string, TestStatus>();
    for (const test of results?.tests ?? []) map.set(`${test.file}::${test.title}`, test.status);
    return map;
  }, [results]);

  if (!results) return <PageSkeleton />;
  const catalog = results.catalog;
  const visibleFiles = (catalog?.files ?? []).filter((file) => folder === ALL_FOLDERS || file.feature === folder);
  const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every((file) => selected.has(file.file));

  async function run(request: Parameters<typeof startRun>[0]) {
    if ('files' in request && !confirmRealOrder((catalog?.files ?? []).filter((file) => request.files.includes(file.file)))) return;
    const message = await startRun(request);
    setError(message);
    if (!message) router.push('/runs');
  }

  function toggle(file: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Test Suites"
        description={
          catalog
            ? `${catalog.suites.length} suites from package.json · ${catalog.files.length} spec files · ${catalog.total} tests`
            : 'Reading the test catalog from the framework…'
        }
      />
      {error && <p className="rounded-lg bg-critical-soft px-4 py-2 text-sm text-critical-text">{error}</p>}

      {!catalog ? (
        <EmptyState
          title="Catalog unavailable"
          description="The dashboard could not list tests with `playwright test --list`. Check the framework folder."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {catalog.suites.map((suite) => {
              const last = [...results.runs].reverse().find((entry) => entry.suite === suite.script);
              return (
                <div
                  key={suite.script}
                  className="group flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent-strong transition-transform duration-200 group-hover:scale-110">
                      <SuiteIcon script={suite.script} width={20} height={20} />
                    </span>
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs tabular-nums text-ink-2">
                      {suite.count} {suite.count === 1 ? 'test' : 'tests'}
                    </span>
                  </div>
                  <p className="mt-4 font-semibold text-ink">{suite.label}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-ink-3" title={suite.command}>
                    npm run {suite.script}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-3">
                    {last ? (
                      <>
                        <span>Last run {now !== null ? formatRelative(last.startTime, now) : ''}</span>
                        <StatusPill status={runOutcome(last)} />
                      </>
                    ) : (
                      <span>Never run</span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(activeRun)}
                    onClick={() => void run({ suite: suite.script })}
                    className={`${buttonStyles.primary} mt-4`}
                  >
                    <PlayIcon width={13} height={13} /> Run suite
                  </button>
                </div>
              );
            })}
          </div>

          <Card
            title="Spec files"
            subtitle="Select files to run them together; expand a file to see its tests and their latest results"
            flush
            actions={
              <>
                <Select
                  label="Folder"
                  value={folder}
                  onChange={setFolder}
                  options={folderOptions(catalog, results.tests)}
                  className="w-48"
                  align="end"
                />
                <button
                  type="button"
                  disabled={selected.size === 0 || Boolean(activeRun)}
                  onClick={() => void run({ files: [...selected] })}
                  className={buttonStyles.primary}
                >
                  <PlayIcon width={13} height={13} /> Run selected ({selected.size})
                </button>
              </>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-y border-line text-xs text-ink-3">
                  <tr>
                    <th className="w-12 py-3 pl-5">
                      <input
                        type="checkbox"
                        aria-label={folder === ALL_FOLDERS ? 'Select all spec files' : `Select all spec files in ${folder}`}
                        checked={allVisibleSelected}
                        onChange={() =>
                          setSelected((current) => {
                            const next = new Set(current);
                            visibleFiles.forEach((file) => (allVisibleSelected ? next.delete(file.file) : next.add(file.file)));
                            return next;
                          })
                        }
                        className="size-4 accent-[var(--accent)]"
                      />
                    </th>
                    <th className="py-3 pr-3 font-medium">Spec file</th>
                    <th className="py-3 pr-3 font-medium">Feature</th>
                    <th className="py-3 pr-3 text-right font-medium">Tests</th>
                    <th className="hidden py-3 pr-3 font-medium lg:table-cell">Tags</th>
                    <th className="py-3 pr-5 font-medium">Latest result</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFiles.map((file) => {
                    const statuses = file.tests
                      .map((test) => latest.get(`${test.file}::${test.title}`))
                      .filter(Boolean) as TestStatus[];
                    const fileStatus: TestStatus | null = statuses.length
                      ? statuses.includes('failed')
                        ? 'failed'
                        : statuses.includes('flaky')
                          ? 'flaky'
                          : 'passed'
                      : null;
                    const tags = [...new Set(file.tests.flatMap((test) => test.tags))].sort();
                    const isOpen = expanded === file.file;
                    return (
                      <Fragment key={file.file}>
                        <tr
                          className={`border-b border-line transition-colors hover:bg-surface-2/60 ${isOpen ? 'bg-surface-2/60' : ''}`}
                        >
                          <td className="py-3 pl-5">
                            <input
                              type="checkbox"
                              aria-label={`Select ${file.file}`}
                              checked={selected.has(file.file)}
                              onChange={() => toggle(file.file)}
                              className="size-4 accent-[var(--accent)]"
                            />
                          </td>
                          <td className="py-3 pr-3">
                            <button
                              type="button"
                              onClick={() => setExpanded(isOpen ? null : file.file)}
                              aria-expanded={isOpen}
                              className="flex min-w-0 items-center gap-2 text-left text-[13px] hover:text-accent-strong"
                            >
                              <ChevronIcon
                                className={`shrink-0 text-ink-3 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                              />
                              <SpecName file={file.file} />
                            </button>
                            <span className="mt-1.5 flex pl-6">
                              <SpecBadges file={file} />
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-ink-2">
                            <FeatureName feature={file.feature} />
                          </td>
                          <td className="py-3 pr-3 text-right tabular-nums text-ink">{file.tests.length}</td>
                          <td className="hidden py-3 pr-3 lg:table-cell">
                            <span className="flex flex-wrap gap-1">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2"
                                >
                                  {tag}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className="py-3 pr-5">
                            {fileStatus ? (
                              <span className="flex items-center gap-2">
                                <StatusPill status={fileStatus} />
                                <span className="text-xs text-ink-3">
                                  {statuses.length}/{file.tests.length} ran
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-ink-3">Not in latest run</span>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-line bg-surface-2/30">
                            <td />
                            <td colSpan={5} className="py-3 pr-5">
                              <ul className="animate-enter space-y-1.5">
                                {file.tests.map((test) => {
                                  const status = latest.get(`${test.file}::${test.title}`);
                                  return (
                                    <li key={`${test.line}-${test.title}`} className="flex items-center gap-3 text-sm">
                                      {status ? (
                                        <StatusBadge status={status} />
                                      ) : (
                                        <span className="w-[74px] text-xs text-ink-3">Not run</span>
                                      )}
                                      <span className="flex min-w-0 flex-1">
                                        <TestCaseTitle title={test.title} tags={test.tags} />
                                      </span>
                                      <span className="hidden font-mono text-xs text-ink-3 sm:inline">:{test.line}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {results.summary && (
        <>
          <FeatureBreakdown features={results.features} />
          {/* Keyed by the filter so links with ?status= re-apply it. */}
          <TestTable
            key={statusParam ?? 'all'}
            tests={results.tests}
            initialStatus={isStatus(statusParam) ? statusParam : 'all'}
          />
        </>
      )}
    </div>
  );
}
