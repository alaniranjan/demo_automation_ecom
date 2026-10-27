import { test, expect } from '../../fixtures/test-fixtures';
import { labelTest } from '../../utils/test-helpers';

test.describe('Product filters', { tag: '@regression' }, () => {
  test.beforeEach(async () => {
    await labelTest({ feature: 'Products', story: 'Filters' });
  });

  test('FILT-01 Opens the filter panel with size and price groups', async ({ menListingPage }) => {
    await test.step('Open filters', async () => {
      await menListingPage.openFilters();
    });

    await test.step('Verify the groups and actions', async () => {
      await expect(menListingPage.filterPanel.getByText(/^size$/i)).toBeVisible();
      await expect(menListingPage.filterPanel.getByText(/^price$/i)).toBeVisible();
      for (const size of ['S', 'M', 'L', 'XL']) {
        await expect(menListingPage.sizeFilter(size)).toBeVisible();
      }
      await expect(menListingPage.applyFiltersButton).toBeVisible();
      await expect(menListingPage.clearFiltersButton).toBeVisible();
    });
  });

  test('FILT-02 Narrows the listing by size', async ({ menListingPage }) => {
    const before = await menListingPage.readProductCount();

    await test.step('Filter by size XL', async () => {
      await menListingPage.filterBySize('XL');
    });

    await test.step('Verify fewer (but some) products are listed', async () => {
      await expect(menListingPage.productCount).not.toHaveText(`${before} products`);
      const after = await menListingPage.readProductCount();
      expect(after).toBeGreaterThan(0);
      expect(after).toBeLessThan(before);
      await expect(menListingPage.productCards.first()).toBeVisible();
    });
  });

  test('FILT-03 Clears the size filter', async ({ menListingPage, page }) => {
    const before = await menListingPage.readProductCount();

    await test.step('Apply a size filter', async () => {
      await menListingPage.filterBySize('XL');
      await expect(menListingPage.productCount).not.toHaveText(`${before} products`);
    });

    await test.step('Clear all filters', async () => {
      await menListingPage.openFilters();
      await menListingPage.clearFiltersButton.click();
    });

    await test.step('Verify the full listing is back', async () => {
      await expect(page).not.toHaveURL(/[?&]o=Size/);
      await expect(menListingPage.productCount).toHaveText(`${before} products`);
    });
  });
});
