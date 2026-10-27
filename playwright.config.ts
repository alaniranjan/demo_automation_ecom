import fs from 'node:fs';
import os from 'node:os';
import dotenv from 'dotenv';
import { defineConfig, devices, type Project, type ReporterDescription } from '@playwright/test';
import { DEVICE_CATALOG, type DeviceCategory, deviceKey, osOf } from './utils/devices';
import { DEFAULT_RECORDING_RESOLUTION, RECORDING_SIZES, isRecordingResolution } from './utils/recording';
import { AUTH_FILE } from './utils/auth';

dotenv.config({ quiet: true });

const isCI = Boolean(process.env.CI);
const baseURL = process.env.BASE_URL ?? 'https://demo.honebi.online';
const crossBrowser = process.env.CROSS_BROWSER === 'true';
const allureResultsDir = 'allure-results';

// Failed tests keep their video and full-page screenshot at the chosen size; passed tests keep none.
// The browser viewport matches it, so frames are captured at native resolution rather than upscaled.
const requestedResolution = process.env.RECORDING_RESOLUTION;
if (requestedResolution && !isRecordingResolution(requestedResolution)) {
  throw new Error(`Unknown RECORDING_RESOLUTION "${requestedResolution}". Use: ${Object.keys(RECORDING_SIZES).join(', ')}`);
}
const { width, height } = RECORDING_SIZES[isRecordingResolution(requestedResolution) ? requestedResolution : DEFAULT_RECORDING_RESOLUTION];
const recordingSize = { width, height };

// Start every run with fresh Allure results so reports never mix stale runs.
// Runs only in the main process (workers set TEST_WORKER_INDEX); set KEEP_ALLURE_RESULTS=true to accumulate.
if (!process.env.TEST_WORKER_INDEX && process.env.KEEP_ALLURE_RESULTS !== 'true') {
  fs.rmSync(allureResultsDir, { recursive: true, force: true });
}

const reporters: ReporterDescription[] = [
  [isCI ? 'dot' : 'list'],
  ['html', { outputFolder: 'playwright-report', open: 'never' }],
  // Machine-readable results consumed by the Next.js dashboard (dashboard/).
  ['json', { outputFile: 'test-results/results.json' }],
  // Live progress (running tests, current step, URL) for the dashboard; also works for terminal runs.
  ['./reporters/live-reporter.ts', { outputFile: 'test-results/live.json' }],
  [
    'allure-playwright',
    {
      resultsDir: allureResultsDir,
      detail: true,
      suiteTitle: true,
      environmentInfo: {
        Application: baseURL,
        Node: process.version,
        OS: `${os.platform()} ${os.release()}`,
        CI: String(isCI),
      },
    },
  ],
];

if (isCI) {
  reporters.push(['junit', { outputFile: 'test-results/junit.xml' }]);
}

// Desktop browsers. Pick them with BROWSERS (comma-separated keys, or "all"), e.g.
// BROWSERS=chrome,firefox npm run test:smoke. The default is Google Chrome; CROSS_BROWSER=true means all three.
// BROWSERS="" runs no desktop browser (for device-only runs). Desktop presets set a 1280x720 viewport, so each
// project overrides it with the recording size.
const BROWSER_PROJECTS: Record<string, Project> = {
  chrome: {
    name: 'chrome',
    metadata: { kind: 'desktop', label: 'Chrome' },
    use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: recordingSize },
  },
  firefox: {
    name: 'firefox',
    metadata: { kind: 'desktop', label: 'Firefox' },
    use: { ...devices['Desktop Firefox'], viewport: recordingSize },
  },
  webkit: {
    name: 'webkit',
    metadata: { kind: 'desktop', label: 'WebKit' },
    use: { ...devices['Desktop Safari'], viewport: recordingSize },
  },
};

// Mobile and tablet emulation (utils/devices.ts). Pick devices with DEVICES (keys like "iphone-17-pro", or "all").
// Videos are recorded at twice the device's CSS size so they stay sharp on high-density screens.
const DEVICE_PROJECTS: Record<string, Project> = Object.fromEntries(
  (Object.entries(DEVICE_CATALOG) as [DeviceCategory, readonly string[]][]).flatMap(([category, names]) =>
    names.map((name) => {
      const descriptor = devices[name];
      if (!descriptor) throw new Error(`Playwright has no device descriptor named "${name}"`);
      const key = deviceKey(name);
      const os = osOf(category);
      const project: Project = {
        name: key,
        metadata: { kind: 'device', label: name, category, os },
        use: {
          ...descriptor,
          ...(os === 'Android' ? { channel: 'chrome' } : {}),
          // Recorded at the screen's own size: Playwright only scales frames down, so a larger size just pads them.
          video: { mode: 'retain-on-failure', size: descriptor.viewport },
        },
      };
      return [key, project];
    }),
  ),
);

