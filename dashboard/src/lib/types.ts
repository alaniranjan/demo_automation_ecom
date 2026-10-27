/** Shapes shared by the API routes and the client UI. Nothing here is hard-coded data. */

export type TestStatus = 'passed' | 'failed' | 'flaky' | 'skipped';

export const TEST_STATUSES: readonly TestStatus[] = ['passed', 'failed', 'flaky', 'skipped'];

export type StatusCounts = Record<TestStatus, number>;

export interface StepNode {
  title: string;
  duration: number;
  error?: string;
  steps: StepNode[];
}

export interface Attachment {
  name: string;
  contentType: string;
  /** Path relative to the framework directory, served by /api/artifacts. */
  path: string;
}

/** One test from the latest run, parsed from Playwright's JSON report. */
export interface TestRow {
  id: string;
  title: string;
  describe: string;
  file: string;
  line: number;
  feature: string;
  project: string;
  tags: string[];
  status: TestStatus;
  duration: number;
  retries: number;
  error?: { message: string; stack?: string };
  steps: StepNode[];
  attachments: Attachment[];
}

export interface FeatureSummary {
  feature: string;
  counts: StatusCounts;
  total: number;
}

/** One browser or device a run used, with the versions recorded by the framework's browserInfo fixture. */
export interface RunTarget {
  /** Playwright project, e.g. "chrome" or "iphone-17-pro". */
  project: string;
  /** Browser version, e.g. "155.0.8059.85" (for devices, the engine inside the emulated device). */
  version?: string;
  /** Emulated OS on devices, e.g. "iOS 18.7" or "Android 16". */
  os?: string;
}

export interface RunSummary {
  startTime: string;
  duration: number;
  counts: StatusCounts;
  total: number;
  passRate: number;
  projects: string[];
  targets: RunTarget[];
}

// ---- Framework catalog (from package.json scripts + `playwright test --list`) ----

export interface SuiteDefinition {
  /** npm script name, e.g. "test" or "test:smoke". Also the key used to start a run. */
  script: string;
  label: string;
  /** The script's command, e.g. "playwright test --grep @smoke". */
  command: string;
  grep: string | null;
  count: number;
}

export interface CatalogTest {
  file: string;
  line: number;
  title: string;
  describe: string;
  project: string;
  tags: string[];
}

export interface SpecFile {
  file: string;
  feature: string;
  tests: CatalogTest[];
}

export interface ProjectInfo {
  /** Browser key used in BROWSERS / RunRequest.browsers, e.g. "firefox". */
  name: string;
  baseURL: string | null;
  /** Engine: chromium, firefox or webkit. */
  browserName: string | null;
  /** Branded browser channel (e.g. "chrome"), or null for Playwright's own build. */
  channel: string | null;
  installed: boolean;
  /** Desktop browser, or an emulated mobile/tablet device. */
  kind: 'desktop' | 'device';
  /** Display name, e.g. "Chrome" or "iPhone 17 Pro". */
  label: string;
  /** Device category (iPhone, Android Phone, iPad, Android Tablet); null for desktop. */
  category: string | null;
  os: string | null;
  viewport: { width: number; height: number } | null;
  deviceScaleFactor: number;
  isMobile: boolean;
  retries: number;
  timeout: number;
}

/** A browser window size the framework supports (viewport, video and screenshots). */
export interface RecordingSize {
  key: string;
  width: number;
  height: number;
  label: string;
}

export interface Catalog {
  suites: SuiteDefinition[];
  recordingSizes: RecordingSize[];
  defaultRecordingSize: string;
  files: SpecFile[];
  projects: ProjectInfo[];
  workers: number;
  playwrightVersion: string;
  total: number;
}

export interface FrameworkMeta {
  name: string;
  version: string;
  description: string;
  projectName: string;
  baseURL: string | null;
  frameworkDir: string;
  nodeVersion: string;
  user: string;
  storeFile: string;
  maxRuns: number;
  /** 'local': runs Playwright on this machine. 'cloud': hosted on Vercel, tests run on GitHub Actions. */
  mode: 'local' | 'cloud';
  /** The GitHub Actions workflow page, when hosted. */
  ciUrl: string | null;
  /** False when hosted without GITHUB_TOKEN: the dashboard only shows results published by GitHub Actions. */
  canRun: boolean;
  /** When GitHub Actions last published the test catalog (hosted only). */
  catalogPublishedAt: string | null;
}

// ---- Persisted backend data ----

