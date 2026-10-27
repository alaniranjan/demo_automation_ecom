import path from 'node:path';

/**
 * The Playwright framework lives one level above the dashboard unless FRAMEWORK_DIR says otherwise.
 * Files there are read at request time, so the bundler must not try to trace them.
 */
export const FRAMEWORK_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.FRAMEWORK_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), '..'),
);

export const FRAMEWORK_PACKAGE = path.join(FRAMEWORK_DIR, 'package.json');
export const RESULTS_FILE = path.join(FRAMEWORK_DIR, 'test-results', 'results.json');
export const LIVE_FILE = path.join(FRAMEWORK_DIR, 'test-results', 'live.json');
/** Latest browser snapshot per worker slot, written by the framework's live-preview fixture. */
export const LIVE_FRAMES_DIR = path.join(FRAMEWORK_DIR, 'test-results', 'live-frames');
export const ARTIFACTS_DIR = path.join(FRAMEWORK_DIR, 'test-results');
export const CATALOG_REPORTER = path.join(FRAMEWORK_DIR, 'reporters', 'catalog-reporter.ts');

/** Approved UI baselines (screenshots and ARIA snapshots) used by the framework's visual project. */
export const VISUAL_BASELINE_DIR = path.join(FRAMEWORK_DIR, 'visual-baselines');

/** Backend data store (git-ignored). */
export const DATA_DIR = path.join(FRAMEWORK_DIR, '.dashboard');
export const STORE_FILE = path.join(DATA_DIR, 'store.json');
/** Screenshots, videos and traces copied out of test-results/ per run, since Playwright clears it every run. */
export const ARCHIVE_DIR = path.join(DATA_DIR, 'artifacts');
/** Earlier dashboard versions kept run history here; it is migrated into the store once. */
export const LEGACY_HISTORY_FILE = path.join(DATA_DIR, 'history.json');

export const REPORT_DIRS = {
  allure: path.join(FRAMEWORK_DIR, 'allure-report'),
  playwright: path.join(FRAMEWORK_DIR, 'playwright-report'),
} as const;

export type ReportName = keyof typeof REPORT_DIRS;

export function isReportName(value: string): value is ReportName {
  return Object.hasOwn(REPORT_DIRS, value);
}

/** Resolves `relative` under `root`, or returns null if it would escape it (path traversal guard). */
export function resolveInside(root: string, relative: string): string | null {
  const target = path.resolve(root, relative);
  return target.startsWith(root + path.sep) ? target : null;
}
