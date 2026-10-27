import { expect, type Locator, type Page } from '@playwright/test';
import { ProductListPage } from './ProductListPage';
import { open, waitForInteractive } from '../utils/hydration';

/** /search: a query box above the same product grid that category pages use. */
export class SearchPage extends ProductListPage {
  readonly searchInput: Locator;
  /** "3/156": pages loaded / total results. */
  readonly resultPager: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.getByPlaceholder('What are you looking for?');
    this.resultPager = page.getByText(/^\d+\/\d+$/);
  }

  async gotoQuery(term: string): Promise<void> {
    await open(this.page, `/search?q=${encodeURIComponent(term)}`);
    await waitForInteractive(this.searchInput);
  }

  async search(term: string): Promise<void> {
    await waitForInteractive(this.searchInput);
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
    await expect(this.page).toHaveURL(new RegExp(`/search\\?q=${encodeURIComponent(term)}`));
  }

  async expectResults(): Promise<void> {
    await expect(this.productCards.first()).toBeVisible({ timeout: 30_000 });
  }
}
