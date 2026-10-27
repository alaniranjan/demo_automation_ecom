import { Severity, severity } from 'allure-js-commons';
import { test, expect } from '../../fixtures/test-fixtures';
import { Categories, SubCategories } from '../../test-data/products';
import { labelTest } from '../../utils/test-helpers';

test.describe('Home page', { tag: '@regression' }, () => {
  test.beforeEach(async ({ homePage }) => {
    await labelTest({ feature: 'Home', story: 'Landing page' });
    await homePage.goto();
  });

  test('HOME-01 Loads with header, hero and an empty bag', { tag: '@smoke' }, async ({ homePage }) => {
    await severity(Severity.BLOCKER);

    await test.step('Verify the page and header', async () => {
      await homePage.expectLoaded();
      for (const icon of [homePage.searchIcon, homePage.wishlistIcon, homePage.accountIcon, homePage.cartIcon]) {
        await expect(icon).toBeVisible();
      }
      await homePage.expectCartCount(0);
    });

    await test.step('Verify the hero carousel', async () => {
      await expect(homePage.heroSlides.first()).toBeVisible();
    });
  });

  test('HOME-02 Shows the featured product sections', async ({ homePage }) => {
    await test.step('Verify each featured section has products', async () => {
      for (const title of ["Men's Apparel", "Women's Apparel", 'Sarees', 'Kids', 'Accessories']) {
        await expect(homePage.section(title)).toBeVisible();
      }
      // Section carousels fill in lazily after their titles render.
      await expect.poll(() => homePage.productCards.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
    });
  });

  for (const [index, category] of [Categories.men, Categories.women, Categories.kids].entries()) {
    test(`HOME-0${index + 3} Header link "${category.linkText}" opens its collection`, async ({ homePage, page }) => {
      await test.step(`Click "${category.linkText}"`, async () => {
        await homePage.navLink(category.linkText).click();
      });

      await test.step('Verify a collection page opens', async () => {
        await expect(page).not.toHaveURL(/\/$/);
        await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 30_000 });
      });
    });
  }

  test('HOME-06 Footer category link opens the listing', async ({ homePage, productListPage }) => {
    await test.step(`Click the footer "${Categories.accessories.linkText}" link`, async () => {
      await homePage.footerLink(Categories.accessories.linkText).click();
    });

    await test.step('Verify the accessories listing', async () => {
      await productListPage.expectLoaded(Categories.accessories);
    });
  });

  test('HOME-07 Logo returns to the home page', async ({ homePage, productListPage }) => {
    await test.step('Navigate away to a listing', async () => {
      await productListPage.goto(Categories.men);
      await productListPage.expectLoaded(Categories.men);
    });

    await test.step('Click the logo', async () => {
      await productListPage.goHome();
      await homePage.expectLoaded();
    });
  });

  test('HOME-08 Footer lists the store policies', async ({ homePage, page }) => {
    await test.step('Verify each policy link and the copyright', async () => {
      for (const [name, path] of [
        ['Terms of Service', '/terms-of-service'],
        ['Shipping Policy', '/shipping-policy'],
        ['Replacement Policy', '/replacement-policy'],
        ['Privacy Policy', '/privacy-policy'],
        ['Cookie Policy', '/cookie-policy'],
      ] as const) {
        await expect(homePage.footerLink(name)).toHaveAttribute('href', path);
      }
      await expect(homePage.copyright).toBeVisible();
    });

    await test.step('Open a policy page', async () => {
      await homePage.footerLink('Shipping Policy').click();
      await expect(page).toHaveURL(/\/shipping-policy$/);
    });
  });

  test('HOME-09 Footer sub-collection link opens its listing', async ({ homePage, productListPage, page }) => {
    await test.step(`Click the footer "${SubCategories.womenSarees.linkText}" link`, async () => {
      await homePage.footerLink(SubCategories.womenSarees.linkText).click();
    });

    await test.step('Verify the sarees listing under Womens', async () => {
      await expect(page).toHaveURL(/women's-sarees/);
      await productListPage.expectLoaded(SubCategories.womenSarees);
    });
  });
});
