/**
 * GitHub Actions step (see .github/workflows/e2e.yml): publishes the run in ../test-results to the hosted dashboard.
 * Uses the dashboard's own ingest code with BLOB_READ_WRITE_TOKEN set, so everything lands in Vercel Blob:
 * the test catalog, the run record, failed tests' screenshots and videos, and the run's Allure report.
 *
 * Optional environment (set when the dashboard started the run): RUN_ID, RUN_LABEL, RUN_SUITE.
 * `--catalog-only` publishes just the test catalog (e.g. from a developer machine with DASHBOARD_MODE=cloud).
 */
import { listTestsLocally } from '../src/lib/server/catalog';
import { BLOB_PATHS, CLOUD, writeJson } from '../src/lib/server/cloud';
import { readLocalFrameworkPackage, type PublishedFramework } from '../src/lib/server/framework';
import { ingestReport } from '../src/lib/server/ingest';
import { loadLocalReport } from '../src/lib/server/report';
import { readStore } from '../src/lib/server/store';

async function main(): Promise<void> {
  if (!CLOUD) throw new Error('BLOB_READ_WRITE_TOKEN is not set; nothing to publish to.');

  // What the dashboard offers to run: suites from package.json, spec files, browsers and devices.
  const [pkg, listed] = await Promise.all([readLocalFrameworkPackage(), listTestsLocally()]);
  if (listed) {
    const framework: PublishedFramework = { package: pkg, listed, publishedAt: new Date().toISOString() };
    await writeJson(BLOB_PATHS.framework, framework);
    console.log(`Published the test catalog (${(listed.tests ?? []).length} tests).`);
  } else {
    console.warn('Could not list the tests; the catalog was not updated.');
  }

  if (process.argv.includes('--catalog-only')) return;

  const report = await loadLocalReport();
  if (!report) {
    console.log('No test-results/results.json: no run to publish.');
    return;
  }

  const runId = await ingestReport(report, {
    runId: process.env.RUN_ID || undefined,
    label: process.env.RUN_LABEL || undefined,
    suite: process.env.RUN_SUITE || undefined,
    trigger: process.env.RUN_ID ? 'dashboard' : 'ci',
    awaitReport: true,
  });
  if (!runId) {
    console.log('This run was already published (or deleted from the dashboard).');
    return;
  }

  // The dashboard's "latest results" views, with attachments pointing at their Blob URLs.
  const run = (await readStore()).runs.find((entry) => entry.id === runId);
  await writeJson(BLOB_PATHS.latest, {
    ...report,
    tests: report.tests.map((test, index) => ({ ...test, attachments: run?.tests?.[index]?.attachments ?? [] })),
  });
  console.log(`Published ${runId}: ${report.summary.counts.passed} passed, ${report.summary.counts.failed} failed.`);
  console.log(run?.reportUrl ? `Allure report: ${run.reportUrl}` : 'The Allure report could not be generated.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
