import { Severity, severity } from 'allure-js-commons';
import { test, expect } from '../../fixtures/test-fixtures';
import { Products } from '../../test-data/products';
import { open } from '../../utils/hydration';
import { labelTest } from '../../utils/test-helpers';

test.describe('Guest access', { tag: '@regression' }, () => {
  test.beforeEach(async () => {
    await labelTest({ feature: 'Authentication', story: 'Guest restrictions' });
  });

  test('GUEST-01 Asks a guest to sign in before saving to the wishlist', async ({ productDetailsPage }) => {
    await test.step('Open a product as a guest', async () => {
      await productDetailsPage.goto(Products.muscleVest);
      await productDetailsPage.expectLoaded(Products.muscleVest);
    });

    await test.step('Click the wishlist heart', async () => {
      await productDetailsPage.wishlistButton.click();
    });

    await test.step('Verify the sign in dialog appears', async () => {
      await productDetailsPage.signInDialog.expectOpen();
    });
  });

  test('GUEST-02 Sends a guest to sign in at checkout', { tag: '@smoke' }, async ({ productDetailsPage, loginPage }) => {
    await severity(Severity.CRITICAL);

    await test.step('Add a product to the bag', async () => {
      await productDetailsPage.goto(Products.muscleVest);
      await productDetailsPage.expectLoaded(Products.muscleVest);
      await productDetailsPage.addToBag();
      await productDetailsPage.expectCartCount(1);
    });

    await test.step('Checkout from the bag', async () => {
      const cart = await productDetailsPage.openCart();
      await cart.checkout();
    });

    await test.step('Verify the login page is shown', async () => {
      await loginPage.expectLoaded();
    });
  });

  test('GUEST-03 Shows the wishlist page with an empty default collection', async ({ page }) => {
    await test.step('Open the wishlist', async () => {
      await open(page, '/wishlist');
    });

    await test.step('Verify the empty collection', async () => {
      await expect(page.getByText(/^wishlist$/i)).toBeVisible();
      await expect(page.getByText('0 items Saved').first()).toBeVisible();
    });
  });

  test('GUEST-04 Header wishlist icon asks a guest to sign in', async ({ homePage }) => {
    await test.step('Click the header heart icon', async () => {
      await homePage.goto();
      await homePage.expectLoaded();
      await homePage.wishlistIcon.click();
    });

    await test.step('Verify the sign in dialog appears', async () => {
      await homePage.signInDialog.expectOpen();
    });
  });

  test('GUEST-05 Product card heart asks a guest to sign in', async ({ menListingPage }) => {
    await test.step('Click the heart on the first product card', async () => {
      // The heart sits in a pointer-events:none overlay; the click reaches it like a user's tap does.
      await menListingPage.cardWishlist(menListingPage.card(0)).click({ force: true });
    });

    await test.step('Verify the sign in dialog appears', async () => {
      await menListingPage.signInDialog.expectOpen();
    });
  });

  test('GUEST-06 "Buy now" asks a guest to sign in and leaves the bag empty', async ({ productDetailsPage }) => {
    await test.step('Click "Buy now"', async () => {
      await productDetailsPage.goto(Products.muscleVest);
      await productDetailsPage.expectLoaded(Products.muscleVest);
      await productDetailsPage.buyNowButton.click();
    });

    await test.step('Verify the sign in dialog and an unchanged bag', async () => {
      await productDetailsPage.signInDialog.expectOpen();
      await productDetailsPage.expectCartCount(0);
    });
  });
});
