import { connection, type NextRequest } from 'next/server';
import { normalizeMobile, readAccountSettings, writeMobile } from '@/lib/server/account';
import { CLOUD } from '@/lib/server/cloud';
import { isSameOrigin } from '@/lib/server/http';

const NO_STORE = { 'Cache-Control': 'no-store' };

function unavailable(): Response | null {
  // The number lives in the local framework's .env; a hosted dashboard has no such file.
  return CLOUD ? Response.json({ error: 'Account settings are only available on a local dashboard' }, { status: 404 }) : null;
}

/** `{ mobileMasked: "••••••3210" | null }` for the customer mobile that `npm run auth:login` signs in with. */
export async function GET() {
  await connection();
  return unavailable() ?? Response.json(await readAccountSettings(), { headers: NO_STORE });
}

/** Saves `{ "mobile": "9876543210" }` to the framework's git-ignored .env as DEMO_MOBILE. */
export async function PUT(request: NextRequest) {
  const blocked = unavailable();
  if (blocked) return blocked;
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { mobile?: unknown } | null;
  const mobile = typeof body?.mobile === 'string' ? normalizeMobile(body.mobile) : null;
  if (!mobile) {
    return Response.json({ error: 'Enter a 10-digit Indian mobile number (starting with 6, 7, 8 or 9)' }, { status: 400 });
  }
  return Response.json(await writeMobile(mobile), { headers: NO_STORE });
}

/** Removes the saved number; `npm run auth:login` then waits for it to be typed in the browser again. */
export async function DELETE(request: NextRequest) {
  const blocked = unavailable();
  if (blocked) return blocked;
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }
  return Response.json(await writeMobile(null), { headers: NO_STORE });
}
