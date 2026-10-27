import { connection, type NextRequest } from 'next/server';
import { deleteRunArtifacts, pruneArtifacts } from '@/lib/server/archive';
import { isSameOrigin } from '@/lib/server/http';
import { markDeleted, readStore, removeRuns, updateStore, withoutTests } from '@/lib/server/store';

/** All stored runs (newest first). `?download=1` returns the full store, including per-test results, as a file. */
export async function GET(request: NextRequest) {
  await connection();
  const store = await readStore();
  if (request.nextUrl.searchParams.get('download')) {
    return new Response(JSON.stringify(store, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="qa-dashboard-history-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }
  const runs = [...store.runs].reverse().map(withoutTests);
  return Response.json({ runs, total: runs.length }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * With body `{ "ids": [...] }`, deletes those runs with their media and reports. Without a body, clears all run
 * history, activity, media and reports.
 */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  if (body?.ids !== undefined) {
    if (!Array.isArray(body.ids) || !body.ids.every((id) => typeof id === 'string')) {
      return Response.json({ error: '"ids" must be an array of run IDs' }, { status: 400 });
    }
    const deleted = await removeRuns(body.ids);
    await Promise.all(deleted.map((id) => deleteRunArtifacts(id)));
    return Response.json({ deleted });
  }
  let removed = 0;
  await updateStore((data) => {
    removed = data.runs.length;
    markDeleted(
      data,
      data.runs.map((run) => run.startTime),
    );
    data.runs = [];
    data.activity = [];
  });
  await pruneArtifacts(new Set());
  return Response.json({ removed });
}
