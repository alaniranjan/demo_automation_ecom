import path from 'node:path';
import { connection } from 'next/server';
import { runReportDir } from '@/lib/server/allure';
import { CLOUD } from '@/lib/server/cloud';
import { readStore } from '@/lib/server/store';
import { serveFile } from '@/lib/server/http';
import { resolveInside } from '@/lib/server/paths';

/** Serves the Allure report generated for one run: /api/runs/{id}/report/. */
export async function GET(_request: Request, ctx: RouteContext<'/api/runs/[id]/report/[[...path]]'>) {
  await connection();
  const { id, path: segments = [] } = await ctx.params;
  // Hosted dashboard: the report is one HTML file in Blob.
  if (CLOUD) {
    const run = (await readStore()).runs.find((entry) => entry.id === id);
    return run?.reportUrl
      ? Response.redirect(run.reportUrl, 307)
      : new Response('This run has no report', { status: 404 });
  }
  const root = runReportDir(id);
  if (!root) return new Response('Unknown run', { status: 404 });

  // The report uses relative asset URLs, so the entry point must be addressed as a file inside the folder.
  if (segments.length === 0) {
    return new Response(null, {
      status: 307,
      headers: { Location: `/api/runs/${encodeURIComponent(id)}/report/index.html` },
    });
  }
  const file = resolveInside(path.resolve(root), segments.join('/'));
  return file ? serveFile(file) : new Response('Not found', { status: 404 });
}
