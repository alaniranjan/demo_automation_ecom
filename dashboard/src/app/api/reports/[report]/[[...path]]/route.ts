import { connection } from 'next/server';
import { serveFile } from '@/lib/server/http';
import { REPORT_DIRS, isReportName, resolveInside } from '@/lib/server/paths';

/** Serves the generated Allure or Playwright HTML report: /api/reports/allure/ and /api/reports/playwright/. */
export async function GET(_request: Request, ctx: RouteContext<'/api/reports/[report]/[[...path]]'>) {
  await connection();
  const { report, path: segments = [] } = await ctx.params;
  if (!isReportName(report)) {
    return new Response('Unknown report', { status: 404 });
  }

  // Reports use relative asset URLs, so the entry point must be addressed as a file inside the folder.
  if (segments.length === 0) {
    // Relative Location keeps the browser on whichever host it used (127.0.0.1 vs localhost).
    return new Response(null, { status: 307, headers: { Location: `/api/reports/${report}/index.html` } });
  }

  const file = resolveInside(REPORT_DIRS[report], segments.join('/'));
  return file ? serveFile(file) : new Response('Not found', { status: 404 });
}
