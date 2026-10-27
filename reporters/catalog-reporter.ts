import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
import type { FullConfig, FullProject, Reporter, Suite } from '@playwright/test/reporter';
import { DEFAULT_RECORDING_RESOLUTION, RECORDING_SIZES } from '../utils/recording';

const ENGINES = { chromium, firefox, webkit };

/** Standard install locations of branded browsers that Playwright drives through a `channel`. */
const CHANNEL_PATHS: Record<string, Partial<Record<NodeJS.Platform, string[]>>> = {
  chrome: {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['/opt/google/chrome/chrome'],
    win32: [
      `${process.env['PROGRAMFILES'] ?? 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env['LOCALAPPDATA'] ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
    ],
  },
  msedge: {
    darwin: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    linux: ['/opt/microsoft/msedge/msedge'],
    win32: [`${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\Microsoft\\Edge\\Application\\msedge.exe`],
  },
};

function engineOf(project: FullProject): keyof typeof ENGINES {
  const name = project.use.browserName ?? project.use.defaultBrowserType ?? 'chromium';
  return name in ENGINES ? (name as keyof typeof ENGINES) : 'chromium';
}

function isInstalled(project: FullProject): boolean {
  const channel = project.use.channel;
  if (channel) return (CHANNEL_PATHS[channel]?.[process.platform] ?? []).some((file) => existsSync(file));
  try {
    return existsSync(ENGINES[engineOf(project)].executablePath());
  } catch {
    return false;
  }
}

/**
 * Prints the test catalog as JSON: every test with its file, describe path and tags, plus every configured
 * browser project (engine, channel, whether it is installed, base URL, retries). Used with
 * `BROWSERS=all DEVICES=all playwright test --list --reporter=<this file>` by the QA dashboard, so it never hard-codes
 * suites, tests, browsers or environments.
 */
export default class CatalogReporter implements Reporter {
  printsToStdio(): boolean {
    return true;
  }

  onBegin(config: FullConfig, suite: Suite): void {
    const catalog = {
      playwrightVersion: config.version,
      workers: config.workers,
      recordingSizes: Object.entries(RECORDING_SIZES).map(([key, size]) => ({ key, ...size })),
      defaultRecordingSize: DEFAULT_RECORDING_RESOLUTION,
      projects: config.projects.map((project) => ({
        name: project.name,
        baseURL: project.use.baseURL ?? null,
        browserName: engineOf(project),
        channel: project.use.channel ?? null,
        installed: isInstalled(project),
        kind: project.metadata['kind'] === 'device' ? 'device' : 'desktop',
        label: typeof project.metadata['label'] === 'string' ? project.metadata['label'] : project.name,
        category: project.metadata['category'] ?? null,
        os: project.metadata['os'] ?? null,
        viewport: project.use.viewport ?? null,
        deviceScaleFactor: project.use.deviceScaleFactor ?? 1,
        isMobile: project.use.isMobile ?? false,
        retries: project.retries,
        timeout: project.timeout,
      })),
      tests: suite.allTests().map((test) => ({
        file: path.relative(config.rootDir, test.location.file),
        line: test.location.line,
        title: test.title,
        describe: test.titlePath().slice(3, -1).join(' › '),
        project: test.parent.project()?.name ?? '',
        tags: test.tags,
      })),
    };
    process.stdout.write(JSON.stringify(catalog));
  }
}
