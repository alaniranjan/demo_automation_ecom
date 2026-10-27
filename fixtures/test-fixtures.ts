import { test as base, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { ProductListPage } from '../pages/ProductListPage';
import { SearchPage } from '../pages/SearchPage';
import { ProductDetailsPage } from '../pages/ProductDetailsPage';
import { LoginPage } from '../pages/LoginPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { AccountPage } from '../pages/AccountPage';
import { OrderConfirmationPage, OrderDetailsPage } from '../pages/OrderPages';
import { DefaultLocation, type DeliveryLocation } from '../test-data/customers';
import { Categories } from '../test-data/products';
import { annotateBrowserInfo } from '../utils/browser-info';
import { captureLiveFrames } from '../utils/live-preview';

interface PageFixtures {
  homePage: HomePage;
  productListPage: ProductListPage;
  searchPage: SearchPage;
  productDetailsPage: ProductDetailsPage;
  loginPage: LoginPage;
  checkoutPage: CheckoutPage;
  accountPage: AccountPage;
  orderConfirmationPage: OrderConfirmationPage;
  orderDetailsPage: OrderDetailsPage;
}

interface SessionFixtures {
  /**
   * Option: the delivery location saved in the browser before the page loads, so adding to the bag never stops for
   * the location dialog. Set to `null` with `test.use({ deliveryLocation: null })` to start as a first-time visitor.
   */
  deliveryLocation: DeliveryLocation | null;
  /** Opens the Men's listing and waits for the product grid. */
  menListingPage: ProductListPage;
  /** Automatic: streams page snapshots to the QA dashboard when LIVE_PREVIEW=1. */
  livePreview: void;
  /** Automatic: records the browser version (and device OS version) as test annotations for reports. */
  browserInfo: void;
}

export const test = base.extend<PageFixtures & SessionFixtures>({
  deliveryLocation: [DefaultLocation, { option: true }],

  // Every test gets a fresh context (empty guest bag); this seeds the saved location the store reads on load.
  context: async ({ context, deliveryLocation }, use) => {
    if (deliveryLocation) {
      await context.addInitScript(({ pincode, latitude, longitude }) => {
        try {
          window.localStorage.setItem('pincode', JSON.stringify(pincode));
          window.localStorage.setItem('lat', latitude);
          window.localStorage.setItem('lng', longitude);
        } catch {
          // Storage can be unavailable on error pages; the store then just asks for a location.
        }
      }, deliveryLocation);
    }
    await use(context);
  },

  livePreview: [
    async ({ page }, use, testInfo) => {
      await captureLiveFrames(page, testInfo, () => use());
    },
    { auto: true },
  ],
  browserInfo: [
    async ({ browser }, use, testInfo) => {
      annotateBrowserInfo(browser, testInfo);
      await use();
    },
    { auto: true },
  ],

  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  productListPage: async ({ page }, use) => {
    await use(new ProductListPage(page));
  },
  searchPage: async ({ page }, use) => {
    await use(new SearchPage(page));
  },
  productDetailsPage: async ({ page }, use) => {
    await use(new ProductDetailsPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  accountPage: async ({ page }, use) => {
    await use(new AccountPage(page));
  },
  orderConfirmationPage: async ({ page }, use) => {
    await use(new OrderConfirmationPage(page));
  },
  orderDetailsPage: async ({ page }, use) => {
    await use(new OrderDetailsPage(page));
  },

  menListingPage: async ({ productListPage }, use) => {
    await base.step(`Open the "${Categories.men.linkText}" listing`, async () => {
      await productListPage.goto(Categories.men);
      await productListPage.expectLoaded(Categories.men);
    });
    await use(productListPage);
  },
});

export { expect };
