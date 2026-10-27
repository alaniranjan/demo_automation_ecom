import { labelFromScript } from '../naming';
import type { LiveState, RunRecord } from '../types';
import { generateRunReport } from './allure';
import { ARTIFACT_RUNS_KEPT, archiveRunArtifacts, pruneArtifacts } from './archive';
import { parseSuiteScript, scriptArgs } from './catalog';
import { readFrameworkPackage } from './framework';
import type { ParsedReport } from './report';
import { findLaunch, isBusy } from './runner';
import { addActivity, nextRunId, readStore, updateStore } from './store';

const MAX_TEST_EVENTS_PER_RUN = 10;
/** How far apart a terminal run's "started" event and its report start time may be. */
const START_MATCH_WINDOW_MS = 15_000;

function sameArgs(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Works out which package.json script produced a run that was not launched from the dashboard.
 * Only needs the scripts, so it works even before the test catalog has been listed.
 */
async function classifyTerminalRun(args: string[]): Promise<{ suite: string; label: string }> {
  const { scripts } = await readFrameworkPackage();
  const match = Object.entries(scripts).find(
    ([script, command]) =>
      (script === 'test' || script.startsWith('test:')) &&
      parseSuiteScript(command) &&
      sameArgs(scriptArgs(command), args),
  );
  if (match) return { suite: match[0], label: labelFromScript(match[0]) };
  if (args.some((arg) => !arg.startsWith('-'))) return { suite: 'selected', label: 'Selected files' };
  return { suite: 'custom', label: 'Custom' };
}

/** Set by the GitHub Actions publish step: what started the run, and the ID the dashboard reserved for it. */
export interface IngestOptions {
  runId?: string | undefined;
  suite?: string | undefined;
  label?: string | undefined;
  trigger?: RunRecord['trigger'] | undefined;
  /** Wait for the Allure report instead of building it in the background (a CI step must not exit early). */
  awaitReport?: boolean;
}

/** Records the latest report as a run (once per start time), with per-test outcomes and activity. Returns its ID. */
export async function ingestReport(report: ParsedReport | null, options: IngestOptions = {}): Promise<string | null> {
  // `playwright test --list` writes a report too, with every test "skipped"; a listing is not a run.
  if (!report || report.args.includes('--list')) return null;
  const { summary } = report;
  const isKnown = (data: { runs: RunRecord[]; deletedStartTimes: string[] }) =>
    data.runs.some((run) => run.startTime === summary.startTime) || data.deletedStartTimes.includes(summary.startTime);
  if (isKnown(await readStore())) return null;

  const launch = findLaunch(summary.startTime);
  const classified = launch ? { suite: launch.suite, label: launch.label } : await classifyTerminalRun(report.args);
  const suite = options.suite || classified.suite;
  const label = options.label || classified.label;
  const trigger: RunRecord['trigger'] = options.trigger ?? (launch ? 'dashboard' : 'terminal');
  let createdId: string | null = null;
  await updateStore((data) => {
    if (isKnown(data)) return;

    const startMs = new Date(summary.startTime).getTime();
    const reserved =
      options.runId ||
      launch?.runId ||
      data.activity.find(
        (event) =>
          event.type === 'run.started' &&
          event.runId &&
          Math.abs(new Date(event.time).getTime() - startMs) < START_MATCH_WINDOW_MS &&
          !data.runs.some((run) => run.id === event.runId),
      )?.runId;
    const id =
      reserved && !data.runs.some((run) => run.id === reserved) ? reserved : nextRunId(data, summary.startTime);

    const record: RunRecord = {
      id,
      startTime: summary.startTime,
      duration: summary.duration,
      suite,
      suiteLabel: label,
      trigger,
      args: report.args,
      counts: summary.counts,
      total: summary.total,
      projects: summary.projects,
      targets: summary.targets,
      tests: report.tests.map((test) => ({
        title: test.title,
        project: test.project,
        describe: test.describe,
        feature: test.feature,
        file: test.file,
        status: test.status,
        duration: test.duration,
        ...(test.error ? { error: test.error.message.split('\n')[0] ?? '' } : {}),
      })),
    };
    data.runs.push(record);
    createdId = id;

    const failed = summary.counts.failed > 0;
    const finishedAt = new Date(startMs + summary.duration).toISOString();
    addActivity(data, {
      type: failed ? 'run.failed' : 'run.passed',
      time: finishedAt,
      title: `Run ${id} ${failed ? 'failed' : 'passed'}`,
      detail: `${summary.counts.passed + summary.counts.flaky}/${summary.total} passed · ${label}`,
      runId: id,
    });
    report.tests
      .filter((test) => test.status === 'failed' || test.status === 'flaky')
      .slice(0, MAX_TEST_EVENTS_PER_RUN)
      .forEach((test) =>
        addActivity(data, {
          type: test.status === 'failed' ? 'test.failed' : 'test.flaky',
          time: finishedAt,
          title: test.title,
          detail: test.feature,
          runId: id,
        }),
      );
  });

  if (!createdId) return null;
  const runId: string = createdId;
  await archiveArtifacts(runId, report);
  // Every run, passed or failed, gets its own Allure report; locally it is built in the background (it takes seconds).
  const reportDone = generateRunReport(runId).then(async (url) => {
    if (!url) return;
    await updateStore((data) => {
      const run = data.runs.find((entry) => entry.id === runId);
      if (!run) return;
      run.report = true;
      if (url.startsWith('http')) run.reportUrl = url;
    });
  });
  if (options.awaitReport) await reportDone;
  else void reportDone;
  return runId;
}

/** Keeps the run's screenshots, videos and traces beyond the next run, then prunes media of older runs. */
async function archiveArtifacts(runId: string, report: ParsedReport): Promise<void> {
  const archived = await archiveRunArtifacts(runId, report.tests);
  const data = await updateStore((store) => {
    const run = store.runs.find((entry) => entry.id === runId);
    run?.tests?.forEach((test, index) => {
      if (archived[index]?.length) test.attachments = archived[index];
    });
    // Older runs lose their media and Allure report below.
    store.runs.slice(0, -ARTIFACT_RUNS_KEPT).forEach((entry) => {
      delete entry.report;
      delete entry.reportUrl;
    });
  });
  await pruneArtifacts(new Set(data.runs.slice(-ARTIFACT_RUNS_KEPT).map((run) => run.id)));
}

/**
 * Gives a run started from a terminal (seen only through the live file) a run ID and a "started"
 * activity entry, so it appears in the dashboard while it is still executing.
 */
export async function trackTerminalRun(live: LiveState | null): Promise<string | null> {
  if (!live?.active || isBusy()) return null;
  const isStart = (event: { type: string; time: string }) =>
    event.type === 'run.started' && event.time === live.startedAt;

  const existing = (await readStore()).activity.find(isStart);
  if (existing) return existing.runId ?? null;

  let runId: string | null = null;
  await updateStore((data) => {
    const raced = data.activity.find(isStart);
    if (raced) {
      runId = raced.runId ?? null;
      return;
    }
    const id = nextRunId(data, live.startedAt);
    runId = id;
    addActivity(data, {
      type: 'run.started',
      time: live.startedAt,
      title: `Run ${id} started`,
      detail: `Terminal · playwright ${live.argv.join(' ')}`,
      runId: id,
    });
  });
  return runId;
}
