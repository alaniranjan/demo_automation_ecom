import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { LIVE_FRAMES_DIR } from '../utils/live-preview';

type Outcome = 'passed' | 'failed' | 'flaky' | 'skipped';

interface RunningTest {
  id: string;
  title: string;
  describe: string;
  file: string;
  project: string;
  retry: number;
  startedAt: string;
  step: string | null;
  url: string | null;
  /** Worker slot; the live-preview fixture writes this test's frames to live-frames/<parallelIndex>.jpg. */
  parallelIndex: number;
}

interface LiveEvent {
  status: Outcome;
  title: string;
  file: string;
  time: string;
  duration: number;
}

interface LiveState {
  status: 'running' | 'done';
  result: FullResult['status'] | null;
  startedAt: string;
  updatedAt: string;
  argv: string[];
  total: number;
  counts: Record<Outcome, number>;
  running: RunningTest[];
  events: LiveEvent[];
  meta: {
    playwrightVersion: string;
    workers: number;
    projects: { name: string; baseURL: string | null; browserName: string | null; retries: number }[];
  };
}

const OUTCOMES: Record<ReturnType<TestCase['outcome']>, Outcome> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'flaky',
  skipped: 'skipped',
};

const TRACKED_STEP_CATEGORIES = new Set(['test.step', 'pw:api']);
const MAX_EVENTS = 200;
const FLUSH_INTERVAL_MS = 250;

/**
 * A readable label for a step. API steps use the action plus its target ("Click getByRole(...)"),
 * never the full title, because titles like `Fill "<value>"` contain typed values such as passwords.
 */
function describeStep(step: TestStep): string {
  const [phase] = step.titlePath();
  // Teardown closes the browser and saves the screenshot and video, which can take a few seconds.
  if (phase === 'After Hooks') return 'Finishing: saving screenshot and video';
  if (phase === 'Before Hooks' && step.category === 'pw:api' && /^(Launch|Create)\b/.test(step.title)) return 'Opening browser';
  if (step.category !== 'pw:api') return step.title;
  const action = step.title.split(' ')[0] ?? step.title;
  return step.subtitle ? `${action} ${step.subtitle}` : action;
}

/**
 * Writes the state of the current run to a JSON file while tests execute: which tests are running,
 * their current step and last navigated URL, and outcome counts. The QA dashboard polls this file,
 * so runs started from a terminal show up live as well.
 */
export default class LiveReporter implements Reporter {
  private readonly outputFile: string;
  private state: LiveState | null = null;
  private rootDir = '';
  private readonly baseURLs = new Map<string, string | null>();
  private timer: NodeJS.Timeout | null = null;

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = path.resolve(options.outputFile ?? 'test-results/live.json');
  }

  printsToStdio(): boolean {
    return false;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.rootDir = config.rootDir;
    // Frames from a previous run must not show up as this run's preview.
    fs.rmSync(LIVE_FRAMES_DIR, { recursive: true, force: true });
    const projects = config.projects.map((project) => {
      const baseURL = project.use.baseURL ?? null;
      this.baseURLs.set(project.name, baseURL);
      return {
        name: project.name,
        baseURL,
        browserName: project.use.browserName ?? project.use.defaultBrowserType ?? null,
        retries: project.retries,
      };
    });

    const now = new Date().toISOString();
    this.state = {
      status: 'running',
      result: null,
      startedAt: now,
      updatedAt: now,
      argv: process.argv.slice(2),
      total: suite.allTests().length,
      counts: { passed: 0, failed: 0, flaky: 0, skipped: 0 },
      running: [],
      events: [],
      meta: { playwrightVersion: config.version, workers: config.workers, projects },
    };
    this.flush();
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    if (!this.state) return;
    const project = test.parent.project()?.name ?? '';
    this.state.running.push({
      id: `${test.id}-${result.retry}`,
      title: test.title,
      describe: test.titlePath().slice(3, -1).join(' › '),
      file: path.relative(this.rootDir, test.location.file),
      project,
      retry: result.retry,
      startedAt: result.startTime.toISOString(),
      step: null,
      url: null,
      parallelIndex: result.parallelIndex,
    });
    this.schedule();
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep): void {
    if (!this.state || !TRACKED_STEP_CATEGORIES.has(step.category)) return;
    const entry = this.state.running.find((running) => running.id === `${test.id}-${result.retry}`);
    if (!entry) return;

    entry.step = describeStep(step);
    const url: unknown = step.params?.url;
    if (step.category === 'pw:api' && typeof url === 'string') {
      const baseURL = this.baseURLs.get(entry.project) ?? undefined;
      try {
        entry.url = new URL(url, baseURL).href;
      } catch {
        entry.url = url;
      }
    }
    this.schedule();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.state) return;
    this.state.running = this.state.running.filter((running) => running.id !== `${test.id}-${result.retry}`);

    // A failed attempt that will be retried is not a final outcome yet.
    const willRetry = result.status !== 'passed' && result.status !== 'skipped' && result.retry < test.retries;
    if (!willRetry) {
      const outcome = OUTCOMES[test.outcome()];
      this.state.counts[outcome] += 1;
      this.state.events.unshift({
        status: outcome,
        title: test.title,
        file: path.relative(this.rootDir, test.location.file),
        time: new Date().toISOString(),
        duration: result.duration,
      });
      this.state.events.length = Math.min(this.state.events.length, MAX_EVENTS);
    }
    this.schedule();
  }

  onEnd(result: FullResult): void {
    if (!this.state) return;
    this.state.status = 'done';
    this.state.result = result.status;
    this.state.running = [];
    this.flush();
    fs.rmSync(LIVE_FRAMES_DIR, { recursive: true, force: true });
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.state) return;
    this.state.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
    const tempFile = `${this.outputFile}.${process.pid}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(this.state));
    fs.renameSync(tempFile, this.outputFile);
  }
}
