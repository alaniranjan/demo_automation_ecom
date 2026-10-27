import fs from 'node:fs/promises';
import path from 'node:path';
import { connection, type NextRequest } from 'next/server';
import { isSameOrigin, serveFile } from '@/lib/server/http';
import { ARCHIVE_DIR, ARTIFACTS_DIR, FRAMEWORK_DIR, VISUAL_BASELINE_DIR, resolveInside } from '@/lib/server/paths';
import { CLOUD, deleteUrls } from '@/lib/server/cloud';
import { addActivity, readStore, updateStore } from '@/lib/server/store';

const MAX_PATHS_PER_REQUEST = 2000;

/**
 * Resolves a framework-relative attachment path, allowing only test-results/, the run archive and (for the latest
 * run's screenshot mismatches, before they are archived) the approved UI baselines.
 */
function resolveArtifact(relative: string): string | null {
  const file = resolveInside(FRAMEWORK_DIR, relative);
  return file &&
    (resolveInside(ARTIFACTS_DIR, file) || resolveInside(ARCHIVE_DIR, file) || resolveInside(VISUAL_BASELINE_DIR, file))
    ? file
    : null;
}

/**
 * Serves a test attachment (screenshot, video, trace) by its framework-relative path: the latest run's files in
 * test-results/, or archived files in .dashboard/artifacts/. Anything else returns 404.
 */
export async function GET(request: NextRequest) {
  await connection();
  const relative = request.nextUrl.searchParams.get('path');
  const file = relative ? resolveArtifact(relative) : null;
  if (!file) return new Response('Not found', { status: 404 });
  return serveFile(file, request);
}

/**
 * Deletes attachments: body `{ "paths": ["test-results/...", ".dashboard/artifacts/..."] }`.
 * Files are removed from disk and from stored runs; test results are kept. Same-origin requests only.
 */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  const paths = body?.paths;
  if (
    !Array.isArray(paths) ||
    paths.length === 0 ||
    paths.length > MAX_PATHS_PER_REQUEST ||
    !paths.every((item) => typeof item === 'string')
  ) {
    return Response.json(
      { error: `Body must be { "paths": string[] } with 1-${MAX_PATHS_PER_REQUEST} paths` },
      { status: 400 },
    );
  }

  if (CLOUD) return deleteCloudArtifacts(paths as string[]);

  const files = paths.map(resolveArtifact);
  if (files.some((file) => file === null)) {
    return Response.json(
      { error: 'Only files in test-results/ or .dashboard/artifacts/ can be deleted' },
      { status: 400 },
    );
  }

  const targets = files as string[];
  await Promise.all(targets.map((file) => fs.rm(file, { force: true })));
  const deleted = new Set(targets.map((file) => path.relative(FRAMEWORK_DIR, file)));

  await updateStore((data) => {
    for (const run of data.runs) {
      for (const test of run.tests ?? []) {
        if (!test.attachments) continue;
        test.attachments = test.attachments.filter((attachment) => !deleted.has(attachment.path));
        if (test.attachments.length === 0) delete test.attachments;
      }
    }
    addActivity(data, {
      type: 'artifacts.deleted',
      time: new Date().toISOString(),
      title: `${deleted.size} artifact${deleted.size === 1 ? '' : 's'} deleted`,
    });
  });

  return Response.json({ deleted: deleted.size });
}

/** Hosted dashboard: attachments are Blob URLs; only URLs that belong to a stored run can be deleted. */
async function deleteCloudArtifacts(urls: string[]): Promise<Response> {
  const known = new Set(
    (await readStore()).runs.flatMap((run) =>
      (run.tests ?? []).flatMap((test) => (test.attachments ?? []).map((attachment) => attachment.path)),
    ),
  );
  if (!urls.every((url) => known.has(url))) {
    return Response.json({ error: 'Only attachments of stored runs can be deleted' }, { status: 400 });
  }
  await deleteUrls(urls);
  const deleted = new Set(urls);
  await updateStore((data) => {
    for (const run of data.runs) {
      for (const test of run.tests ?? []) {
        if (!test.attachments) continue;
        test.attachments = test.attachments.filter((attachment) => !deleted.has(attachment.path));
        if (test.attachments.length === 0) delete test.attachments;
      }
    }
    addActivity(data, {
      type: 'artifacts.deleted',
      time: new Date().toISOString(),
      title: `${deleted.size} artifact${deleted.size === 1 ? '' : 's'} deleted`,
    });
  });
  return Response.json({ deleted: deleted.size });
}
