import { existsSync } from 'node:fs';
import path from 'node:path';
import { connection, type NextRequest } from 'next/server';
import { CLOUD } from '@/lib/server/cloud';
import { getCloudFrame } from '@/lib/server/github';
import { serveFile } from '@/lib/server/http';
import { LIVE_FRAMES_DIR } from '@/lib/server/paths';

/** Latest browser snapshot of a worker slot (`?slot=0`), while a run with live preview is executing. */
export async function GET(request: NextRequest) {
  await connection();
  const slot = request.nextUrl.searchParams.get('slot') ?? '';
  if (!/^\d{1,3}$/.test(slot)) return new Response('Invalid slot', { status: 400 });
  // Hosted: relayed from the GitHub Actions runner.
  if (CLOUD) return getCloudFrame(slot);
  const file = path.join(LIVE_FRAMES_DIR, `${slot}.jpg`);
  // No frame yet: "no content" rather than 404, so polling while a test starts doesn't flood the console.
  if (!existsSync(file)) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  return serveFile(file);
}
