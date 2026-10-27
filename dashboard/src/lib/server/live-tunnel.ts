import type { LiveState } from '../types';
import { BLOB_PATHS, readJson } from './cloud';
import { parseLive } from './live';

/**
 * Hosted live preview: while a workflow run executes with live preview on, scripts/live-tunnel.ts serves the
 * runner's live.json and preview frames through a Cloudflare quick tunnel and publishes its address here. The
 * dashboard relays both through its own (password-protected) API, so the tunnel address never reaches the browser.
 */
export interface LiveTunnel {
  runId: string;
  url: string;
  /** Sent as `x-live-key`; the tunnel serves nothing without it. */
  key: string;
  startedAt: string;
}

/** While a run's tunnel isn't published yet, look again at most this often (each look is one Blob operation). */
const RECHECK_MS = 3_000;
/** Stop looking this long after the run started: it was started with live preview off. */
const GIVE_UP_AFTER_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 4_000;

/** The tunnel per run ID, once found; a run's tunnel doesn't change, so it is read from Blob only once. */
const found = new Map<string, LiveTunnel>();
const lastLook = new Map<string, number>();

/** The live preview tunnel of run `runId` (started at `startedAt`), or null if it has none (yet). */
export async function liveTunnelFor(runId: string | null, startedAt: string | null): Promise<LiveTunnel | null> {
  if (!runId) return null;
  const known = found.get(runId);
  if (known) return known;
  const now = Date.now();
  if (startedAt && now - new Date(startedAt).getTime() > GIVE_UP_AFTER_MS) return null;
  if (now - (lastLook.get(runId) ?? 0) < RECHECK_MS) return null;
  lastLook.set(runId, now);
  const tunnel = (await readJson<LiveTunnel>(BLOB_PATHS.liveTunnel(runId)).catch(() => null))?.data ?? null;
  if (tunnel?.runId !== runId) return null;
  found.clear();
  found.set(runId, tunnel);
  return tunnel;
}

async function request(tunnel: LiveTunnel, pathname: string): Promise<Response | null> {
  try {
    return await fetch(`${tunnel.url}${pathname}`, {
      headers: { 'x-live-key': tunnel.key },
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // Tunnel starting up or already closed with the run.
    return null;
  }
}

/** The run's live state from the runner; null until the first test starts or if the tunnel is unreachable. */
export async function fetchTunnelLive(tunnel: LiveTunnel): Promise<LiveState | null> {
  const response = await request(tunnel, '/live.json');
  if (response?.status !== 200) return null;
  try {
    return parseLive(await response.text());
  } catch {
    return null;
  }
}

/** The latest frame of worker slot `slot`, as the response to send the browser (204 when there is none). */
export async function fetchTunnelFrame(tunnel: LiveTunnel, slot: string): Promise<Response> {
  const response = await request(tunnel, `/frame/${slot}`);
  if (response?.status !== 200) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  return new Response(response.body, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' },
  });
}
