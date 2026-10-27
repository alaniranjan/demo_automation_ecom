import fs from 'node:fs/promises';
import path from 'node:path';
import { connection } from 'next/server';
import { getCatalog } from '@/lib/server/catalog';
import { CLOUD } from '@/lib/server/cloud';
import { ingestReport } from '@/lib/server/ingest';
import { getMeta } from '@/lib/server/meta';
import { REPORT_DIRS } from '@/lib/server/paths';
import { loadLatestReport } from '@/lib/server/report';
import { readStore, withoutTests } from '@/lib/server/store';
import type { ResultsPayload } from '@/lib/types';

const ACTIVITY_LIMIT = 50;

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

/** Everything the dashboard renders: latest results, stored runs and activity, catalog and framework metadata. */
export async function GET() {
  await connection();

  const [report, catalog] = await Promise.all([loadLatestReport(), getCatalog()]);
  // Hosted, GitHub Actions records runs itself; locally the latest results.json is recorded here.
  if (!CLOUD) await ingestReport(report);
  const [store, meta, allure, playwright] = await Promise.all([
    readStore(),
    getMeta(catalog),
    CLOUD ? Promise.resolve(false) : exists(path.join(REPORT_DIRS.allure, 'index.html')),
    CLOUD ? Promise.resolve(false) : exists(path.join(REPORT_DIRS.playwright, 'index.html')),
  ]);

  const payload: ResultsPayload = {
    summary: report?.summary ?? null,
    tests: report?.tests ?? [],
    features: report?.features ?? [],
    // Per-test details are served by /api/runs/{id}.
    runs: store.runs.map(withoutTests),
    activity: store.activity.slice(-ACTIVITY_LIMIT).reverse(),
    reports: { allure, playwright },
    catalog,
    meta,
  };
  return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
