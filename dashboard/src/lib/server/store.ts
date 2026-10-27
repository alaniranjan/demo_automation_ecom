import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { labelFromScript } from '../naming';
import type { ActivityEvent, RunRecord, StatusCounts } from '../types';
import { BLOB_PATHS, CLOUD, cached, isConflict, readJson, writeJson } from './cloud';
import { DATA_DIR, LEGACY_HISTORY_FILE, STORE_FILE } from './paths';

/**
 * The dashboard's backend data, persisted as one JSON file in the framework's .dashboard/ folder:
 * every recorded run (with per-test outcomes) and the activity feed.
 */
export interface StoreData {
  version: 1;
  runs: RunRecord[];
  activity: ActivityEvent[];
  /** Start times of deleted runs, so the latest report is not recorded again after its run was deleted. */
  deletedStartTimes: string[];
  /** Highest run number issued per day (YYYYMMDD), so IDs are never reused after deletes or clearing history. */
  lastRunNumber: Record<string, number>;
}

export const MAX_RUNS = 100;
const MAX_ACTIVITY = 300;
const MAX_DELETED = 500;

/** Remembers that runs starting at `startTimes` were deleted on purpose. */
export function markDeleted(data: StoreData, startTimes: string[]): void {
  data.deletedStartTimes = [...new Set([...data.deletedStartTimes, ...startTimes])].slice(-MAX_DELETED);
}

interface LegacyHistoryEntry {
  startTime: string;
  duration: number;
  counts: StatusCounts;
  total: number;
  suite?: string;
  failures?: { title: string; describe: string; feature: string; status: 'failed' | 'flaky' }[];
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/**
 * Issues the next sequential ID for the day of `iso`, e.g. RUN-20261020-004. Considers stored runs, reserved IDs
 * and every number issued before, so an ID is never handed out twice.
 */
export function nextRunId(data: StoreData, iso: string): string {
  const day = dayKey(iso);
  const prefix = `RUN-${day}-`;
  const used = [...data.runs.map((run) => run.id), ...data.activity.map((event) => event.runId ?? '')]
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)) || 0);
  const next = Math.max(data.lastRunNumber[day] ?? 0, ...used) + 1;
  data.lastRunNumber[day] = next;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

/** A run without its per-test results, for list responses, with outcome counts per folder instead. */
export function withoutTests(run: RunRecord): RunRecord {
  const copy = { ...run };
  delete copy.tests;
  if (run.tests?.length) {
    const features: Record<string, StatusCounts> = {};
    for (const test of run.tests) {
      const counts = (features[test.feature] ??= { passed: 0, failed: 0, flaky: 0, skipped: 0 });
      counts[test.status] += 1;
    }
    copy.features = features;
  }
  return copy;
}

export function addActivity(data: StoreData, event: Omit<ActivityEvent, 'id'>): void {
  data.activity.push({ id: randomUUID(), ...event });
  data.activity.sort((a, b) => a.time.localeCompare(b.time));
  if (data.activity.length > MAX_ACTIVITY) data.activity.splice(0, data.activity.length - MAX_ACTIVITY);
}

/** One-time import of the history file written by earlier dashboard versions. */
async function migrateLegacyHistory(): Promise<StoreData> {
  const data: StoreData = { version: 1, runs: [], activity: [], deletedStartTimes: [], lastRunNumber: {} };
  let legacy: LegacyHistoryEntry[] = [];
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(LEGACY_HISTORY_FILE, 'utf8'));
    if (Array.isArray(parsed)) legacy = parsed as LegacyHistoryEntry[];
  } catch {
    return data;
  }

  for (const entry of [...legacy].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    const script =
      entry.suite && entry.suite !== 'cli' ? (entry.suite === 'all' ? 'test' : `test:${entry.suite}`) : 'custom';
    const id = nextRunId(data, entry.startTime);
    data.runs.push({
      id,
      startTime: entry.startTime,
      duration: entry.duration,
      suite: script,
      suiteLabel: script === 'custom' ? 'Custom' : labelFromScript(script),
      trigger: entry.suite === 'cli' ? 'terminal' : 'dashboard',
      args: [],
      counts: entry.counts,
      total: entry.total,
      projects: [],
      tests: (entry.failures ?? []).map((failure) => ({
        title: failure.title,
        describe: failure.describe,
        feature: failure.feature,
        file: '',
        status: failure.status,
        duration: 0,
      })),
    });
    const finishedAt = new Date(new Date(entry.startTime).getTime() + entry.duration).toISOString();
    addActivity(data, {
      type: entry.counts.failed > 0 ? 'run.failed' : 'run.passed',
      time: finishedAt,
      title: `Run ${id} ${entry.counts.failed > 0 ? 'failed' : 'passed'}`,
      detail: `${entry.counts.passed + entry.counts.flaky}/${entry.total} passed`,
      runId: id,
    });
  }
  return data;
}

