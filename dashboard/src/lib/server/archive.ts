import fs from 'node:fs/promises';
import path from 'node:path';
import type { Attachment, TestRow } from '../types';
import { BLOB_PATHS, CLOUD, deletePrefix, listRunFolders, uploadFile } from './cloud';
import { ARCHIVE_DIR, FRAMEWORK_DIR, resolveInside } from './paths';

/** How many runs keep their screenshots, videos and traces (older runs keep results only). */
export const ARTIFACT_RUNS_KEPT = Math.max(1, Number(process.env.ARTIFACT_RUNS_KEPT ?? 20) || 20);

const ARCHIVED_TYPES = [/^image\//, /^video\//, /zip$/];

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'test'
  );
}

/**
 * Copies each test's media out of test-results/ into .dashboard/artifacts/<runId>/, which survives later runs.
 * Returns the archived attachments per test, in the same order as `tests`.
 */
export async function archiveRunArtifacts(runId: string, tests: readonly TestRow[]): Promise<Attachment[][]> {
  const runDir = resolveInside(ARCHIVE_DIR, runId);
  if (!runDir) return tests.map(() => []);

  return Promise.all(
    tests.map(async (test, index) => {
      const media = test.attachments.filter((attachment) =>
        ARCHIVED_TYPES.some((type) => type.test(attachment.contentType)),
      );
      if (media.length === 0) return [];
      const testDir = path.join(runDir, `${String(index + 1).padStart(3, '0')}-${slug(test.title)}`);
      if (!CLOUD) await fs.mkdir(testDir, { recursive: true });

      const archived: Attachment[] = [];
      for (const [position, attachment] of media.entries()) {
        const source = resolveInside(FRAMEWORK_DIR, attachment.path);
        if (!source) continue;
        if (CLOUD) {
          // Uploaded to Blob; the attachment's path becomes the public URL the browser loads.
          const name = `${String(index + 1).padStart(3, '0')}-${slug(test.title)}/${position + 1}-${path.basename(attachment.path)}`;
          try {
            const url = await uploadFile(BLOB_PATHS.runFolder(runId), name, source, attachment.contentType);
            archived.push({ ...attachment, path: url });
          } catch {
            // Missing or unreadable; skip it.
          }
          continue;
        }
        const target = path.join(testDir, `${position + 1}-${path.basename(attachment.path)}`);
        try {
          await fs.copyFile(source, target);
          archived.push({ ...attachment, path: path.relative(FRAMEWORK_DIR, target) });
        } catch {
          // The source was cleared by a newer run before it could be archived; skip it.
        }
      }
      return archived;
    }),
  );
}

export async function deleteRunArtifacts(runId: string): Promise<void> {
  if (CLOUD) return deletePrefix(BLOB_PATHS.runFolder(runId));
  const runDir = resolveInside(ARCHIVE_DIR, runId);
  if (runDir) await fs.rm(runDir, { recursive: true, force: true });
}

/** Removes archived media for every run not in `keepRunIds`. */
export async function pruneArtifacts(keepRunIds: ReadonlySet<string>): Promise<void> {
  let entries: string[] = [];
  try {
    entries = CLOUD ? await listRunFolders() : await fs.readdir(ARCHIVE_DIR);
  } catch {
    return;
  }
  await Promise.all(entries.filter((entry) => !keepRunIds.has(entry)).map((entry) => deleteRunArtifacts(entry)));
}
