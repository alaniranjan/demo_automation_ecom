import { spawn, type ChildProcess } from 'node:child_process';
import type { RunRequest, RunState, RunStatePayload } from '../types';
import { reportsIdle } from './allure';
import fs from 'node:fs';
import path from 'node:path';
import { ACCOUNT_PROJECT, VISUAL_PROJECT, getCatalog, invalidateCatalog } from './catalog';
import { readFrameworkPackage } from './framework';
import { readLive } from './live';
import { FRAMEWORK_DIR } from './paths';
import { addActivity, nextRunId, updateStore } from './store';

const MAX_LOG_LINES = 5000;
const REPORT_SCRIPT = 'allure:generate';
const isWindows = process.platform === 'win32';

export class RunError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface ResolvedRun {
  suite: string;
  label: string;
  script: string;
  extraArgs: string[];
  /** Browser keys passed to the framework as BROWSERS (may be empty for device-only runs). */
  browsers: string[];
  /** Device keys passed to the framework as DEVICES. */
  devices: string[];
  preview: boolean;
  /** RECORDING_RESOLUTION key, or null for the framework default. */
  size: string | null;
  /** Extra environment for the framework, e.g. ACCOUNT_TESTS=true for signed-in specs. */
  env?: Record<string, string>;
}

/** Signed-in session saved by the framework's `npm run auth:login`. */
const AUTH_FILE = path.join(FRAMEWORK_DIR, 'playwright', '.auth', 'user.json');

interface Launch {
  suite: string;
  label: string;
  runId: string;
  startedAt: string;
  /** Set when the test script exits (before the report is generated). */
  testsFinishedAt: string | null;
}

interface Runner {
  state: RunState;
  launches: Launch[];
  log: string[];
  /** Lines dropped from the front of `log` once it exceeds MAX_LOG_LINES. */
  dropped: number;
  child: ChildProcess | null;
}

// Survives Next.js hot reloads in development, so a running suite is never orphaned.
const globalStore = globalThis as typeof globalThis & { __qaRunnerV2?: Runner };
const runner: Runner = (globalStore.__qaRunnerV2 ??= {
  state: {
    id: 0,
    runId: null,
    label: null,
    suite: null,
    phase: 'idle',
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    logLength: 0,
    preview: false,
  },
  launches: [],
  log: [],
  dropped: 0,
  child: null,
});

// Runner objects kept across hot reloads may predate newer state fields.
runner.state.preview ??= false;

function appendLog(line: string): void {
  runner.log.push(line);
  runner.state.logLength += 1;
  if (runner.log.length > MAX_LOG_LINES) {
    runner.log.shift();
    runner.dropped += 1;
  }
}

/**
 * Only npm scripts discovered from the framework's package.json can run, and selected files must be
 * spec files Playwright itself listed. Nothing from the request reaches a shell unchecked.
 */
