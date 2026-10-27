import { expect, type Locator, type Page } from '@playwright/test';
import { CartDrawer } from './components/CartDrawer';
import { SignInDialog } from './components/SignInDialog';

/** Shared header (logo, navigation, search, wishlist, account, bag) and footer available on every storefront page. */
export abstract class BasePage {
  readonly page: Page;
  readonly cartDrawer: CartDrawer;
  readonly signInDialog: SignInDialog;

  readonly logoLink: Locator;
  readonly searchIcon: Locator;
  readonly wishlistIcon: Locator;
  readonly accountIcon: Locator;
  readonly cartIcon: Locator;
  readonly cartCount: Locator;

  protected constructor(page: Page) {
    this.page = page;
    this.cartDrawer = new CartDrawer(page);
    this.signInDialog = new SignInDialog(page);

    // Header widgets carry generated ids with a stable prefix ("cart-placeholder-<uuid>-Cart-06"); the icon image
    // inside each is the click target. A widget can be briefly hidden while the header re-renders, so target the
    // visible match.
    const visibleHeader = (selector: string) => page.locator(selector).filter({ visible: true }).first();
    this.logoLink = visibleHeader('[id^="logo-placeholder-"] a');
    this.searchIcon = visibleHeader('[id^="search-placeholder-icon-"] img');
    this.wishlistIcon = visibleHeader('[id^="wishlist-placeholder-"] img');
    this.accountIcon = visibleHeader('[id^="login-placeholder-"] img');
    this.cartIcon = visibleHeader('[id^="cart-placeholder-"] img');
    this.cartCount = page.getByTestId('cart-count');
  }

  /** Header navigation link ("Women's", "Men's", "Kids"); the footer repeats these names, the header comes first. */
  navLink(name: string): Locator {
    return this.page.getByRole('link', { name, exact: true }).first();
  }

  /** Footer link by its exact text ("Sarees", "Backpacks", "Privacy Policy", ...). */
  footerLink(name: string): Locator {
    return this.page.getByRole('link', { name, exact: true }).last();
  }

  /**
   * Opening the drawer is idempotent, and the bag icon ignores clicks until the store has loaded the cart (a few
   * seconds after hydration, longer for a signed-in customer), so the click is retried until the drawer shows.
   */
  async openCart(): Promise<CartDrawer> {
    await expect(async () => {
      if (!(await this.cartDrawer.root.isVisible())) {
        await this.cartIcon.click();
      }
      await this.cartDrawer.expectOpen({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    return this.cartDrawer;
  }

  async openSearch(): Promise<void> {
    await this.searchIcon.click();
    await expect(this.page).toHaveURL(/\/search/);
  }

  async goHome(): Promise<void> {
    await this.logoLink.click();
    await expect(this.page).toHaveURL(/\/$/);
  }

  async expectCartCount(count: number): Promise<void> {
    await expect(this.cartCount).toHaveText(String(count));
  }
}
