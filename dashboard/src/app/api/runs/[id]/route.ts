import { connection, type NextRequest } from 'next/server';
import { deleteRunArtifacts } from '@/lib/server/archive';
import { isSameOrigin } from '@/lib/server/http';
import { readStore, removeRuns } from '@/lib/server/store';

/** One stored run with its per-test results. `?download=1` returns it as a JSON file. */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/runs/[id]'>) {
  await connection();
  const { id } = await ctx.params;
  const run = (await readStore()).runs.find((entry) => entry.id === id);
  if (!run) return Response.json({ error: `Run ${id} not found` }, { status: 404 });

  if (request.nextUrl.searchParams.get('download')) {
    return new Response(JSON.stringify(run, null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${run.id}.json"` },
    });
  }
  return Response.json(run, { headers: { 'Cache-Control': 'no-store' } });
}

/** Deletes one stored run, its archived media and its Allure report. Same-origin requests only. */
export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/runs/[id]'>) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const [removed] = await removeRuns([id]);
  if (!removed) return Response.json({ error: `Run ${id} not found` }, { status: 404 });
  await deleteRunArtifacts(id);
  return Response.json({ deleted: id });
}
