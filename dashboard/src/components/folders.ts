import type { Catalog, RunRecord, RunSummary, StatusCounts, TestRow } from '@/lib/types';
import type { SelectOption } from './dropdowns';
import { FolderIcon } from './icons';
import { featureIcon } from './specs';

/** Value of the "every folder" option in folder dropdowns. */
export const ALL_FOLDERS = 'all';

function sum(counts: StatusCounts): number {
  return counts.passed + counts.failed + counts.flaky + counts.skipped;
}

/** Folder dropdown options from the test catalog (falls back to the latest results), with test counts. */
export function folderOptions(catalog: Catalog | null, tests: readonly TestRow[] = []): SelectOption<string>[] {
  const counts = new Map<string, number>();
  if (catalog) {
    for (const file of catalog.files) counts.set(file.feature, (counts.get(file.feature) ?? 0) + file.tests.length);
  } else {
    for (const test of tests) counts.set(test.feature, (counts.get(test.feature) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [
    { value: ALL_FOLDERS, label: 'All folders', count: total, icon: FolderIcon },
    ...[...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([feature, count]) => ({ value: feature, label: feature, count, icon: featureIcon(feature) })),
  ];
}

/** A run's counts limited to one folder, or null when the run had no tests from that folder. */
export function scopeRun(run: RunRecord, folder: string): RunRecord | null {
  if (folder === ALL_FOLDERS) return run;
  const counts = run.features?.[folder];
  if (!counts) return null;
  return { ...run, counts, total: sum(counts) };
}

/** The latest run's summary limited to one folder, or null when it had no tests from that folder. */
export function scopeSummary(summary: RunSummary | null, tests: readonly TestRow[], folder: string): RunSummary | null {
  if (!summary || folder === ALL_FOLDERS) return summary;
  const scoped = tests.filter((test) => test.feature === folder);
  if (scoped.length === 0) return null;
  const counts: StatusCounts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  scoped.forEach((test) => (counts[test.status] += 1));
  const executed = scoped.length - counts.skipped;
  return {
    ...summary,
    counts,
    total: scoped.length,
    passRate: executed === 0 ? 0 : (counts.passed + counts.flaky) / executed,
  };
}