function normalize(parsed: Partial<StoreData>): StoreData {
  return {
    version: 1,
    runs: parsed.runs ?? [],
    activity: parsed.activity ?? [],
    deletedStartTimes: parsed.deletedStartTimes ?? [],
    lastRunNumber: parsed.lastRunNumber ?? {},
  };
}

async function readStoreFile(): Promise<StoreData> {
  try {
    return normalize(JSON.parse(await fs.readFile(STORE_FILE, 'utf8')) as Partial<StoreData>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const migrated = await migrateLegacyHistory();
    await writeStoreFile(migrated);
    return migrated;
  }
}

async function writeStoreFile(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${STORE_FILE}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
  await fs.rename(tempFile, STORE_FILE);
}

// Serialize every read-modify-write so concurrent requests never lose updates.
const globalStore = globalThis as typeof globalThis & { __qaStoreQueue?: Promise<unknown> };

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = (globalStore.__qaStoreQueue ?? Promise.resolve()).then(task, task);
  globalStore.__qaStoreQueue = run.catch(() => undefined);
  return run;
}

// ---- Cloud: the same document in Vercel Blob, written by GitHub Actions and by the hosted dashboard ----

const CLOUD_READ_TTL_MS = 5_000;
const CLOUD_WRITE_ATTEMPTS = 10;
/** After a conflict, wait before re-reading: the CDN may need a moment to serve the newer version. */
const CLOUD_RETRY_DELAY_MS = 1_000;

async function readCloudStore(): Promise<{ data: StoreData; etag: string | null }> {
  const document = await readJson<Partial<StoreData>>(BLOB_PATHS.store);
  return { data: normalize(document?.data ?? {}), etag: document?.etag ?? null };
}

// Polling clients share one recent read per server instance.
const cloudCache = cached(CLOUD_READ_TTL_MS, async () => (await readCloudStore()).data);

/** Read-modify-write with the blob's ETag: if another writer got in first, re-read and apply `mutate` again. */
async function updateCloudStore(mutate: (data: StoreData) => void): Promise<StoreData> {
  for (let attempt = 1; ; attempt += 1) {
    const { data, etag } = await readCloudStore();
    applyMutation(data, mutate);
    try {
      await writeJson(BLOB_PATHS.store, data, etag ?? undefined);
      cloudCache.set(data);
      return data;
    } catch (error) {
      if (!isConflict(error) || attempt >= CLOUD_WRITE_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, CLOUD_RETRY_DELAY_MS * Math.min(attempt, 5)));
    }
  }
}

function applyMutation(data: StoreData, mutate: (data: StoreData) => void): void {
  mutate(data);
  data.runs.sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (data.runs.length > MAX_RUNS) data.runs.splice(0, data.runs.length - MAX_RUNS);
}

export function readStore(): Promise<StoreData> {
  return CLOUD ? cloudCache.get() : enqueue(readStoreFile);
}

/** Applies `mutate` to the stored data and saves it atomically. */
export function updateStore(mutate: (data: StoreData) => void): Promise<StoreData> {
  return enqueue(async () => {
    if (CLOUD) return updateCloudStore(mutate);
    const data = await readStoreFile();
    applyMutation(data, mutate);
    await writeStoreFile(data);
    return data;
  });
}

/** Deletes runs by ID, remembering their start times so they are not recorded again. Returns the IDs removed. */
export async function removeRuns(ids: readonly string[]): Promise<string[]> {
  const wanted = new Set(ids);
  let removed: RunRecord[] = [];
  await updateStore((data) => {
    removed = data.runs.filter((run) => wanted.has(run.id));
    if (removed.length === 0) return;
    data.runs = data.runs.filter((run) => !wanted.has(run.id));
    markDeleted(
      data,
      removed.map((run) => run.startTime),
    );
    addActivity(data, {
      type: 'run.deleted',
      time: new Date().toISOString(),
      title: removed.length === 1 ? `Run ${removed[0]?.id} deleted` : `${removed.length} runs deleted`,
      ...(removed.length === 1 && removed[0]
        ? { runId: removed[0].id }
        : { detail: removed.map((run) => run.id).join(', ') }),
    });
  });
  return removed.map((run) => run.id);
}
