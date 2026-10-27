import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { open, waitForInteractive } from '../utils/hydration';

/** /my-account: profile, order history and the other signed-in sections. */
export class AccountPage extends BasePage {
  readonly ordersLink: Locator;
  readonly addressBookLink: Locator;
  readonly editProfileLink: Locator;
  readonly logoutButton: Locator;
  /** "#ORDT1102290" order numbers, newest first. */
  readonly orderNumbers: Locator;

  constructor(page: Page) {
    super(page);
    this.ordersLink = page.getByText(/^orders$/i).first();
    this.addressBookLink = page.getByText(/^address book$/i).first();
    this.editProfileLink = page.getByText(/^edit profile$/i).first();
    this.logoutButton = page.getByText(/^logout$/i).first();
    this.orderNumbers = page.getByText(/^#ORD[A-Z]*\d+$/);
  }

  async gotoProfile(): Promise<void> {
    await open(this.page, '/my-account/profile');
  }

  async gotoOrders(): Promise<void> {
    await open(this.page, '/my-account/orders');
  }

  async expectProfileLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/my-account\/profile/);
    await expect(this.editProfileLink).toBeVisible({ timeout: 30_000 });
    await expect(this.logoutButton).toBeVisible();
    await waitForInteractive(this.cartIcon);
  }

  async expectOrdersLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/my-account\/orders/);
    await expect(this.orderNumbers.first()).toBeVisible({ timeout: 30_000 });
  }

  async readOrderNumbers(): Promise<string[]> {
    return (await this.orderNumbers.allInnerTexts()).map((text) => text.trim());
  }

  /** Status shown next to an order number ("Pending", "Delivered", ...). */
  orderStatus(orderNumber: string): Locator {
    return this.page
      .getByText(orderNumber, { exact: true })
      .locator('xpath=following::*[normalize-space()][1]');
  }
}
