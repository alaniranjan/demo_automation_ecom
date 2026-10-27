import fs from 'node:fs/promises';
import { BLOB_PATHS, CLOUD, cached, readJson } from './cloud';
import { FRAMEWORK_PACKAGE } from './paths';

export interface FrameworkPackage {
  name: string;
  version: string;
  description: string;
  scripts: Record<string, string>;
}

/** What GitHub Actions publishes about the framework for the hosted dashboard (data/framework.json). */
export interface PublishedFramework {
  package: FrameworkPackage;
  /** Output of `playwright test --list` with the catalog reporter (see catalog.ts). */
  listed: unknown;
  publishedAt: string;
}

const published = cached(60_000, async () => (await readJson<PublishedFramework>(BLOB_PATHS.framework))?.data ?? null);

export function readPublishedFramework(): Promise<PublishedFramework | null> {
  return published.get();
}

const EMPTY_PACKAGE: FrameworkPackage = { name: 'framework', version: '0.0.0', description: '', scripts: {} };

/** Reads the framework's package.json on every call, so edits to scripts show up without a restart. */
export async function readFrameworkPackage(): Promise<FrameworkPackage> {
  if (CLOUD) return (await readPublishedFramework())?.package ?? EMPTY_PACKAGE;
  return readLocalFrameworkPackage();
}

export async function readLocalFrameworkPackage(): Promise<FrameworkPackage> {
  try {
    const parsed = JSON.parse(await fs.readFile(FRAMEWORK_PACKAGE, 'utf8')) as Partial<FrameworkPackage>;
    return {
      name: parsed.name ?? 'framework',
      version: parsed.version ?? '0.0.0',
      description: parsed.description ?? '',
      scripts: parsed.scripts ?? {},
    };
  } catch {
    return EMPTY_PACKAGE;
  }
}
