import { execFile } from 'node:child_process';
import { featureFromFile, labelFromScript } from '../naming';
import type { Catalog, CatalogTest, ProjectInfo, RecordingSize, SpecFile, SuiteDefinition } from '../types';
import { CLOUD } from './cloud';
import { readFrameworkPackage, readPublishedFramework } from './framework';
import { CATALOG_REPORTER, FRAMEWORK_DIR } from './paths';

export interface ListedCatalog {
  playwrightVersion: string;
  workers: number;
  recordingSizes?: RecordingSize[];
  defaultRecordingSize?: string;
  projects: ProjectInfo[];
  tests: CatalogTest[];
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; value: Promise<ListedCatalog | null> } | null = null;

/**
 * Project that runs the framework's signed-in specs (tests/account). The framework only defines it when
 * ACCOUNT_TESTS=true, so normal runs and suites never include them; the dashboard lists them separately.
 */
export const ACCOUNT_PROJECT = 'account';

/** Project that runs the UI comparison (tests/visual); defined only when VISUAL_TESTS=true. */
export const VISUAL_PROJECT = 'visual';

/** Projects whose tests are listed for the dashboard but never part of an npm suite. */
const SEPARATE_PROJECTS = new Set([ACCOUNT_PROJECT, VISUAL_PROJECT]);

/** Lists every test, browser and device with `playwright test --list` in the local framework folder. */
export function listTestsLocally(extraEnv: Record<string, string> = {}): Promise<ListedCatalog | null> {
  return new Promise((resolve) => {
    execFile(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['playwright', 'test', '--list', `--reporter=${CATALOG_REPORTER}`],
      {
        cwd: FRAMEWORK_DIR,
        // BROWSERS=all DEVICES=all lists every browser and device the framework supports. Listing must not clear allure-results
        // (playwright.config.ts does that at the start of real runs).
        env: { ...process.env, BROWSERS: 'all', DEVICES: 'all', KEEP_ALLURE_RESULTS: 'true', FORCE_COLOR: '0', ...extraEnv },
        maxBuffer: 20 * 1024 * 1024,
        shell: process.platform === 'win32',
        timeout: 60_000,
      },
      (error, stdout) => {
        if (error) return resolve(null);
        try {
          resolve(JSON.parse(stdout) as ListedCatalog);
        } catch {
          resolve(null);
        }
      },
    );
  });
}

/**
 * The normal listing plus the signed-in specs (only their "account" project: the interactive sign-in setup needs
 * a person at the browser, so it is not offered as a spec file). Browser and device pickers keep the normal projects.
 */
async function listWithAccountTests(): Promise<ListedCatalog | null> {
  const [normal, account, visual] = await Promise.all([
    listTestsLocally(),
    listTestsLocally({ ACCOUNT_TESTS: 'true' }),
    listTestsLocally({ VISUAL_TESTS: 'true' }),
  ]);
  if (!normal) return null;
  const accountTests = account?.tests.filter((test) => test.project === ACCOUNT_PROJECT) ?? [];
  const visualTests = visual?.tests.filter((test) => test.project === VISUAL_PROJECT) ?? [];
  return { ...normal, tests: [...normal.tests, ...accountTests, ...visualTests] };
}

function getListedCatalog(): Promise<ListedCatalog | null> {
  if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
    // On Vercel, the listing published by GitHub Actions stands in for running Playwright. The workflow installs
    // whichever browsers a run needs, so every browser and device counts as installed whatever that runner had.
    const value = CLOUD
      ? readPublishedFramework().then((framework) => {
          const listed = (framework?.listed as ListedCatalog | undefined) ?? null;
          return listed && { ...listed, projects: listed.projects.map((project) => ({ ...project, installed: true })) };
        })
      : listWithAccountTests();
    cache = { at: Date.now(), value };
    // Don't keep a failed listing for a whole minute.
    void value.then((result) => {
      if (!result && cache?.value === value) cache = null;
    });
  }
  return cache.value;
}

/** Forces the next catalog read to list tests again (e.g. after a run touched the spec files). */
export function invalidateCatalog(): void {
  cache = null;
}

/**
 * A script counts as a runnable suite when it is `playwright test` optionally followed by a single
 * `--grep <pattern>`. Scripts with other flags (--headed, --debug, --ui, --project) are modes, not suites.
 */
export function parseSuiteScript(command: string): { grep: string | null } | null {
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] !== 'playwright' || tokens[1] !== 'test') return null;
  const rest = tokens.slice(2);
  if (rest.length === 0) return { grep: null };
  if (rest.length === 2 && (rest[0] === '--grep' || rest[0] === '-g')) {
    return { grep: rest[1]!.replace(/^['"]|['"]$/g, '') };
  }
  return null;
}

/** Arguments after `playwright test`, used to match a run back to the script that started it. */
export function scriptArgs(command: string): string[] {
  return command.trim().split(/\s+/).slice(2);
}

function matchesGrep(test: CatalogTest, grep: string | null): boolean {
  if (!grep) return true;
  try {
    return new RegExp(grep).test(`${test.project} ${test.file} ${test.describe} ${test.title} ${test.tags.join(' ')}`);
  } catch {
    return false;
  }
}

/** Suites (from package.json), spec files, projects and counts (from `playwright test --list`). */
export async function getCatalog(): Promise<Catalog | null> {
  const [pkg, listedAll] = await Promise.all([readFrameworkPackage(), getListedCatalog()]);
  if (!listedAll) return null;
  // Tests are listed once per browser; suites and files count each test once.
  const seen = new Set<string>();
  const uniqueTests = listedAll.tests.filter((test) => {
    const key = `${test.file}:${test.line}:${test.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const listed = { ...listedAll, tests: uniqueTests };

  const suites: SuiteDefinition[] = Object.entries(pkg.scripts)
    .filter(([script]) => script === 'test' || script.startsWith('test:'))
    .flatMap(([script, command]) => {
      const parsed = parseSuiteScript(command);
      if (!parsed) return [];
      return [
        {
          script,
          label: labelFromScript(script),
          command,
          grep: parsed.grep,
          // npm suites never include the signed-in or UI comparison specs.
          count: listed.tests.filter((test) => !SEPARATE_PROJECTS.has(test.project) && matchesGrep(test, parsed.grep)).length,
        },
      ];
    })
    // "All tests" first, then the rest by name.
    .sort((a, b) => (a.script === 'test' ? -1 : b.script === 'test' ? 1 : a.label.localeCompare(b.label)));

  const fileMap = new Map<string, SpecFile>();
  for (const test of listed.tests) {
    const entry = fileMap.get(test.file) ?? { file: test.file, feature: featureFromFile(test.file), tests: [] };
    entry.tests.push(test);
    fileMap.set(test.file, entry);
  }

  return {
    suites,
    files: [...fileMap.values()].sort((a, b) => a.file.localeCompare(b.file)),
    projects: listed.projects,
    recordingSizes: listed.recordingSizes ?? [],
    defaultRecordingSize: listed.defaultRecordingSize ?? '',
    workers: listed.workers,
    playwrightVersion: listed.playwrightVersion,
    total: listed.tests.length,
  };
}
