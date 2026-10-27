import { connection, type NextRequest } from 'next/server';
import { CLOUD } from '@/lib/server/cloud';
import { cancelCloudRun, getCloudRunState, startCloudRun } from '@/lib/server/github';
import { isSameOrigin } from '@/lib/server/http';
import { trackTerminalRun } from '@/lib/server/ingest';
import { readLive } from '@/lib/server/live';
import { RunError, cancelRun, getRunState, isBusy, startRun } from '@/lib/server/runner';
import type { RunRequest, RunStatePayload } from '@/lib/types';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseRequest(body: unknown): RunRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { suite, files, browsers, devices, preview, size, updateSnapshots } = body as {
    suite?: unknown;
    files?: unknown;
    browsers?: unknown;
    devices?: unknown;
    preview?: unknown;
    size?: unknown;
    updateSnapshots?: unknown;
  };
  if (devices !== undefined && !isStringArray(devices)) return null;
  if (size !== undefined && typeof size !== 'string') return null;
  if (browsers !== undefined && !isStringArray(browsers)) return null;
  if (preview !== undefined && typeof preview !== 'boolean') return null;
  if (updateSnapshots !== undefined && typeof updateSnapshots !== 'boolean') return null;
  const options = {
    ...(browsers ? { browsers } : {}),
    ...(devices ? { devices } : {}),
    ...(preview !== undefined ? { preview } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(updateSnapshots !== undefined ? { updateSnapshots } : {}),
  };
  if (typeof suite === 'string') return { suite, ...options };
  if (isStringArray(files)) return { files, ...options };
  return null;
}

/** Current run state, live progress, and log lines after `?offset=` for run `?runId=`. */
export async function GET(request: NextRequest) {
  await connection();
  const params = request.nextUrl.searchParams;
  const offset = Number(params.get('offset') ?? 0) || 0;
  const runId = Number(params.get('runId') ?? -1);

  // Hosted: the run is a GitHub Actions workflow run.
  if (CLOUD) {
    try {
      return Response.json(await getCloudRunState(offset, runId), { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof RunError) return Response.json({ error: error.message }, { status: error.status });
      throw error;
    }
  }

  const live = await readLive();
  const state = getRunState(offset, runId);
  const liveRunId = isBusy() ? state.runId : await trackTerminalRun(live);
  const payload: RunStatePayload = { ...state, live, liveRunId };
  return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}

/** Starts a run: `{ "suite": "<npm script>" }` or `{ "files": [...] }`, optionally with `"browsers": ["chrome", "firefox"]`. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }
  const runRequest = parseRequest(await request.json().catch(() => null));
  if (!runRequest) {
    return Response.json(
      { error: 'Body must be { "suite": string } or { "files": string[] }, with optional "browsers": string[]' },
      { status: 400 },
    );
  }
  try {
    return Response.json(await (CLOUD ? startCloudRun(runRequest) : startRun(runRequest)), { status: 202 });
  } catch (error) {
    if (error instanceof RunError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

/** Cancels the active dashboard run. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }
  const cancelled = CLOUD ? await cancelCloudRun() : cancelRun();
  return cancelled
    ? Response.json({ cancelled: true })
    : Response.json({ error: 'No run in progress' }, { status: 409 });
}
