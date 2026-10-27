import type { RunPhase, RunRequest, RunState, RunStatePayload } from '../types';
import { cached } from './cloud';
import { fetchTunnelFrame, fetchTunnelLive, liveTunnelFor } from './live-tunnel';
import { RunError, resolveRequest } from './runner';
import { addActivity, nextRunId, updateStore } from './store';

/**
 * The hosted dashboard's runner: tests run on GitHub Actions (.github/workflows/e2e.yml). Starting a run dispatches
 * the workflow; run state, the step-by-step log and cancelling all go through the GitHub REST API.
 */
/** Falls back to the Git repository Vercel deploys from, so only the token has to be set there. */
const REPOSITORY =
  process.env.GITHUB_REPOSITORY ||
  (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : '');
const TOKEN = process.env.GITHUB_TOKEN ?? '';
const WORKFLOW = process.env.GITHUB_WORKFLOW_FILE ?? 'e2e.yml';
const BRANCH = process.env.GITHUB_BRANCH ?? 'main';
/** Polling clients share one GitHub lookup per server instance for this long (the API allows 5,000 calls an hour). */
const STATE_TTL_MS = 4_000;

/** Workflow run names are "<run ID> · <label>" for dashboard runs (see run-name in e2e.yml). */
const RUN_NAME = /^(RUN-\d{8}-\d{3}) · (.*)$/;

interface WorkflowRun {
  id: number;
  run_number: number;
  display_title: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
}

interface JobStep {
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface Job {
  steps?: JobStep[];
}

export function githubConfigured(): boolean {
  return Boolean(REPOSITORY && TOKEN);
}

export function workflowUrl(): string | null {
  return REPOSITORY ? `https://github.com/${REPOSITORY}/actions/workflows/${WORKFLOW}` : null;
}

async function github<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!githubConfigured()) throw new RunError('This dashboard is view-only: tests run on GitHub Actions on every push to main', 503);
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = ((await response.json().catch(() => ({}))) as { message?: string }).message ?? '';
    throw new RunError(`GitHub API ${response.status}${detail ? `: ${detail}` : ''}`, 502);
  }
  return (response.status === 204 ? null : await response.json()) as T;
}

const latest = cached(STATE_TTL_MS, async () => {
  const body = await github<{ workflow_runs: WorkflowRun[] }>(`/actions/workflows/${WORKFLOW}/runs?per_page=1`);
  const run = body.workflow_runs[0] ?? null;
  const jobs =
    run && run.status !== 'queued'
      ? (await github<{ jobs: Job[] }>(`/actions/runs/${run.id}/jobs?per_page=20`)).jobs
      : [];
  return { run, jobs };
});

function isActive(run: WorkflowRun | null): boolean {
  return Boolean(run && run.status !== 'completed');
}

function phaseOf(run: WorkflowRun): RunPhase {
  if (run.status !== 'completed') return 'running';
  if (run.conclusion === 'success') return 'passed';
  if (run.conclusion === 'cancelled') return 'cancelled';
  return 'failed';
}

