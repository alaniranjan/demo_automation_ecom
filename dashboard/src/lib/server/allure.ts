import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BLOB_PATHS, CLOUD, deleteUrls, uploadFile } from './cloud';
import { ARCHIVE_DIR, FRAMEWORK_DIR, resolveInside } from './paths';

const ALLURE_RESULTS = path.join(FRAMEWORK_DIR, 'allure-results');
const ALLURE_BIN = path.join(FRAMEWORK_DIR, 'node_modules', '.bin', 'allure');
const GENERATE_TIMEOUT_MS = 180_000;

/** Each run's Allure report sits next to its media, so deleting or pruning the run removes it too. */
export function runReportDir(runId: string): string | null {
  const runDir = resolveInside(ARCHIVE_DIR, runId);
  return runDir && path.join(runDir, 'allure-report');
}

// One generation at a time; a run starting from the dashboard waits for it, since it clears allure-results/.
let queue: Promise<unknown> = Promise.resolve();

export function reportsIdle(): Promise<unknown> {
  return queue;
}

/**
 * Builds the Allure report of the run whose results are in allure-results/. Resolves to where it can be opened:
 * the local folder's served path, or (cloud) the URL of the single-file report uploaded to Blob; null on failure.
 */
export function generateRunReport(runId: string): Promise<string | null> {
  const task = queue.then(() => generate(runId));
  queue = task.catch(() => null);
  return task;
}

function runAllure(output: string, runId: string, env: Record<string, string> = {}): Promise<boolean> {
  if (!existsSync(ALLURE_RESULTS) || !existsSync(ALLURE_BIN)) return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile(
      ALLURE_BIN,
      ['generate', 'allure-results', '--output', output, '--clean', '--report-name', `Allure Report · ${runId}`],
      { cwd: FRAMEWORK_DIR, timeout: GENERATE_TIMEOUT_MS, env: { ...process.env, ...env } },
      (error) => resolve(!error && existsSync(path.join(output, 'index.html'))),
    );
  });
}

async function generate(runId: string): Promise<string | null> {
  if (CLOUD) {
    // One self-contained HTML file (allurerc.mjs reads ALLURE_SINGLE_FILE), so the report is a single upload.
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'allure-'));
    try {
      if (!(await runAllure(output, runId, { ALLURE_SINGLE_FILE: '1' }))) return null;
      return await uploadFile(
        BLOB_PATHS.runFolder(runId),
        'allure-report.html',
        path.join(output, 'index.html'),
        'text/html',
      );
    } finally {
      await fs.rm(output, { recursive: true, force: true });
    }
  }
  const output = runReportDir(runId);
  if (!output || !(await runAllure(output, runId))) return null;
  return `/api/runs/${encodeURIComponent(runId)}/report/index.html`;
}

/** Deletes the Allure reports of these runs; the runs themselves stay in history. */
export async function deleteRunReports(ids: readonly string[], urls: readonly string[] = []): Promise<void> {
  if (CLOUD) return deleteUrls(urls);
  await Promise.all(
    ids.map(async (id) => {
      const dir = runReportDir(id);
      if (dir) await fs.rm(dir, { recursive: true, force: true });
    }),
  );
}
