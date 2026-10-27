import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import { ReferenceOrder } from '../../test-data/customers';
import { Products } from '../../test-data/products';
import { AUTH_FILE, hasSavedSession } from '../../utils/auth';
import { open } from '../../utils/hydration';
import { labelTest } from '../../utils/test-helpers';

// UI comparison of the signed-in pages. Uses the session from `npm run auth:login` and is skipped without one.
// Never places an order: the thank-you and order details pages are re-opened for an existing order
// (ReferenceOrder). Personal details (name, phone, email, address) are masked, so they never appear in baselines.

test.use({ storageState: hasSavedSession() ? AUTH_FILE : { cookies: [], origins: [] } });

/** The account menu's avatar initial and customer name (the two entries above "Orders"). */
function accountMenuIdentity(page: Page) {
  const orders = page.getByText(/^orders$/i).first();
  return [orders.locator('xpath=preceding::*[normalize-space()][1]'), orders.locator('xpath=preceding::*[normalize-space()][2]')];
}

/** Elements that show the customer's personal details or values that change between visits. */
function personalDetails(page: Page) {
  return [
    page.locator('input[name^="checkout-"]'),
    page.getByText(/@[\w.-]+\.\w+/),
    page.getByText(/\b[6-9]\d{9}\b/),
    page.getByText(/^Thank you /),
    page.getByText(/^Order At\s*:/),
    page.getByText(/^Delivery Date/),
  ];
}

test.describe('Account UI', { tag: '@visual' }, () => {
  test.skip(!hasSavedSession(), 'Sign in first with `npm run auth:login`');

  test.beforeEach(async () => {
    await labelTest({ feature: 'Visual', story: 'Account UI' });
  });

  test('VIS-13 Checkout page matches the approved design', async ({ productDetailsPage, checkoutPage, page }) => {
    const product = Products.muscleVest;

    await test.step('Put exactly one product in the bag', async () => {
      await productDetailsPage.goto(product);
      await productDetailsPage.expectLoaded(product);
      const cart = await productDetailsPage.openCart();
      await cart.removeAll();
      await cart.close();
      await productDetailsPage.addToBag();
      await productDetailsPage.expectCartCount(1);
    });

    await test.step('Open checkout (no order is placed)', async () => {
      await productDetailsPage.openCart();
      await productDetailsPage.cartDrawer.checkout();
      await checkoutPage.expectLoaded();
      await checkoutPage.waitForVouchers();
    });

    await test.step('Compare the checkout (contact and address fields masked)', async () => {
      await expect(page).toHaveScreenshot('checkout.png', {
        fullPage: true,
        mask: [...personalDetails(page), page.getByText(/perk progress/i).locator('xpath=..'), page.getByText(/available: .* points/i)],
      });
    });
  });

  test(`VIS-14 Thank-you page matches the approved design (order ${ReferenceOrder})`, async ({ orderConfirmationPage, page }) => {
    await test.step(`Re-open the thank-you page of ${ReferenceOrder}`, async () => {
      await open(page, `/order-confirmation?navigation=orders&order_code=${ReferenceOrder}`);
      await orderConfirmationPage.expectLoaded();
    });

    await test.step('Compare it (personal details masked, confetti hidden)', async () => {
      const address = page.getByText(/^address$/i).locator('xpath=following::*[normalize-space()][1]');
      await expect(page).toHaveScreenshot('thank-you.png', { fullPage: true, mask: [...personalDetails(page), address] });
    });
  });

  test(`VIS-15 Order details page matches the approved design (order ${ReferenceOrder})`, async ({
    accountPage,
    orderDetailsPage,
    page,
  }) => {
    await test.step(`Open ${ReferenceOrder} from My Orders`, async () => {
      await accountPage.gotoOrders();
      await accountPage.expectOrdersLoaded();
      await page.getByText(`#${ReferenceOrder}`, { exact: true }).click();
      await orderDetailsPage.expectLoaded(ReferenceOrder);
    });

    await test.step('Compare it (personal details masked)', async () => {
      await expect(page).toHaveScreenshot('order-details.png', {
        fullPage: true,
        mask: [
          ...personalDetails(page),
          orderDetailsPage.detail('Customer name'),
          orderDetailsPage.detail('Deliver to'),
          ...accountMenuIdentity(page),
        ],
      });
    });
  });

  test('VIS-16 My Account menu matches the approved design', async ({ accountPage, page }) => {
    // The smallest block holding every menu entry; the order list next to it changes with each order.
    const menu = page
      .locator('div')
      .filter({ hasText: /your favourite/i })
      .filter({ hasText: /suggest product/i })
      .filter({ hasNotText: /#ORD/ })
      .last();

    await accountPage.gotoOrders();
    await accountPage.expectOrdersLoaded();
    await expect(menu).toHaveScreenshot('account-menu.png', { mask: accountMenuIdentity(page) });
  });
});
