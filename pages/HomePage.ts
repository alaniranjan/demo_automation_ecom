import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { open, waitForInteractive } from '../utils/hydration';

export class HomePage extends BasePage {
  readonly promoBanner: Locator;
  readonly heroSlides: Locator;
  readonly productCards: Locator;
  readonly copyright: Locator;

  constructor(page: Page) {
    super(page);
    this.promoBanner = page.getByText('Get an Extra 10% Off on Your First Order!');
    this.heroSlides = page.getByRole('button', { name: /^[1-9]$/ });
    this.productCards = page.getByTestId('product-card');
    this.copyright = page.getByText(/© \d{4} \| Honebi \| All Rights Reserved\./);
  }

  async goto(): Promise<void> {
    await open(this.page, '/');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/$/);
    await expect(this.promoBanner).toBeVisible();
    await expect(this.logoLink).toBeVisible();
    await expect(this.productCards.first()).toBeVisible();
    await waitForInteractive(this.cartIcon);
  }

  /** A home page carousel section such as "Men's Apparel" (shown upper-case by CSS). */
  section(title: string): Locator {
    // .first(): the footer repeats some names ("Sarees", "Kids") as links.
    return this.page.getByText(new RegExp(`^${title}$`, 'i')).first();
  }
}
