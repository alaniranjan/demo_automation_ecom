import type { NextRequest } from 'next/server';
import { CLOUD } from '@/lib/server/cloud';
import { isSameOrigin } from '@/lib/server/http';
import { RunError, startInstall } from '@/lib/server/runner';

/** Installs a Playwright browser engine: `{ "browser": "firefox" }`. Output streams to the run console. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }
  if (CLOUD) {
    return Response.json({ error: 'GitHub Actions installs every browser for each run' }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as { browser?: unknown } | null;
  if (typeof body?.browser !== 'string') {
    return Response.json({ error: 'Body must be { "browser": string }' }, { status: 400 });
  }
  try {
    return Response.json(await startInstall(body.browser), { status: 202 });
  } catch (error) {
    if (error instanceof RunError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
