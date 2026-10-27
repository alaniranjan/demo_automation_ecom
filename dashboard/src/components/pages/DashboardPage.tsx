'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LatestActivityCard } from '../ActivityFeed';
import { Card } from '../Card';
import { CurrentRunPanel } from '../dashboard/CurrentRunPanel';
import { KpiCards } from '../dashboard/KpiCards';
import { PassRateDonut } from '../dashboard/PassRateDonut';
import { FeatureCards, QuickActions } from '../dashboard/QuickActions';
import { Select } from '../dropdowns';
import { ALL_FOLDERS, folderOptions, scopeRun, scopeSummary } from '../folders';
import { TrendChart } from '../dashboard/TrendChart';
import { ArrowRightIcon, PlayIcon } from '../icons';
import { PageHeader, buttonStyles } from '../PageHeader';
import { useDashboard } from '../providers/DashboardProvider';
import { RunsTable } from '../RunsTable';
import { PageSkeleton } from './PageSkeleton';

export function DashboardPage() {
  const { results, startRun, setRunDialogOpen, activeRun } = useDashboard();
  const [error, setError] = useState<string | null>(null);
  const [folder, setFolder] = useState<string>(ALL_FOLDERS);
  if (!results) return <PageSkeleton />;

  const allSuite = results.catalog?.suites.find((suite) => suite.grep === null);
  // Every widget below follows the folder dropdown: runs keep only that folder's counts.
  const runs = results.runs.flatMap((run) => scopeRun(run, folder) ?? []);
  const summary = scopeSummary(results.summary, results.tests, folder);
  const recent = [...runs].reverse().slice(0, 6);
  const scope = folder === ALL_FOLDERS ? null : `${folder} in latest run`;

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your test automation runs and results"
        actions={
          <>
            <Select
              label="Folder"
              value={folder}
              onChange={setFolder}
              options={folderOptions(results.catalog, results.tests)}
              className="w-48"
              align="end"
            />
            <button
              type="button"
              disabled={!allSuite || Boolean(activeRun)}
              onClick={async () => allSuite && setError(await startRun({ suite: allSuite.script }))}
              className={`${buttonStyles.primary} px-5 py-2.5`}
            >
              <PlayIcon width={14} height={14} /> Run All Tests
            </button>
            <button type="button" onClick={() => setRunDialogOpen(true)} className={`${buttonStyles.secondary} px-5 py-2.5`}>
              <PlayIcon width={14} height={14} className="opacity-70" /> Run Selected Tests
            </button>
          </>
        }
      />
      {error && <p className="rounded-lg bg-critical-soft px-4 py-2 text-sm text-critical-text">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <KpiCards runs={runs} summary={summary} scope={scope} />
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-7">
              <TrendChart runs={runs} title={folder === ALL_FOLDERS ? 'Test Results Trend' : `Test Results Trend · ${folder}`} />
            </div>
            <div className="min-w-0 lg:col-span-5">
              <PassRateDonut summary={summary} subtitle={folder === ALL_FOLDERS ? 'Latest run' : `${folder} · latest run`} />
            </div>
          </div>
          <Card
            title="Recent Test Runs"
            flush
            actions={
              <Link
                href="/history"
                className="inline-flex items-center gap-1 text-sm font-medium text-accent-strong hover:underline"
              >
                View All Runs <ArrowRightIcon width={13} height={13} />
              </Link>
            }
          >
            <RunsTable
              runs={recent}
              emptyMessage={
                folder === ALL_FOLDERS
                  ? 'No runs yet. Use Run All Tests to start one.'
                  : `No stored runs include tests from ${folder}.`
              }
            />
          </Card>
          <FeatureCards />
        </div>

        <aside className="min-w-0 space-y-6">
          <QuickActions />
          <CurrentRunPanel />
          <LatestActivityCard />
        </aside>
      </div>
    </div>
  );
}
