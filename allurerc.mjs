import { defineConfig } from 'allure';

/** Allure 3 report configuration, picked up automatically by `allure generate` and `allure open`. */
export default defineConfig({
  name: 'Demo Store E2E Report',
  output: './allure-report',
  plugins: {
    awesome: {
      options: {
        reportName: 'Demo Store E2E Report',
        // Tree view: Feature > Story > test (labels set by labelTest() in utils/test-helpers.ts).
        groupBy: ['feature', 'story'],
        // One self-contained HTML file; the CI publish step sets this so a report is a single upload.
        singleFile: process.env.ALLURE_SINGLE_FILE === '1',
      },
    },
  },
});
