import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The store is server-rendered (Next.js): pages are visible about a second before React attaches event handlers,
 * and clicks in that window are silently lost. React tags each hydrated element with a `__reactProps$<id>` key,
 * so waiting for it on a key control is a precise "page is interactive" signal, with no fixed sleeps.
 */
export async function waitForInteractive(locator: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        locator
          .first()
          .evaluate((element) => Object.keys(element).some((key) => key.startsWith('__reactProps$')))
          .catch(() => false),
      { message: 'page did not become interactive (React hydration)', timeout: 30_000 },
    )
    .toBe(true);
}

/**
 * After hydration the store creates the guest bag (POST /cart/guest-one-cart) and saves it as `guest_cart` in
 * localStorage. Add-to-bag clicks before that are dropped without any request, so cart actions wait for it.
 */
export async function waitForGuestCart(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.localStorage.getItem('guest_cart')), null, { timeout: 30_000 });
}

/**
 * Clicks a cart button and waits for the store's `cart/update` request. On a busy server the page can take 20s+ to
 * become interactive and drops earlier clicks without sending anything, so the click is repeated only while no
 * request went out. A click that registered always sends one, so this can never add twice.
 */
export async function clickUntilCartUpdates(page: Page, button: Locator): Promise<void> {
  await expect(async () => {
    const request = page.waitForRequest(/\/cart\/update/, { timeout: 5_000 });
    await button.click({ timeout: 5_000 });
    await request;
  }).toPass({ timeout: 60_000, intervals: [500, 1_000] });
}

/**
 * Navigates without waiting for the `load` event: the store's fonts and full-size images can keep `load` pending for
 * a long time on a busy server. Callers then wait for the element they need (usually via waitForInteractive).
 */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}