export async function resolveRequest(request: RunRequest): Promise<ResolvedRun> {
  const catalog = await getCatalog();
  if (!catalog) throw new RunError('Could not read the test catalog from the framework', 503);

  // Desktop browsers and emulated devices; with neither, the framework's first desktop browser.
  const desktopDefault = catalog.projects.find((entry) => entry.kind === 'desktop')?.name ?? 'chrome';
  const browsers = [...new Set(request.browsers ?? [])];
  const devices = [...new Set(request.devices ?? [])];
  if (browsers.length === 0 && devices.length === 0) browsers.push(desktopDefault);
  const check = (names: string[], kind: 'desktop' | 'device') =>
    names.map((name) => {
      const project = catalog.projects.find((entry) => entry.name === name && entry.kind === kind);
      if (!project) throw new RunError(`Unknown ${kind === 'device' ? 'device' : 'browser'} "${name}"`, 400);
      if (!project.installed)
        throw new RunError(
          `${project.label} needs ${project.channel ?? project.browserName}, which is not installed.`,
          400,
        );
      return project.label;
    });
  const labels = [...check(browsers, 'desktop'), ...check(devices, 'device')];
  const browserLabel = labels.length > 3 ? `${labels.length} targets` : labels.join(', ');
  if (request.size && !catalog.recordingSizes.some((size) => size.key === request.size)) {
    throw new RunError(`Unknown browser size "${request.size}"`, 400);
  }
  const size = request.size ?? null;

  if ('suite' in request) {
    const suite = catalog.suites.find((definition) => definition.script === request.suite);
    if (!suite) throw new RunError(`Unknown suite "${request.suite}"`, 400);
    return {
      suite: suite.script,
      label: `${suite.label} · ${browserLabel}`,
      script: suite.script,
      extraArgs: [],
      browsers,
      devices,
      preview: Boolean(request.preview),
      size,
    };
  }

  const known = new Set(catalog.files.map((file) => file.file));
  const files = [...new Set(request.files)];
  if (files.length === 0) throw new RunError('Select at least one spec file', 400);
  const unknown = files.filter((file) => !known.has(file));
  if (unknown.length > 0) throw new RunError(`Unknown spec file(s): ${unknown.join(', ')}`, 400);
  const base = catalog.suites.find((definition) => definition.grep === null);
  if (!base) throw new RunError('The framework has no plain "playwright test" script to run files with', 400);

  // UI comparison specs run in the framework's "visual" project (fixed 1920x1080 Chrome). With updateSnapshots
  // they approve the current UI as the new baseline instead of comparing.
  const visualFiles = new Set(
    catalog.files.filter((file) => file.tests.some((test) => test.project === VISUAL_PROJECT)).map((file) => file.file),
  );
  const selectedVisual = files.filter((file) => visualFiles.has(file));
  if (request.updateSnapshots && selectedVisual.length !== files.length) {
    throw new RunError('Only UI comparison specs can update baselines', 400);
  }
  if (selectedVisual.length > 0) {
    if (selectedVisual.length !== files.length) {
      throw new RunError('Run the UI comparison specs on their own, not together with other specs', 400);
    }
    const approve = Boolean(request.updateSnapshots);
    return {
      suite: 'selected',
      label: `${approve ? 'Approve UI baseline' : 'UI comparison'} · ${files.length === 1 ? files[0]! : `${files.length} specs`}`,
      script: base.script,
      extraArgs: [`--project=${VISUAL_PROJECT}`, ...(approve ? ['--update-snapshots=all'] : []), ...files],
      browsers: [],
      devices: [],
      preview: Boolean(request.preview),
      size,
      env: { VISUAL_TESTS: 'true' },
    };
  }

  // Signed-in specs run in the framework's "account" project (Chrome with the saved session), on their own and
  // never retried: a retry after "Place order" would place a second real order.
  const accountFiles = new Set(
    catalog.files.filter((file) => file.tests.some((test) => test.project === ACCOUNT_PROJECT)).map((file) => file.file),
  );
  const selectedAccount = files.filter((file) => accountFiles.has(file));
  if (selectedAccount.length > 0) {
    if (selectedAccount.length !== files.length) {
      throw new RunError('Run the signed-in Account specs on their own, not together with guest specs', 400);
    }
    if (!fs.existsSync(AUTH_FILE)) {
      throw new RunError('Sign in first: run "npm run auth:login" in the framework folder and type the OTP', 400);
    }
    return {
      suite: 'selected',
      label: `${files.length === 1 ? files[0]! : `${files.length} spec files`} · Chrome (signed in)`,
      script: base.script,
      extraArgs: [`--project=${ACCOUNT_PROJECT}`, '--retries=0', '--workers=1', ...files],
      browsers: [],
      devices: [],
      preview: Boolean(request.preview),
      size,
      env: { ACCOUNT_TESTS: 'true' },
    };
  }

  return {
    suite: 'selected',
    label: `${files.length === 1 ? files[0]! : `${files.length} spec files`} · ${browserLabel}`,
    script: base.script,
    extraArgs: files,
    browsers,
    devices,
    preview: Boolean(request.preview),
    size,
  };
}

function runNpmScript(script: string, extraArgs: string[] = [], env: Record<string, string> = {}): Promise<number> {
  return runCommand('npm', ['run', script, ...(extraArgs.length > 0 ? ['--', ...extraArgs] : [])], env);
}

function runCommand(command: 'npm' | 'npx', args: string[], env: Record<string, string> = {}): Promise<number> {
  const prefix = Object.entries(env)
    .map(([key, value]) => `${key}=${value} `)
    .join('');
  appendLog(`$ ${prefix}${command} ${args.join(' ')}`);
  return new Promise((resolve) => {
    const child = spawn(isWindows ? `${command}.cmd` : command, args, {
      cwd: FRAMEWORK_DIR,
      env: { ...process.env, FORCE_COLOR: '0', ...env },
      // A process group lets cancel() stop Playwright's workers, not only npm.
      detached: !isWindows,
      shell: isWindows,
    });
    runner.child = child;

    for (const stream of [child.stdout, child.stderr]) {
      let buffer = '';
      stream?.setEncoding('utf8');
      stream?.on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        lines.forEach(appendLog);
      });
      stream?.on('end', () => {
        if (buffer) appendLog(buffer);
      });
    }

    child.on('error', (error) => {
      appendLog(`Failed to start: ${error.message}`);
      runner.child = null;
      resolve(1);
    });
    child.on('close', (code) => {
      runner.child = null;
      resolve(code ?? 1);
    });
  });
}

/** True once run `id` was cancelled or replaced while a script was executing. */
function isStale(id: number): boolean {
  return runner.state.id !== id || runner.state.phase === 'cancelled';
}

async function execute(resolved: ResolvedRun, id: number, launch: Launch): Promise<void> {
  const exitCode = await runNpmScript(resolved.script, resolved.extraArgs, {
    ...resolved.env,
    BROWSERS: resolved.browsers.join(','),
    ...(resolved.devices.length > 0 ? { DEVICES: resolved.devices.join(',') } : {}),
    ...(resolved.preview ? { LIVE_PREVIEW: '1' } : {}),
    ...(resolved.size ? { RECORDING_RESOLUTION: resolved.size } : {}),
  });
  launch.testsFinishedAt = new Date().toISOString();
  if (isStale(id)) return;

  const { scripts } = await readFrameworkPackage();
  if (scripts[REPORT_SCRIPT]) {
    runner.state.phase = 'reporting';
    appendLog('');
    await runNpmScript(REPORT_SCRIPT);
    if (isStale(id)) return;
  }

  runner.state.exitCode = exitCode;
  runner.state.phase = exitCode === 0 ? 'passed' : 'failed';
  runner.state.finishedAt = new Date().toISOString();
}

