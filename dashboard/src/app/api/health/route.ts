import { connection } from 'next/server';
import { isBusy } from '@/lib/server/runner';

const startedAt = new Date().toISOString();

/** Liveness check used by the top bar's "Backend online" indicator. */
export async function GET() {
  await connection();
  return Response.json(
    { status: 'ok', time: new Date().toISOString(), startedAt, uptimeSeconds: Math.round(process.uptime()), runnerBusy: isBusy() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