export interface RunTestRecord {
  title: string;
  /** Browser or device the test ran on (Catalog.projects name); absent on older records. */
  project?: string;
  describe: string;
  feature: string;
  file: string;
  status: TestStatus;
  duration: number;
  error?: string;
  /** Archived screenshots, videos and traces (paths relative to the framework folder). */
  attachments?: Attachment[];
}

/** Who started a run: the dashboard, a terminal, or GitHub Actions on its own (a push to main). */
export type RunTrigger = 'dashboard' | 'terminal' | 'ci';

export interface RunRecord {
  /** e.g. RUN-20261020-003 */
  id: string;
  startTime: string;
  duration: number;
  /** npm script that produced the run, 'selected' for chosen spec files, or 'custom'. */
  suite: string;
  suiteLabel: string;
  trigger: RunTrigger;
  args: string[];
  counts: StatusCounts;
  total: number;
  projects: string[];
  /** Per-test outcomes; omitted from list responses to keep them small. */
  tests?: RunTestRecord[];
  /** Outcome counts per test folder (feature), derived from `tests`; present in list responses. */
  features?: Record<string, StatusCounts>;
  /** Browsers and devices with their versions; missing on runs recorded before versions were captured. */
  targets?: RunTarget[];
  /** True once the run's own Allure report has been generated (served at /api/runs/{id}/report/). */
  report?: boolean;
  /** Where the report opens when it is not in the local archive (the hosted dashboard's Blob URL). */
  reportUrl?: string;
}

export type ActivityType =
  | 'run.started'
  | 'run.passed'
  | 'run.failed'
  | 'run.cancelled'
  | 'run.deleted'
  | 'artifacts.deleted'
  | 'test.failed'
  | 'test.flaky';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  time: string;
  title: string;
  detail?: string;
  runId?: string;
}

export interface ResultsPayload {
  summary: RunSummary | null;
  tests: TestRow[];
  features: FeatureSummary[];
  runs: RunRecord[];
  activity: ActivityEvent[];
  reports: { allure: boolean; playwright: boolean };
  catalog: Catalog | null;
  meta: FrameworkMeta;
}

// ---- Live run state ----

export interface LiveRunningTest {
  id: string;
  title: string;
  describe: string;
  file: string;
  project: string;
  retry: number;
  startedAt: string;
  step: string | null;
  url: string | null;
  /** Worker slot; its live frame is served by /api/live/frame?slot=<parallelIndex>. */
  parallelIndex: number;
}

export interface LiveEvent {
  status: TestStatus;
  title: string;
  file: string;
  time: string;
  duration: number;
}

export interface LiveState {
  status: 'running' | 'done';
  result: string | null;
  startedAt: string;
  updatedAt: string;
  argv: string[];
  total: number;
  counts: StatusCounts;
  running: LiveRunningTest[];
  events: LiveEvent[];
  /** Whether the live file is still being updated (a stale "running" file means the run died). */
  active: boolean;
}

/** A suite (npm script) or spec files, optionally on specific browsers (keys from Catalog.projects). */
export type RunRequest = ({ suite: string } | { files: string[] }) & {
  /** Desktop browser keys (Catalog.projects with kind "desktop"). */
  browsers?: string[];
  /** Emulated device keys (Catalog.projects with kind "device"). */
  devices?: string[];
  /** Stream browser snapshots to the dashboard while tests run (LIVE_PREVIEW=1). */
  preview?: boolean;
  /** Browser window size key from Catalog.recordingSizes (RECORDING_RESOLUTION). */
  size?: string;
  /** UI comparison files only: approve the current UI as the new baseline instead of comparing. */
  updateSnapshots?: boolean;
};

export interface InstallRequest {
  browser: string;
}

export type RunPhase = 'idle' | 'running' | 'reporting' | 'passed' | 'failed' | 'cancelled';

export interface RunState {
  id: number;
  /** Reserved run ID, e.g. RUN-20261020-004. */
  runId: string | null;
  label: string | null;
  suite: string | null;
  phase: RunPhase;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  logLength: number;
  /** Whether this run streams live frames. */
  preview: boolean;
  /** Where the run can be followed outside the dashboard (the GitHub Actions run, when hosted). */
  externalUrl?: string;
}

export interface RunStatePayload extends RunState {
  log: string[];
  offset: number;
  live: LiveState | null;
  /** Run ID for a terminal-started run seen in the live file. */
  liveRunId: string | null;
}
