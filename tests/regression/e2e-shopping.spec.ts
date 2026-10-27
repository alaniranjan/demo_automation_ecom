import { Severity } from 'allure-js-commons';
import { test, expect } from '../../fixtures/test-fixtures';
import { Categories, SearchTerms, SortOption } from '../../test-data/products';
import { cartTotal, labelTest } from '../../utils/test-helpers';

// Checkout needs a signed-in account (mobile number + OTP), so the guest journey ends at the sign-in gate:
// no OTP is requested and no order is placed.
test.describe('End-to-end shopping', { tag: ['@regression', '@e2e'] }, () => {
  test(
    'E2E-01 Guest browses, fills the bag and reaches the checkout sign in',
    { tag: '@smoke' },
    async ({ homePage, productListPage, productDetailsPage, searchPage, loginPage }) => {
      await labelTest({ feature: 'Business workflow', story: 'Shopping journey', severity: Severity.BLOCKER });
      const chosen: string[] = [];

      await test.step('1. Open the store', async () => {
        await homePage.goto();
        await homePage.expectLoaded();
        await homePage.expectCartCount(0);
      });

      await test.step(`2. Browse the "${Categories.men.linkText}" listing`, async () => {
        await productListPage.goto(Categories.men);
        await productListPage.expectLoaded(Categories.men);
      });

      await test.step(`3. Sort by "${SortOption.PriceLowToHigh.label}"`, async () => {
        await productListPage.sortBy(SortOption.PriceLowToHigh);
        await productListPage.expectSortedByMrp('asc');
      });

      await test.step('4. Open the first product', async () => {
        const card = productListPage.card(0);
        chosen.push((await productListPage.readCard(card)).name);
        await productListPage.openProduct(card);
        await productDetailsPage.expectLoaded();
        await expect(productDetailsPage.productName).toHaveText(chosen[0]!);
      });

      await test.step('5. Choose a size and add it to the bag', async () => {
        await productDetailsPage.sizeOptions.first().click();
        await productDetailsPage.addToBag();
        await productDetailsPage.expectAddedToBag();
        await productDetailsPage.expectCartCount(1);
      });

      await test.step(`6. Search for "${SearchTerms.matching}"`, async () => {
        await productDetailsPage.openSearch();
        await searchPage.search(SearchTerms.matching);
        await searchPage.expectResults();
      });

      await test.step('7. Add the first result from the grid', async () => {
        const card = searchPage.card(0);
        chosen.push((await searchPage.readCard(card)).name);
        await searchPage.quickAdd(card);
        await searchPage.expectCartCount(2);
      });

      await test.step('8. Verify the bag contents and total', async () => {
        const cart = await searchPage.openCart();
        await cart.expectItemCount(2);
        const lines = await cart.readLines();
        expect(lines.map((line) => line.name).sort()).toEqual([...chosen].sort());
        expect(lines.every((line) => line.quantity === 1)).toBe(true);
        expect(await cart.readEstimatedTotal()).toBeCloseTo(cartTotal(lines), 2);
      });

      await test.step('9. Proceed to checkout', async () => {
        await searchPage.cartDrawer.checkout();
      });

      await test.step('10. Verify checkout asks the guest to sign in', async () => {
        await loginPage.expectLoaded();
      });
    },
  );
});
