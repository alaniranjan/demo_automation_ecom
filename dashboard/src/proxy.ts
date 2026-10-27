import { NextResponse, type NextRequest } from 'next/server';

/**
 * Password protection for the hosted dashboard: with DASHBOARD_PASSWORD set, every page and API asks for it
 * (HTTP Basic auth; the user name is DASHBOARD_USER, default "admin"). Without it, nothing is checked, as when
 * running locally.
 */
export function proxy(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const expected = `Basic ${btoa(`${process.env.DASHBOARD_USER ?? 'admin'}:${password}`)}`;
  if (request.headers.get('authorization') === expected) return NextResponse.next();

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="QA dashboard", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next.js build assets and the favicon.
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
