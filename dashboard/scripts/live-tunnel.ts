/**
 * Hosted live preview, run in the background on the GitHub Actions runner while the tests execute: serves the
 * framework's live.json and preview frames on localhost behind a random key, exposes them through a Cloudflare quick
 * tunnel (no account needed), and publishes the tunnel's address and key to Vercel Blob. The hosted dashboard relays
 * them to the browser (src/lib/server/live-tunnel.ts). One Blob write per run.
 *
 * Environment: RUN_ID (set when the dashboard started the run), BLOB_READ_WRITE_TOKEN; `cloudflared` on the PATH.
 * Prints "Live preview published" once the dashboard can reach it.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { BLOB_PATHS, writeJson } from '../src/lib/server/cloud';
import type { LiveTunnel } from '../src/lib/server/live-tunnel';
import { LIVE_FILE, LIVE_FRAMES_DIR } from '../src/lib/server/paths';

const PORT = 8787;
const TUNNEL_TIMEOUT_MS = 60_000;
const TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

function serve(key: string): void {
  http
    .createServer(async (request, response) => {
      if (request.headers['x-live-key'] !== key) {
        response.writeHead(401).end();
        return;
      }
      const frame = /^\/frame\/(\d{1,3})$/.exec(request.url ?? '');
      const file =
        request.url === '/live.json' ? LIVE_FILE : frame ? path.join(LIVE_FRAMES_DIR, `${frame[1]}.jpg`) : null;
      if (!file) {
        response.writeHead(404).end();
        return;
      }
      try {
        const body = await fs.readFile(file);
        response
          .writeHead(200, { 'Content-Type': frame ? 'image/jpeg' : 'application/json', 'Cache-Control': 'no-store' })
          .end(body);
      } catch {
        // Not written yet: no test has started, or this worker slot has no frame.
        response.writeHead(204).end();
      }
    })
    .listen(PORT, '127.0.0.1');
}

/** Starts a quick tunnel to the server and resolves with its public URL. */
function openTunnel(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => reject(new Error('cloudflared reported no tunnel URL')), TUNNEL_TIMEOUT_MS);
    const onOutput = (chunk: Buffer) => {
      const match = TUNNEL_URL.exec(chunk.toString());
      if (!match) return;
      clearTimeout(timer);
      resolve(match[0]);
    };
    child.stdout.on('data', onOutput);
    child.stderr.on('data', onOutput);
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`cloudflared exited with code ${code}`));
    });
  });
}

/** A new quick tunnel's hostname can take a few seconds to resolve. */
async function waitUntilReachable(url: string, key: string): Promise<void> {
  const deadline = Date.now() + TUNNEL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const response = await fetch(`${url}/live.json`, {
      headers: { 'x-live-key': key },
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);
    if (response && (response.status === 200 || response.status === 204)) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`the tunnel ${url} did not become reachable`);
}

async function main(): Promise<void> {
  const runId = process.env.RUN_ID;
  if (!runId) {
    console.log('No RUN_ID: live preview is only for runs started from the dashboard.');
    return;
  }
  const key = crypto.randomBytes(24).toString('hex');
  serve(key);
  const url = await openTunnel();
  await waitUntilReachable(url, key);
  const tunnel: LiveTunnel = { runId, url, key, startedAt: new Date().toISOString() };
  await writeJson(BLOB_PATHS.liveTunnel(runId), tunnel);
  // The server and tunnel keep this process alive until the job ends.
  console.log(`Live preview published for ${runId}`);
}

main().catch((error: unknown) => {
  console.error(`Live preview unavailable: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
