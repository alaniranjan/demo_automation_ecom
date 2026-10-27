import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { featureFromFile } from '../naming';
import { BLOB_PATHS, CLOUD, cached, readJson } from './cloud';
import { ARTIFACTS_DIR, FRAMEWORK_DIR, RESULTS_FILE, VISUAL_BASELINE_DIR } from './paths';
import {
  TEST_STATUSES,
  type Attachment,
  type FeatureSummary,
  type RunSummary,
  type RunTarget,
  type StatusCounts,
  type StepNode,
  type TestRow,
  type TestStatus,
} from '../types';

// Minimal typing of Playwright's JSON reporter output (only the fields we read).
interface PwError {
  message?: string;
  stack?: string;
}
interface PwStep {
  title: string;
  duration: number;
  error?: PwError;
  steps?: PwStep[];
}
interface PwResult {
  status: string;
  duration: number;
  retry: number;
  error?: PwError;
  errors?: PwError[];
  steps?: PwStep[];
  attachments?: { name: string; contentType: string; path?: string }[];
}
interface PwTest {
  projectName: string;
  annotations?: { type: string; description?: string }[];
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  results: PwResult[];
}
interface PwSpec {
  id: string;
  title: string;
  tags: string[];
  file: string;
  line: number;
  tests: PwTest[];
}
interface PwSuite {
  title: string;
  file: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  config?: { argv?: string[] };
  suites: PwSuite[];
  stats: { startTime: string; duration: number; expected: number; unexpected: number; flaky: number; skipped: number };
}

const STATUS_MAP: Record<PwTest['status'], TestStatus> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'flaky',
  skipped: 'skipped',
};

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

export function emptyCounts(): StatusCounts {
  return { passed: 0, failed: 0, flaky: 0, skipped: 0 };
}

function toSteps(steps: PwStep[] = []): StepNode[] {
  return steps.map((step) => ({
    title: step.title,
    duration: step.duration,
    ...(step.error?.message ? { error: stripAnsi(step.error.message) } : {}),
    steps: toSteps(step.steps),
  }));
}

function toAttachments(results: PwResult[]): Attachment[] {
  const attachments: Attachment[] = [];
  for (const result of results) {
    for (const attachment of result.attachments ?? []) {
      if (!attachment.path) continue;
      const absolute = path.resolve(attachment.path);
      // Only files under test-results/ are served by the artifacts route; deleted files are skipped. A screenshot
      // mismatch's "expected" image is the approved baseline itself; it is kept so the run archive copies it and
      // the run keeps showing the old UI it was compared with, even after a newer baseline is approved.
      const inResults = absolute.startsWith(ARTIFACTS_DIR + path.sep);
      const isBaseline = absolute.startsWith(VISUAL_BASELINE_DIR + path.sep) && attachment.name.endsWith('-expected.png');
      if ((!inResults && !isBaseline) || !existsSync(absolute)) continue;
      attachments.push({
        name: results.length > 1 ? `${attachment.name} (attempt ${result.retry + 1})` : attachment.name,
        contentType: attachment.contentType,
        path: path.relative(FRAMEWORK_DIR, absolute),
      });
    }
  }
  return attachments;
}

function firstError(results: PwResult[]): TestRow['error'] {
  const failing = results.find((result) => result.error ?? result.errors?.length);
  const error = failing?.error ?? failing?.errors?.[0];
  if (!error?.message) return undefined;
  return {
    message: stripAnsi(error.message),
    ...(error.stack ? { stack: stripAnsi(error.stack) } : {}),
  };
}

/** Annotation types written by the framework's browserInfo fixture (utils/browser-info.ts). */
const BROWSER_VERSION_ANNOTATION = 'browser-version';
const OS_VERSION_ANNOTATION = 'os-version';

function recordTarget(test: PwTest, targets: Map<string, RunTarget>): void {
  const target = targets.get(test.projectName) ?? { project: test.projectName };
  for (const annotation of test.annotations ?? []) {
    if (!annotation.description) continue;
    if (annotation.type === BROWSER_VERSION_ANNOTATION) target.version = annotation.description;
    if (annotation.type === OS_VERSION_ANNOTATION) target.os = annotation.description;
  }
  targets.set(test.projectName, target);
}

function collectTests(suite: PwSuite, describePath: string[], rows: TestRow[], targets: Map<string, RunTarget>): void {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      recordTarget(test, targets);
      const last = test.results.at(-1);
      const error = firstError(test.results);
      rows.push({
        id: `${spec.id}-${test.projectName}`,
        title: spec.title,
        describe: describePath.join(' › '),
        file: spec.file,
        line: spec.line,
        feature: featureFromFile(spec.file),
        project: test.projectName,
        tags: spec.tags.map((tag) => (tag.startsWith('@') ? tag : `@${tag}`)),
        status: STATUS_MAP[test.status],
        duration: last?.duration ?? 0,
        retries: Math.max(0, test.results.length - 1),
        ...(error ? { error } : {}),
        steps: toSteps(last?.steps),
        attachments: toAttachments(test.results),
      });
    }
  }
  for (const child of suite.suites ?? []) {
    collectTests(child, [...describePath, child.title], rows, targets);
  }
}

export interface ParsedReport {
  /** CLI arguments after `playwright test`, used to tell which script started the run. */
  args: string[];
  summary: RunSummary;
  tests: TestRow[];
  features: FeatureSummary[];
}

// The hosted dashboard shows the latest run GitHub Actions published (media already moved to Blob).
const publishedLatest = cached(10_000, async () => (await readJson<ParsedReport>(BLOB_PATHS.latest))?.data ?? null);

/** The latest run's results: test-results/results.json locally, or the copy published to Blob in cloud mode. */
export function loadLatestReport(): Promise<ParsedReport | null> {
  return CLOUD ? publishedLatest.get() : loadLocalReport();
}

/** Reads test-results/results.json; returns null when no run has produced it yet. */
export async function loadLocalReport(): Promise<ParsedReport | null> {
  let raw: string;
  try {
    raw = await fs.readFile(RESULTS_FILE, 'utf8');
  } catch {
    return null;
  }

  let report: PwReport;
  try {
    report = JSON.parse(raw) as PwReport;
  } catch {
    // The file can be mid-write while a run is finishing; treat it as not ready.
    return null;
  }

  const tests: TestRow[] = [];
  const targets = new Map<string, RunTarget>();
  for (const fileSuite of report.suites ?? []) {
    collectTests(fileSuite, [], tests, targets);
  }

  const counts = emptyCounts();
  const featureMap = new Map<string, StatusCounts>();
  for (const test of tests) {
    counts[test.status] += 1;
    const featureCounts = featureMap.get(test.feature) ?? emptyCounts();
    featureCounts[test.status] += 1;
    featureMap.set(test.feature, featureCounts);
  }

  const total = tests.length;
  const executed = total - counts.skipped;
  const features = [...featureMap].map(([feature, featureCounts]) => ({
    feature,
    counts: featureCounts,
    total: TEST_STATUSES.reduce((sum, status) => sum + featureCounts[status], 0),
  }));

  const argv = report.config?.argv ?? [];
  const testIndex = argv.indexOf('test');
  return {
    args: testIndex >= 0 ? argv.slice(testIndex + 1) : [],
    summary: {
      startTime: report.stats.startTime,
      duration: report.stats.duration,
      counts,
      total,
      // Flaky tests passed on retry, so they count toward the pass rate.
      passRate: executed === 0 ? 0 : (counts.passed + counts.flaky) / executed,
      projects: [...new Set(tests.map((test) => test.project))],
      targets: [...targets.values()],
    },
    tests,
    features,
  };
}
