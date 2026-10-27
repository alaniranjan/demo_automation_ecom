import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';

/** Folder the QA dashboard reads live frames from (one JPEG per parallel worker slot). */
export const LIVE_FRAMES_DIR = path.resolve(__dirname, '..', 'test-results', 'live-frames');

const FRAMES_PER_SECOND = 3;
const FRAME_QUALITY = 60;

/**
 * While the test runs, streams the page as JPEG frames (Playwright's screencast) to a file per worker slot,
 * so the dashboard can show the browser live. Only active when LIVE_PREVIEW=1. Frames arrive through one
 * screencast, not repeated screenshots, so they don't add steps to the test or its reports. Never fails a test.
 */
export async function captureLiveFrames(page: Page, testInfo: TestInfo, run: () => Promise<void>): Promise<void> {
  if (process.env.LIVE_PREVIEW !== '1') {
    await run();
    return;
  }

  await fs.mkdir(LIVE_FRAMES_DIR, { recursive: true });
  const file = path.join(LIVE_FRAMES_DIR, `${testInfo.parallelIndex}.jpg`);
  const tempFile = `${file}.${process.pid}.tmp`;
  let writing = false;
  // The worker slot is reused by every test it runs; drop the previous test's last frame.
  await fs.rm(file, { force: true });

  // Frames at up to 2x the CSS size, so high-density phone screens stay sharp in the device frame.
  const scale = Math.min(2, testInfo.project.use.deviceScaleFactor ?? 1);
  const cssViewport = page.viewportSize();
  const viewport = cssViewport && { width: Math.round(cssViewport.width * scale), height: Math.round(cssViewport.height * scale) };
  let screencast: Awaited<ReturnType<Page['screencast']['start']>> | null = null;
  try {
    screencast = await page.screencast.start({
      fps: FRAMES_PER_SECOND,
      quality: FRAME_QUALITY,
      ...(viewport ? { size: viewport } : {}),
      onFrame: async ({ data }) => {
        // Drop frames while the previous one is still being written.
        if (writing) return;
        writing = true;
        try {
          await fs.writeFile(tempFile, data);
          await fs.rename(tempFile, file);
        } catch {
          // Folder cleared by a new run, or disk busy; the next frame tries again.
        } finally {
          writing = false;
        }
      },
    });
  } catch {
    // Screencast unavailable in this browser; the test still runs, just without a preview.
  }

  try {
    await run();
  } finally {
    await screencast?.dispose().catch(() => {
      // Page already closed.
    });
  }
}
