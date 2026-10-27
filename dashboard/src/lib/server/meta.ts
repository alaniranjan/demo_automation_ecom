import os from 'node:os';
import path from 'node:path';
import { projectNameFromUrl } from '../naming';
import type { Catalog, FrameworkMeta } from '../types';
import { CLOUD } from './cloud';
import { readFrameworkPackage, readPublishedFramework } from './framework';
import { githubConfigured, workflowUrl } from './github';
import { FRAMEWORK_DIR, STORE_FILE } from './paths';
import { MAX_RUNS } from './store';

function currentUser(): string {
  try {
    return os.userInfo().username;
  } catch {
    return process.env.USER ?? process.env.USERNAME ?? 'user';
  }
}

/** Everything the UI shows about the framework, read from package.json, Playwright config and the OS. */
export async function getMeta(catalog: Catalog | null): Promise<FrameworkMeta> {
  const pkg = await readFrameworkPackage();
  const baseURL = catalog?.projects.find((project) => project.baseURL)?.baseURL ?? null;
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    projectName: projectNameFromUrl(baseURL, pkg.name),
    baseURL,
    frameworkDir: CLOUD ? 'GitHub Actions' : FRAMEWORK_DIR,
    nodeVersion: process.version,
    user: CLOUD ? 'QA team' : currentUser(),
    storeFile: CLOUD ? 'Vercel Blob · data/store.json' : path.relative(FRAMEWORK_DIR, STORE_FILE),
    maxRuns: MAX_RUNS,
    mode: CLOUD ? 'cloud' : 'local',
    ciUrl: CLOUD ? workflowUrl() : null,
    canRun: CLOUD ? githubConfigured() : true,
    catalogPublishedAt: CLOUD ? ((await readPublishedFramework())?.publishedAt ?? null) : null,
  };
}
