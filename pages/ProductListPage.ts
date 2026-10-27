import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import type { Category, SortOption } from '../test-data/products';
import { clickUntilCartUpdates, open, waitForInteractive } from '../utils/hydration';
import { isSorted, parseDiscount, parseRupees } from '../utils/test-helpers';

export interface ProductCardData {
  readonly name: string;
  readonly price: number;
  readonly mrp: number;
  readonly discount: number;
}

/** Category listing pages (/product-list/...) and the product grid they share with search results. */
export class ProductListPage extends BasePage {
  readonly productCards: Locator;
  readonly productNames: Locator;
  readonly productPrices: Locator;
  readonly productMrps: Locator;
  readonly productCount: Locator;
  readonly sortDropdown: Locator;
  readonly filterButton: Locator;
  readonly filterPanel: Locator;
  readonly applyFiltersButton: Locator;
  readonly clearFiltersButton: Locator;

  constructor(page: Page) {
    super(page);
    this.productCards = page.getByTestId('product-card');
    this.productNames = this.productCards.getByTestId('product-name');
    this.productPrices = this.productCards.getByTestId('product-price');
    this.productMrps = this.productCards.getByTestId('product-mrp');
    this.productCount = page.getByText(/^\d+ products?$/);
    this.sortDropdown = page.getByRole('combobox');
    // Labels are styled upper-case by CSS; the DOM text is "Filter", "Apply", "Clear all".
    this.filterButton = page.getByRole('button', { name: /^filter$/i });
    this.filterPanel = page.getByRole('dialog').filter({ hasText: /^filters/i });
    this.applyFiltersButton = this.filterPanel.getByRole('button', { name: /^apply$/i });
    this.clearFiltersButton = this.filterPanel.getByRole('button', { name: /^clear all$/i });
  }

  async goto(category: Category): Promise<void> {
    await open(this.page, category.path);
  }

  async expectLoaded(category?: Category): Promise<void> {
    await expect(this.page).toHaveURL(/\/product-list\//);
    if (category) {
      await expect(this.page.getByText(`Home / ${category.heading}`)).toBeVisible({ timeout: 30_000 });
    }
    // The count renders as "0 products" until the catalog request returns.
    await expect(this.productCount).toHaveText(/^[1-9]\d* products?$/, { timeout: 30_000 });
    await expect(this.productCards.first()).toBeVisible();
    await waitForInteractive(this.sortDropdown);
  }

  async readProductCount(): Promise<number> {
    return Number((await this.productCount.innerText()).match(/\d+/)?.[0]);
  }

  card(index: number): Locator {
    return this.productCards.nth(index);
  }

  cardByName(name: string): Locator {
    return this.productCards.filter({ has: this.page.getByTestId('product-name').getByText(name, { exact: true }) });
  }

  async readCard(card: Locator): Promise<ProductCardData> {
    return {
      name: (await card.getByTestId('product-name').innerText()).trim(),
      price: parseRupees(await card.getByTestId('product-price').innerText()),
      mrp: parseRupees(await card.getByTestId('product-mrp').innerText()),
      discount: parseDiscount(await card.getByTestId('product-discount').innerText()),
    };
  }

  cardWishlist(card: Locator): Locator {
    return card.getByTestId('wishlist');
  }

  /** After a quick add, the card's button becomes a "- n +" stepper. */
  cardQuantity(card: Locator): Locator {
    return card.locator('button[data-no-card-nav] span');
  }

  async increaseCardQuantity(card: Locator): Promise<void> {
    await card.locator('button[data-no-card-nav] button').last().click();
  }

  async decreaseCardQuantity(card: Locator): Promise<void> {
    await card.locator('button[data-no-card-nav] button').first().click();
  }

  /** The grid shows 20 cards and loads more as the last one scrolls into view. */
  async scrollToLoadMore(): Promise<void> {
    const before = await this.productCards.count();
    await this.productCards.last().scrollIntoViewIfNeeded();
    await this.page.mouse.wheel(0, 2_000);
    await expect.poll(() => this.productCards.count(), { message: 'more products should load on scroll' }).toBeGreaterThan(before);
  }

  /** "Add to cart" on a card adds its default size and turns into a quantity stepper. */
  async quickAdd(card: Locator): Promise<void> {
    await clickUntilCartUpdates(this.page, card.getByRole('button', { name: 'Add to cart' }));
    await expect(card.getByRole('button', { name: 'Add to cart' })).toBeHidden();
  }

  async openProduct(card: Locator): Promise<void> {
    await card.locator('a[href^="/product/"]').first().click();
    await expect(this.page).toHaveURL(/\/product\//);
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sortDropdown.selectOption({ label: option.label });
    await expect(this.page).toHaveURL(new RegExp(`[?&]sort=${option.value}(&|$)`));
    await expect(this.productCards.first()).toBeVisible();
  }

  /** Sale prices of the cards currently loaded (the grid lazy-loads more on scroll). */
  async readPrices(): Promise<number[]> {
    return (await this.productPrices.allInnerTexts()).map(parseRupees);
  }

  async readMrps(): Promise<number[]> {
    return (await this.productMrps.allInnerTexts()).map(parseRupees);
  }

  /** Waits for the re-sorted grid to render (the URL changes before the cards do), then checks the MRP order. */
  async expectSortedByMrp(direction: 'asc' | 'desc'): Promise<void> {
    let last: number[] = [];
    await expect
      .poll(async () => {
        last = await this.readMrps();
        return last.length > 1 && isSorted(last, direction);
      }, { message: `MRPs should be ${direction === 'asc' ? 'ascending' : 'descending'}` })
      .toBe(true)
      .catch((error: Error) => {
        throw new Error(`${error.message}\nMRPs on the page: ${last.join(', ')}`);
      });
  }

  async openFilters(): Promise<void> {
    await this.filterButton.click();
    await expect(this.filterPanel).toBeVisible();
  }

  sizeFilter(size: string): Locator {
    return this.filterPanel.getByRole('button', { name: size, exact: true });
  }

  async filterBySize(size: string): Promise<void> {
    await this.openFilters();
    await this.sizeFilter(size).click();
    await this.applyFiltersButton.click();
    await expect(this.page).toHaveURL(new RegExp(`[?&]o=Size\\|${size}\\|`));
  }
}
