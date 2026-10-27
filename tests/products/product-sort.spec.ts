import { test, expect } from '../../fixtures/test-fixtures';
import { Categories, SortOption } from '../../test-data/products';
import { labelTest } from '../../utils/test-helpers';

// The store orders "Price" sorts by MRP (the struck-through list price). Sale prices can be out of order when
// discounts differ, so the MRP column is the one asserted.
const priceSorts = [
  { option: SortOption.PriceLowToHigh, direction: 'asc' },
  { option: SortOption.PriceHighToLow, direction: 'desc' },
] as const;

const sortedUrl = `${Categories.men.path}&sort=${SortOption.PriceLowToHigh.value}`;

test.describe('Product sorting', { tag: '@regression' }, () => {
  test.beforeEach(async () => {
    await labelTest({ feature: 'Products', story: 'Sorting' });
  });

  for (const [index, { option, direction }] of priceSorts.entries()) {
    test(`SORT-0${index + 1} Sorts products by "${option.label}"`, async ({ menListingPage }) => {
      await test.step(`Select "${option.label}"`, async () => {
        await menListingPage.sortBy(option);
        await expect(menListingPage.sortDropdown).toHaveValue(option.value);
      });

      await test.step(`Verify MRPs are in ${direction === 'asc' ? 'ascending' : 'descending'} order`, async () => {
        await menListingPage.expectSortedByMrp(direction);
      });
    });
  }

  test('SORT-03 Keeps the product count when the sort changes', async ({ menListingPage }) => {
    const before = await menListingPage.readProductCount();

    await test.step(`Sort by "${SortOption.Newest.label}"`, async () => {
      await menListingPage.sortBy(SortOption.Newest);
    });

    await test.step('Verify the same number of products is listed', async () => {
      expect(await menListingPage.readProductCount()).toBe(before);
    });
  });

  test('SORT-04 Applies the sort from a shared URL', async ({ productListPage, page }) => {
    await test.step(`Open ${sortedUrl}`, async () => {
      await page.goto(sortedUrl, { waitUntil: 'domcontentloaded' });
      await productListPage.expectLoaded(Categories.men);
    });

    await test.step('Verify the products are in ascending MRP order', async () => {
      await productListPage.expectSortedByMrp('asc');
    });
  });

  test('SORT-05 Shows the URL sort in the dropdown', async ({ productListPage, page }) => {
    // Known defect (found 2026-10-27): the grid is sorted, but the dropdown still reads "Featured". test.fail()
    // keeps the suite green while the bug exists and turns red as soon as it is fixed, so it can be removed then.
    test.fail(true, 'Known defect: the Sort dropdown ignores the ?sort= URL parameter and shows "Featured"');
    test.info().annotations.push({ type: 'issue', description: 'Sort dropdown does not reflect ?sort= in the URL' });

    await test.step(`Open ${sortedUrl}`, async () => {
      await page.goto(sortedUrl, { waitUntil: 'domcontentloaded' });
      await productListPage.expectLoaded(Categories.men);
    });

    await test.step(`Verify the dropdown shows "${SortOption.PriceLowToHigh.label}"`, async () => {
      await expect(productListPage.sortDropdown).toHaveValue(SortOption.PriceLowToHigh.value, { timeout: 5_000 });
    });
  });
});