export function isBusy(): boolean {
  return runner.state.phase === 'running' || runner.state.phase === 'reporting';
}

export async function startRun(request: RunRequest): Promise<RunState> {
  if (isBusy()) throw new RunError('A run is already in progress', 409);
  // Runs share test-results/, which Playwright empties when a run starts, so two at once destroy each other's media.
  if ((await readLive())?.active) {
    throw new RunError(
      'A run started from a terminal is in progress. Wait for it to finish before starting another.',
      409,
    );
  }
  const resolved = await resolveRequest(request);
  // The previous run's Allure report is built from allure-results/, which the new run clears.
  await reportsIdle();
  if (isBusy()) throw new RunError('A run is already in progress', 409);

  const startedAt = new Date().toISOString();
  let runId = '';
  await updateStore((data) => {
    runId = nextRunId(data, startedAt);
    addActivity(data, {
      type: 'run.started',
      time: startedAt,
      title: `Run ${runId} started`,
      detail: resolved.label,
      runId,
    });
  });

  runner.log = [];
  runner.dropped = 0;
  runner.state = {
    id: runner.state.id + 1,
    runId,
    label: resolved.label,
    suite: resolved.suite,
    phase: 'running',
    startedAt,
    finishedAt: null,
    exitCode: null,
    logLength: 0,
    preview: resolved.preview,
  };
  const launch: Launch = { suite: resolved.suite, label: resolved.label, runId, startedAt, testsFinishedAt: null };
  runner.launches = [...runner.launches, launch].slice(-50);
  void execute(resolved, runner.state.id, launch);
  return { ...runner.state };
}

/** Browser engines Playwright can download itself; branded channels (Chrome, Edge) are installed by their vendors. */
const INSTALLABLE_ENGINES = new Set(['firefox', 'webkit']);

/** Downloads a Playwright browser (`npx playwright install <engine>`), streaming output to the console. */
export async function startInstall(browser: string): Promise<RunState> {
  if (isBusy()) throw new RunError('A run is already in progress', 409);
  const catalog = await getCatalog();
  const project = catalog?.projects.find((entry) => entry.name === browser);
  if (!project) throw new RunError(`Unknown browser "${browser}"`, 400);
  if (project.channel || !INSTALLABLE_ENGINES.has(project.name)) {
    throw new RunError(`${browser} is a branded browser; install it from the vendor's website.`, 400);
  }

  runner.log = [];
  runner.dropped = 0;
  runner.state = {
    id: runner.state.id + 1,
    runId: null,
    label: `Install ${browser}`,
    suite: 'install',
    phase: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    logLength: 0,
    preview: false,
  };
  const id = runner.state.id;
  void runCommand('npx', ['playwright', 'install', project.name]).then((exitCode) => {
    if (isStale(id)) return;
    invalidateCatalog();
    runner.state.exitCode = exitCode;
    runner.state.phase = exitCode === 0 ? 'passed' : 'failed';
    runner.state.finishedAt = new Date().toISOString();
  });
  return { ...runner.state };
}

/** The dashboard launch that produced a report starting at `startTime`, if any. */
export function findLaunch(startTime: string): Launch | undefined {
  const time = new Date(startTime).getTime();
  return runner.launches.find(
    ({ startedAt, testsFinishedAt }) =>
      new Date(startedAt).getTime() <= time &&
      (testsFinishedAt === null || time <= new Date(testsFinishedAt).getTime()),
  );
}

export function cancelRun(): boolean {
  const child = runner.child;
  if (!isBusy() || !child?.pid) return false;

  runner.state.phase = 'cancelled';
  runner.state.finishedAt = new Date().toISOString();
  appendLog('Run cancelled from the dashboard.');
  const { runId, label, finishedAt } = runner.state;
  void updateStore((data) =>
    addActivity(data, {
      type: 'run.cancelled',
      time: finishedAt,
      title: `Run ${runId ?? ''} cancelled`.trim(),
      ...(label ? { detail: label } : {}),
      ...(runId ? { runId } : {}),
    }),
  );
  try {
    if (isWindows) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    child.kill('SIGTERM');
  }
  return true;
}

/**
 * Returns run state plus log lines from `offset` (a running line count), so clients poll incrementally.
 * An offset taken from a different run (`runId` mismatch) restarts from the beginning of the current log.
 */
export function getRunState(requestedOffset: number, runId: number): Omit<RunStatePayload, 'live' | 'liveRunId'> {
  const offset = runId === runner.state.id ? requestedOffset : 0;
  const start = Math.max(0, offset - runner.dropped);
  return {
    ...runner.state,
    offset: Math.max(offset, runner.dropped),
    log: runner.log.slice(start),
  };
}
