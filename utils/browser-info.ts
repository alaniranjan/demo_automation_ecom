import type { Browser, TestInfo } from '@playwright/test';

/** Annotation types the QA dashboard reads from the JSON report to show what each run ran on. */
export const BROWSER_VERSION_ANNOTATION = 'browser-version';
export const OS_VERSION_ANNOTATION = 'os-version';

/** "iOS 18.5" or "Android 14" from an emulated device's user agent; undefined for desktop browsers. */
export function osVersionFromUserAgent(userAgent: string | undefined): string | undefined {
  const ios = userAgent?.match(/(?:iPhone|CPU) OS (\d+)_(\d+)/);
  if (ios) return `${userAgent?.includes('iPad') ? 'iPadOS' : 'iOS'} ${ios[1]}.${ios[2]}`;
  const android = userAgent?.match(/Android (\d+(?:\.\d+)?)/);
  return android ? `Android ${android[1]}` : undefined;
}

/** Tags the test with the browser's real version (and the emulated OS version on devices). Never fails a test. */
export function annotateBrowserInfo(browser: Browser, testInfo: TestInfo): void {
  testInfo.annotations.push({ type: BROWSER_VERSION_ANNOTATION, description: browser.version() });
  const os = osVersionFromUserAgent(testInfo.project.use.userAgent);
  if (os) testInfo.annotations.push({ type: OS_VERSION_ANNOTATION, description: os });
}
