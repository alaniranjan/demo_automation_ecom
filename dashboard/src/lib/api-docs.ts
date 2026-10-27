/** Documentation for the dashboard's REST API, rendered on the API Documentation page. */

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  /** Path that the "Try it" button calls; only for read-only endpoints. */
  tryPath?: string;
  body?: string;
  responses: string[];
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/results',
    summary: 'Dashboard data',
    description:
      "Latest results from Playwright's JSON report, every stored run, the activity feed, report availability, the test catalog (suites from package.json, spec files and projects from `playwright test --list`) and framework metadata. Reading it also records any new run in the store.",
    tryPath: '/api/results',
    responses: ['200 ResultsPayload'],
  },
  {
    method: 'GET',
    path: '/api/run?offset={n}&runId={id}',
    summary: 'Live run state',
    description:
      'The dashboard runner state, console lines after `offset`, and live progress from test-results/live.json (running tests, current step and URL, counts). Terminal runs are detected here and given a run ID.',
    tryPath: '/api/run?offset=0&runId=-1',
    responses: ['200 RunStatePayload'],
  },
  {
    method: 'POST',
    path: '/api/run',
    summary: 'Start a run',
    description:
      "Starts an npm script discovered in the framework's package.json, or specific spec files listed by Playwright. Same-origin requests only. The Allure report is regenerated afterwards when an `allure:generate` script exists.",
    body: '{ "suite": "test:smoke", "browsers": ["chrome", "firefox"], "devices": ["iphone-17-pro", "pixel-10-pro"] }\n// or\n{ "files": ["auth/login.spec.ts"], "browsers": [], "devices": ["ipad-pro-11"], "size": "720p", "preview": true }',
    responses: [
      '202 RunState',
      '400 Unknown suite or file',
      '403 Cross-origin request',
      '409 A run is already in progress',
    ],
  },
  {
    method: 'POST',
    path: '/api/browsers/install',
    summary: 'Install a browser',
    description:
      'Downloads a Playwright browser engine (firefox, webkit) with `npx playwright install`; output streams to the run console. Google Chrome is installed from Google. Same-origin requests only.',
    body: '{ "browser": "firefox" }',
    responses: ['202 RunState', '400 Unknown or branded browser', '409 A run is already in progress'],
  },
  {
    method: 'DELETE',
    path: '/api/run',
    summary: 'Cancel the active run',
    description: 'Stops the dashboard-started run, including Playwright worker processes. Same-origin requests only.',
    responses: ['200 { "cancelled": true }', '409 No run in progress'],
  },
  {
    method: 'GET',
    path: '/api/runs',
    summary: 'Stored runs',
    description:
      'All runs in the backend store, newest first, without per-test results. Add `?download=1` to download the whole store as JSON.',
    tryPath: '/api/runs',
    responses: ['200 { runs: RunRecord[], total: number }'],
  },
  {
    method: 'GET',
    path: '/api/runs/{id}',
    summary: 'One run with test results',
    description:
      'A stored run including every test outcome, duration, first error line and archived screenshots, videos and traces. Add `?download=1` to download it.',
    responses: ['200 RunRecord', '404 Run not found'],
  },
  {
    method: 'DELETE',
    path: '/api/runs/{id}',
    summary: 'Delete one run',
    description:
      'Deletes a stored run, its archived screenshots and videos, and its Allure report. Same-origin requests only.',
    responses: ['200 { "deleted": id }', '404 Run not found'],
  },
  {
    method: 'DELETE',
    path: '/api/run-reports',
    summary: "Delete runs' Allure reports",
    description:
      'Body `{ "ids": [...] }`. Deletes only the reports; the runs, results and media stay. Same-origin requests only.',
    responses: ['200 { deleted: string[] }', '400 ids is not a list of run IDs'],
  },
  {
    method: 'GET',
    path: '/api/runs/{id}/report/',
    summary: "One run's Allure report",
    description:
      'The Allure report generated for this run when it finished (passed or failed), kept for the last 20 runs. `RunRecord.report` says whether it exists.',
    responses: ['200 HTML report', '404 Not found'],
  },
  {
    method: 'DELETE',
    path: '/api/runs',
    summary: 'Delete runs or clear history',
    description:
      'With body `{ "ids": [...] }`, deletes those runs with their screenshots, videos and Allure reports. Without a body, clears all run history, activity, media and reports. Same-origin requests only.',
    responses: ['200 { deleted: string[] } or { removed: number }', '400 ids is not a list of run IDs'],
  },
  {
    method: 'GET',
    path: '/api/artifacts?path={path}',
    summary: 'Test attachment',
    description:
      'Serves a screenshot, video, trace or other attachment from test-results/ (latest run) or .dashboard/artifacts/ (archived runs). Other paths return 404.',
    responses: ['200 file', '404 Not found'],
  },
  {
    method: 'DELETE',
    path: '/api/artifacts',
    summary: 'Delete artifacts',
    description:
      'Deletes screenshots, videos or traces from test-results/ or .dashboard/artifacts/ and removes them from stored runs; test results are kept. Same-origin requests only.',
    body: '{ "paths": [".dashboard/artifacts/RUN-20261020-012/001-.../2-video.webm"] }',
    responses: ['200 { "deleted": number }', '400 Path outside the artifact folders', '403 Cross-origin request'],
  },
  {
    method: 'GET',
    path: '/api/reports/{allure|playwright}/{file}',
    summary: 'Generated HTML reports',
    description: 'Serves the Allure report and the Playwright HTML report generated by the latest run.',
    responses: ['200 file', '307 Redirect to index.html', '404 Not found'],
  },
  {
    method: 'GET',
    path: '/api/health',
    summary: 'Backend health',
    description:
      'Liveness check used by the "Backend Online" indicator: server time, uptime and whether the runner is busy.',
    tryPath: '/api/health',
    responses: ['200 { status, time, startedAt, uptimeSeconds, runnerBusy }'],
  },
];