function selectProjects(variable: string, value: string, available: Record<string, Project>): Project[] {
  const keys = value
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const selected = keys.includes('all') ? Object.keys(available) : keys;
  const unknown = selected.filter((key) => !available[key]);
  if (unknown.length > 0) {
    throw new Error(`Unknown value(s) in ${variable}: ${unknown.join(', ')}. Use: ${Object.keys(available).join(', ')}, all`);
  }
  return selected.map((key) => available[key]!);
}

// Signed-in tests (tests/account) use a real customer session and place a real order, so they never run with the
// normal suites. `npm run auth:login` (you type your mobile number and OTP in the opened browser) saves the session;
// `npm run test:order` then reuses it. Both set ACCOUNT_TESTS=true.
const accountTests = process.env.ACCOUNT_TESTS === 'true';
const ACCOUNT_PROJECTS: Project[] = [
  {
    name: 'account-login',
    testDir: './tests/account',
    testMatch: /.*\.setup\.ts/,
    retries: 0,
    metadata: { kind: 'desktop', label: 'Chrome (sign in)' },
    // Visible browser: the person signing in types the mobile number and OTP themselves.
    use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: recordingSize, headless: false },
  },
  {
    name: 'account',
    testDir: './tests/account',
    testMatch: /.*\.spec\.ts/,
    // Never retried: a retry after "Place order" would place a second real order.
    retries: 0,
    metadata: { kind: 'desktop', label: 'Chrome (signed in)' },
    use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: recordingSize, storageState: AUTH_FILE },
  },
];

// UI comparison (tests/visual): screenshots and ARIA snapshots compared with the approved baselines in
// visual-baselines/. Fixed 1920x1080 Chrome so baselines are comparable run to run. `npm run test:visual` compares;
// `npm run visual:update` approves the current UI as the new baseline. Both set VISUAL_TESTS=true.
const visualTests = process.env.VISUAL_TESTS === 'true';
const VISUAL_PROJECT: Project = {
  name: 'visual',
  testDir: './tests/visual',
  metadata: { kind: 'desktop', label: 'Chrome (UI comparison)' },
  // Only changed screens keep media: Playwright attaches baseline / actual / diff images, plus the run's video.
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    screenshot: 'off',
    video: { mode: 'retain-on-failure', size: { width: 1920, height: 1080 } },
  },
};

const projects = accountTests
  ? ACCOUNT_PROJECTS
  : visualTests
    ? [VISUAL_PROJECT]
    : [
      ...selectProjects('BROWSERS', process.env.BROWSERS ?? (crossBrowser ? 'chrome,firefox,webkit' : 'chrome'), BROWSER_PROJECTS),
      ...selectProjects('DEVICES', process.env.DEVICES ?? '', DEVICE_PROJECTS),
    ];
if (projects.length === 0) {
  throw new Error('Nothing to run: BROWSERS and DEVICES are both empty.');
}

export default defineConfig({
  testDir: './tests',
  testIgnore: [...(accountTests ? [] : ['**/account/**']), ...(visualTests ? [] : ['**/visual/**'])],
  // Approved UI baselines, one file per check (e.g. visual-baselines/home-header.png), committed to Git.
  snapshotPathTemplate: '{testDir}/../../visual-baselines/{arg}{ext}',
  outputDir: 'test-results/artifacts',
  fullyParallel: true,
  forbidOnly: isCI,
  // One local retry absorbs the live site's occasional slow response; retried passes are reported as "flaky".
  retries: isCI ? 2 : 1,
  // A shared live storefront: more than a few parallel browsers slows its catalog API enough to cause timeouts.
  workers: 2,
  // A live storefront with server-rendered pages and lazy-loaded catalog data, so budgets are wider than a static demo's.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // An absolute budget, not a ratio: a missing menu link is only ~300 pixels (0.2% of the header), which a
      // percentage would let through. 100 pixels still absorbs font anti-aliasing noise between runs.
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      stylePath: './tests/visual/capture.css',
    },
  },
  reporter: reporters,
  use: {
    baseURL,
    // The storefront marks key elements with stable `id`s (product-card, product-name, add-to-cart-button, ...),
    // so getByTestId() targets them.
    testIdAttribute: 'id',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    // Only failed tests keep media: the full video of the whole scenario and a full-page screenshot of the moment
    // it failed. Passed tests keep nothing. Add `--trace on` to record traces.
    screenshot: { mode: 'only-on-failure', fullPage: true },
    video: { mode: 'retain-on-failure', size: recordingSize },
    trace: 'off',
  },
  projects,
});
