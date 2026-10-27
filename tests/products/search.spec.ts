import { Severity, severity } from 'allure-js-commons';
import { test, expect } from '../../fixtures/test-fixtures';
import { SearchTerms } from '../../test-data/products';
import { labelTest } from '../../utils/test-helpers';

test.describe('Search', { tag: '@regression' }, () => {
  test.beforeEach(async () => {
    await labelTest({ feature: 'Products', story: 'Search' });
  });

  test('SRCH-01 Finds products from the header search', { tag: '@smoke' }, async ({ homePage, searchPage }) => {
    await severity(Severity.CRITICAL);

    await test.step('Open search from the header', async () => {
      await homePage.goto();
      await homePage.expectLoaded();
      await homePage.openSearch();
    });

    await test.step(`Search for "${SearchTerms.matching}"`, async () => {
      await searchPage.search(SearchTerms.matching);
      await searchPage.expectResults();
    });

    await test.step('Verify every result matches the term', async () => {
      const names = await searchPage.productNames.allInnerTexts();
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(name.toLowerCase(), name).toContain(SearchTerms.matching);
      }
    });
  });

  test('SRCH-02 Keeps the term in the search box', async ({ searchPage }) => {
    await test.step('Open a search URL', async () => {
      await searchPage.gotoQuery(SearchTerms.matching);
      await searchPage.expectResults();
    });

    await test.step('Verify the input shows the query', async () => {
      await expect(searchPage.searchInput).toHaveValue(SearchTerms.matching);
    });
  });

  test('SRCH-03 Shows no products for an unknown term', async ({ searchPage }) => {
    await test.step(`Search for "${SearchTerms.noResults}"`, async () => {
      await searchPage.gotoQuery(SearchTerms.noResults);
      await expect(searchPage.searchInput).toHaveValue(SearchTerms.noResults);
    });

    await test.step('Verify the result grid is empty', async () => {
      await expect(searchPage.page.getByText('0/0', { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(searchPage.productCards).toHaveCount(0);
    });
  });

  test('SRCH-04 Ignores letter case', async ({ searchPage }) => {
    let lowerCaseNames: string[] = [];

    await test.step(`Search "${SearchTerms.matching}"`, async () => {
      await searchPage.gotoQuery(SearchTerms.matching);
      await searchPage.expectResults();
      lowerCaseNames = await searchPage.productNames.allInnerTexts();
    });

    await test.step(`Search "${SearchTerms.matchingUpperCase}"`, async () => {
      await searchPage.gotoQuery(SearchTerms.matchingUpperCase);
      await searchPage.expectResults();
    });

    await test.step('Verify the same products are found', async () => {
      await expect(searchPage.productNames).toHaveText(lowerCaseNames);
    });
  });

  test('SRCH-05 Shows how many result pages are loaded', async ({ searchPage }) => {
    await test.step(`Search "${SearchTerms.matching}"`, async () => {
      await searchPage.gotoQuery(SearchTerms.matching);
      await searchPage.expectResults();
    });

    await test.step('Verify the "loaded/total" counter is consistent', async () => {
      const [loaded, total] = (await searchPage.resultPager.innerText()).split('/').map(Number);
      expect(loaded).toBeGreaterThan(0);
      expect(loaded).toBeLessThanOrEqual(total ?? 0);
    });
  });
});