function seconds(step: JobStep): string {
  if (!step.started_at || !step.completed_at) return '';
  const value = Math.round((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000);
  return ` (${value}s)`;
}

/**
 * The console for a GitHub run: a line when each step starts and when it ends. Steps run in order, so the list only
 * ever grows at the end, which is what the dashboard's incremental (offset-based) log polling expects.
 */
function logOf(run: WorkflowRun, jobs: Job[]): string[] {
  const lines = [`GitHub Actions run #${run.run_number} (${BRANCH}): ${run.html_url}`, 'Queued on GitHub Actions'];
  for (const step of jobs.flatMap((job) => job.steps ?? [])) {
    if (step.status === 'queued' || step.status === 'pending' || step.status === 'waiting') continue;
    lines.push(`▶ ${step.name}`);
    if (step.status === 'completed') {
      const mark = step.conclusion === 'success' ? '✓' : step.conclusion === 'skipped' ? '–' : '✗';
      lines.push(`${mark} ${step.name}${seconds(step)}`);
    }
  }
  if (run.status === 'completed') lines.push(`Run ${run.conclusion ?? 'finished'}`);
  return lines;
}

const IDLE: Omit<RunState, 'id'> = {
  runId: null,
  label: null,
  suite: null,
  phase: 'idle',
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  logLength: 0,
  preview: false,
};

/** Same shape as the local runner's state, for the latest workflow run (`clientRunId` is the id the client has). */
export async function getCloudRunState(offset: number, clientRunId: number): Promise<RunStatePayload> {
  if (!githubConfigured()) {
    const log = ['View-only: tests run on GitHub Actions on every push to main, and their results appear here.'];
    // Offsets work as for real runs, so the client shows the line once.
    const start = clientRunId === 0 ? Math.min(offset, log.length) : 0;
    return {
      id: 0,
      ...IDLE,
      logLength: log.length,
      log: log.slice(start),
      offset: start,
      live: null,
      liveRunId: null,
    };
  }
  const { run, jobs } = await latest.get();
  if (!run) return { id: 0, ...IDLE, log: [], offset: 0, live: null, liveRunId: null };

  const log = logOf(run, jobs);
  const start = clientRunId === run.id ? Math.min(offset, log.length) : 0;
  const name = RUN_NAME.exec(run.display_title);
  const phase = phaseOf(run);
  const startedAt = run.run_started_at ?? run.created_at;
  const tunnel = phase === 'running' ? await liveTunnelFor(name?.[1] ?? null, startedAt) : null;
  return {
    id: run.id,
    runId: name?.[1] ?? null,
    label: name?.[2] ?? run.display_title,
    suite: null,
    phase,
    startedAt,
    finishedAt: phase === 'running' ? null : run.updated_at,
    exitCode: phase === 'running' ? null : phase === 'passed' ? 0 : 1,
    logLength: log.length,
    preview: Boolean(tunnel),
    externalUrl: run.html_url,
    log: log.slice(start),
    offset: start,
    live: tunnel ? await fetchTunnelLive(tunnel) : null,
    liveRunId: null,
  };
}

/** The latest preview frame of worker slot `slot` in the active workflow run (204 when there is none). */
export async function getCloudFrame(slot: string): Promise<Response> {
  const { run } = await latest.get();
  const name = run && isActive(run) ? RUN_NAME.exec(run.display_title) : null;
  const tunnel = name ? await liveTunnelFor(name[1]!, run!.run_started_at ?? run!.created_at) : null;
  if (!tunnel) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  return fetchTunnelFrame(tunnel, slot);
}

export async function isCloudBusy(): Promise<boolean> {
  return isActive((await latest.get()).run);
}

/** Validates the request like a local run, reserves a run ID, and dispatches the workflow with it. */
export async function startCloudRun(request: RunRequest): Promise<RunState> {
  latest.clear();
  if (await isCloudBusy()) throw new RunError('A run is already in progress on GitHub Actions', 409);
  const resolved = await resolveRequest(request);

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

  await github(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({
      ref: BRANCH,
      inputs: {
        run_id: runId,
        label: resolved.label,
        suite: resolved.script,
        files: resolved.extraArgs.join(' '),
        browsers: resolved.browsers.join(','),
        devices: resolved.devices.join(','),
        size: resolved.size ?? '',
        preview: String(resolved.preview),
      },
    }),
  });
  latest.clear();
  return {
    id: -1,
    ...IDLE,
    runId,
    label: resolved.label,
    suite: resolved.suite,
    phase: 'running',
    startedAt,
    preview: resolved.preview,
  };
}

export async function cancelCloudRun(): Promise<boolean> {
  latest.clear();
  const { run } = await latest.get();
  if (!run || !isActive(run)) return false;
  await github(`/actions/runs/${run.id}/cancel`, { method: 'POST' });
  const name = RUN_NAME.exec(run.display_title);
  await updateStore((data) =>
    addActivity(data, {
      type: 'run.cancelled',
      time: new Date().toISOString(),
      title: `Run ${name?.[1] ?? `#${run.run_number}`} cancelled`,
      detail: name?.[2] ?? run.display_title,
      ...(name?.[1] ? { runId: name[1] } : {}),
    }),
  );
  latest.clear();
  return true;
}
