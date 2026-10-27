import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import { Products, SearchTerms } from '../../test-data/products';
import { labelTest } from '../../utils/test-helpers';

// UI comparison of the guest storefront: each check compares a screen (or one part of it) with its approved
// baseline in visual-baselines/. Catalog content that changes by itself (product photos, names, prices, counts,
// delivery dates, the hero carousel) is masked, so only real UI changes - layout, styling, missing or renamed
// elements - fail a check. Approve an intended redesign with `npm run visual:update`.

/** Product data on listing and search grids: masked so catalog updates don't count as UI changes. */
function catalogContent(page: Page) {
  const cards = page.getByTestId('product-card');
  return [
    cards.locator('img'),
    cards.getByTestId('product-name'),
    cards.getByTestId('product-price'),
    cards.getByTestId('product-mrp'),
    cards.getByTestId('product-discount'),
    page.getByText(/^\d+ products?$/),
  ];
}

test.describe('Storefront UI', { tag: '@visual' }, () => {
  test.beforeEach(async () => {
    await labelTest({ feature: 'Visual', story: 'Storefront UI' });
  });

  test('VIS-01 Header bar matches the approved design', async ({ homePage, page }) => {
    const header = page.locator('[id^="headerRow-"]').filter({ has: page.locator('[id^="cart-placeholder-"]') }).first();

    await test.step('Open the home page', async () => {
      await homePage.goto();
      await homePage.expectLoaded();
    });

    await test.step('Compare the header (logo, menu links, search, wishlist, account, bag)', async () => {
      await expect(header).toHaveScreenshot('header.png');
    });

    await test.step('Compare the header menu names and icons', async () => {
      await expect(header).toMatchAriaSnapshot({ name: 'header.aria.yml' });
    });
  });

  test('VIS-02 Promo bar matches the approved design', async ({ homePage, page }) => {
    await homePage.goto();
    await homePage.expectLoaded();
    await expect(page.locator('[id^="headerRow-"]').first()).toHaveScreenshot('promo-bar.png');
  });

  test('VIS-03 Home page layout matches the approved design', async ({ homePage, page }) => {
    await test.step('Open the home page', async () => {
      await homePage.goto();
      await homePage.expectLoaded();
    });

    await test.step('Compare the first screen (hero slides masked)', async () => {
      await expect(page).toHaveScreenshot('home.png', { mask: [page.locator('.slick-slider img')] });
    });
  });

  test('VIS-04 Footer matches the approved design', async ({ homePage, page }) => {
    const footer = page.locator('#dynamicFooterContainer');

    await test.step('Open the home page', async () => {
      await homePage.goto();
      await homePage.expectLoaded();
    });

    await test.step('Compare the footer columns and links', async () => {
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toHaveScreenshot('footer.png');
      await expect(footer).toMatchAriaSnapshot({ name: 'footer.aria.yml' });
    });
  });

  test('VIS-05 Product listing page matches the approved design', async ({ menListingPage, page }) => {
    await test.step('Compare the listing (filter bar, sort, card layout; product data masked)', async () => {
      await expect(page).toHaveScreenshot('listing.png', { mask: catalogContent(page) });
      await expect(menListingPage.filterButton).toBeVisible();
    });
  });

  test('VIS-06 Search results page matches the approved design', async ({ searchPage, page }) => {
    await test.step(`Search "${SearchTerms.matching}"`, async () => {
      await searchPage.gotoQuery(SearchTerms.matching);
      await searchPage.expectResults();
    });

    await test.step('Compare the search page (search box, result grid; product data masked)', async () => {
      await expect(page).toHaveScreenshot('search.png', { mask: [...catalogContent(page), searchPage.resultPager] });
    });
  });

  test('VIS-07 Product page matches the approved design', async ({ productDetailsPage, page }) => {
    await test.step('Open the product page', async () => {
      await productDetailsPage.goto(Products.muscleVest);
      await productDetailsPage.expectLoaded(Products.muscleVest);
    });

    await test.step('Wait for the delivery details, which load after the page and push the layout down', async () => {
      await expect(page.getByText(/ships within/i)).toBeVisible({ timeout: 30_000 });
      await expect(productDetailsPage.deliveryDate).toBeVisible({ timeout: 30_000 });
    });

    await test.step('Compare the product page (stock and delivery date masked)', async () => {
      await expect(page).toHaveScreenshot('product.png', {
        mask: [productDetailsPage.deliveryDate, page.getByText(/only \d+ left/i), page.getByText(/ships within/i)],
      });
    });
  });

  test('VIS-08 Size guide matches the approved design', async ({ productDetailsPage }) => {
    await productDetailsPage.goto(Products.muscleVest);
    await productDetailsPage.expectLoaded(Products.muscleVest);
    await productDetailsPage.sizeGuideButton.click();
    await expect(productDetailsPage.sizeGuideDialog).toHaveScreenshot('size-guide.png');
  });

  test('VIS-09 Sign in dialog matches the approved design', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();
    await homePage.accountIcon.click();
    await homePage.signInDialog.expectOpen();
    await expect(homePage.signInDialog.root).toHaveScreenshot('sign-in-dialog.png');
    await expect(homePage.signInDialog.root).toMatchAriaSnapshot({ name: 'sign-in-dialog.aria.yml' });
  });

  test('VIS-10 Login page matches the approved design', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.expectLoaded();
    await expect(page).toHaveScreenshot('login.png');
  });

  test('VIS-11 Bag with one product matches the approved design', async ({ productDetailsPage }) => {
    await test.step('Add a product and open the bag', async () => {
      await productDetailsPage.goto(Products.muscleVest);
      await productDetailsPage.expectLoaded(Products.muscleVest);
      await productDetailsPage.addToBag();
      await productDetailsPage.expectCartCount(1);
    });

    await test.step('Compare the bag drawer (suggested products masked)', async () => {
      const cart = await productDetailsPage.openCart();
      await expect(cart.line(Products.muscleVest.name)).toBeVisible();
      await expect(cart.root).toHaveScreenshot('bag.png', {
        mask: [cart.root.getByRole('button', { name: '+ Add' }).locator('xpath=ancestor::div[.//img][1]')],
      });
    });
  });

  test('VIS-12 Empty bag matches the approved design', async ({ homePage }) => {
    await homePage.goto();
    await homePage.expectLoaded();
    const cart = await homePage.openCart();
    await cart.expectEmpty();
    await expect(cart.root).toHaveScreenshot('bag-empty.png');
  });
});
