import type { NextRequest } from 'next/server';
import { deleteRunReports } from '@/lib/server/allure';
import { isSameOrigin } from '@/lib/server/http';
import { updateStore } from '@/lib/server/store';

/** Deletes runs' Allure reports: body `{ "ids": [...] }`. The runs, their results and media are kept. */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  if (!Array.isArray(body?.ids) || !body.ids.every((id) => typeof id === 'string')) {
    return Response.json({ error: '"ids" must be an array of run IDs' }, { status: 400 });
  }
  const ids = body.ids as string[];
  let deleted: string[] = [];
  let urls: string[] = [];
  await updateStore((data) => {
    const runs = data.runs.filter((run) => run.report && ids.includes(run.id));
    urls = runs.flatMap((run) => (run.reportUrl ? [run.reportUrl] : []));
    runs.forEach((run) => {
      delete run.report;
      delete run.reportUrl;
    });
    deleted = runs.map((run) => run.id);
  });
  await deleteRunReports(deleted, urls);
  return Response.json({ deleted });
}
