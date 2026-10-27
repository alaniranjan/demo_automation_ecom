'use client';

import { Fragment, useMemo, useState } from 'react';
import { formatDuration } from '@/lib/format';
import { TEST_STATUSES, type TestRow, type TestStatus } from '@/lib/types';
import { Card } from './Card';
import { Select } from './dropdowns';
import { ALL_FOLDERS, folderOptions } from './folders';
import { ChevronIcon, ClockIcon, SearchIcon, SortIcon, TagIcon, XCircleIcon } from './icons';
import { FeatureName, TestCaseTitle, specTitle } from './specs';
import { STATUS_META, StatusBadge } from './status';
import { TestDetails } from './TestDetails';

type SortKey = 'status' | 'slowest' | 'name';

const STATUS_RANK: Record<TestStatus, number> = { failed: 0, flaky: 1, passed: 2, skipped: 3 };

const SORT_OPTIONS = [
  { value: 'status', label: 'Failures first', icon: XCircleIcon },
  { value: 'slowest', label: 'Slowest first', icon: ClockIcon },
  { value: 'name', label: 'Name A–Z', icon: SortIcon },
] as const;

export function TestTable({ tests, initialStatus = 'all' }: { tests: TestRow[]; initialStatus?: TestStatus | 'all' }) {
  const [status, setStatus] = useState<TestStatus | 'all'>(initialStatus);
  const [query, setQuery] = useState('');
  const [feature, setFeature] = useState<string>(ALL_FOLDERS);
  const [tag, setTag] = useState('all');
  const [sort, setSort] = useState<SortKey>('status');
  const [expanded, setExpanded] = useState<string | null>(null);

  const folders = useMemo(() => folderOptions(null, tests), [tests]);
  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    tests.forEach((test) => test.tags.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1)));
    return [
      { value: 'all', label: 'All tags', count: tests.length, icon: TagIcon },
      ...[...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ value: name, label: name, count, icon: TagIcon })),
    ];
  }, [tests]);
  const statusCounts = useMemo(() => {
    const counts: Record<TestStatus, number> = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
    tests.forEach((test) => (counts[test.status] += 1));
    return counts;
  }, [tests]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = tests.filter(
      (test) =>
        (status === 'all' || test.status === status) &&
        (feature === ALL_FOLDERS || test.feature === feature) &&
        (tag === 'all' || test.tags.includes(tag)) &&
        (!needle || `${test.title} ${test.describe} ${test.file}`.toLowerCase().includes(needle)),
    );
    const sorters: Record<SortKey, (a: TestRow, b: TestRow) => number> = {
      status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
      slowest: (a, b) => b.duration - a.duration,
      name: (a, b) => a.title.localeCompare(b.title),
    };
    return [...filtered].sort(sorters[sort]);
  }, [tests, status, feature, tag, query, sort]);

  return (
    <Card title="Tests" subtitle={`${visible.length} of ${tests.length} tests in the latest run`} flush>
      <div className="flex flex-col gap-3 px-5 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="radiogroup" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {(['all', ...TEST_STATUSES] as const).map((option) => {
            const selected = status === option;
            const count = option === 'all' ? tests.length : statusCounts[option];
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStatus(option)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${
                  selected ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2 hover:bg-surface-2'
                }`}
              >
                {option !== 'all' && (
                  <span className="size-2 rounded-full" style={{ background: STATUS_META[option].color }} aria-hidden="true" />
                )}
                {option === 'all' ? 'All' : STATUS_META[option].label}
                <span className="tabular-nums text-ink-3">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:flex-none">
            <span className="sr-only">Search tests</span>
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tests"
              className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-accent sm:w-56"
            />
          </label>
          <Select label="Folder" value={feature} onChange={setFeature} options={folders} className="w-44" />
          <Select label="Tag" value={tag} onChange={setTag} options={tagOptions} className="w-40" />
          <Select
            label="Sort"
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            hideLabel
            icon={SortIcon}
            className="w-40"
            align="end"
          />
        </div>
      </div>

      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2/60 text-xs text-ink-3">
            <tr>
              <th scope="col" className="w-28 py-2.5 pl-5 pr-3 font-medium">
                Status
              </th>
              <th scope="col" className="py-2.5 pr-3 font-medium">
                Test
              </th>
              <th scope="col" className="hidden py-2.5 pr-3 font-medium md:table-cell">
                Feature
              </th>
              <th scope="col" className="hidden py-2.5 pr-3 font-medium lg:table-cell">
                Tags
              </th>
              <th scope="col" className="py-2.5 pr-5 text-right font-medium">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((test) => {
              const isOpen = expanded === test.id;
              return (
                <Fragment key={test.id}>
                  <tr
                    className={`cursor-pointer border-t border-line transition-colors hover:bg-surface-2/70 ${isOpen ? 'bg-surface-2/70' : ''}`}
                    onClick={() => setExpanded(isOpen ? null : test.id)}
                  >
                    <td className="py-3 pl-5 pr-3 align-top">
                      <StatusBadge status={test.status} />
                    </td>
                    <td className="py-3 pr-3 align-top">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        className="flex items-start gap-1.5 text-left"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpanded(isOpen ? null : test.id);
                        }}
                      >
                        <ChevronIcon className={`mt-0.5 shrink-0 text-ink-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        <span className="min-w-0">
                          <span className="flex font-medium">
                            <TestCaseTitle title={test.title} tags={test.tags} file={test.file} />
                          </span>
                          <span className="block text-xs text-ink-3">
                            {specTitle(test.file)}
                            {test.describe ? ` › ${test.describe}` : ''}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="hidden py-3 pr-3 align-top text-ink-2 md:table-cell">
                      <FeatureName feature={test.feature} />
                    </td>
                    <td className="hidden py-3 pr-3 align-top lg:table-cell">
                      <span className="flex flex-wrap gap-1">
                        {test.tags.map((name) => (
                          <span key={name} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                            {name}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-3 pr-5 text-right align-top tabular-nums text-ink-2">{formatDuration(test.duration)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-line bg-surface-2/40">
                      <td colSpan={5}>
                        <TestDetails test={test} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr className="border-t border-line">
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink-3">
                  No tests match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
