import { expect, type Locator, type Page } from '@playwright/test';
import type { Registration } from '../test-data/customers';
import { open, waitForInteractive } from '../utils/hydration';

/** /login: "Sign in" (mobile number + OTP) and "Create account" tabs. */
export class LoginPage {
  readonly page: Page;
  readonly signInTab: Locator;
  readonly createAccountTab: Locator;

  // Sign in tab
  readonly phoneInput: Locator;
  readonly signInButton: Locator;

  // Create account tab
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly emailInput: Locator;
  readonly registerPhoneInput: Locator;
  readonly referralInput: Locator;
  readonly createAccountButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.signInTab = page.getByTestId('turtle-login-tab-signin');
    this.createAccountTab = page.getByTestId('turtle-login-tab-register');

    this.phoneInput = page.getByTestId('turtle-login-email');
    this.signInButton = page.getByTestId('turtle-login-signin-btn');

    this.firstNameInput = page.getByTestId('turtle-reg-first-name');
    this.lastNameInput = page.getByTestId('turtle-reg-last-name');
    this.emailInput = page.getByTestId('turtle-reg-email');
    this.registerPhoneInput = page.getByTestId('turtle-reg-phone');
    this.referralInput = page.getByTestId('turtle-reg-referal');
    this.createAccountButton = page.getByTestId('turtle-reg-submit-btn');
  }

  async goto(): Promise<void> {
    await open(this.page, '/login');
    await waitForInteractive(this.createAccountTab);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.signInTab).toBeVisible();
    await expect(this.createAccountTab).toBeVisible();
    await expect(this.phoneInput).toBeVisible();
    await waitForInteractive(this.createAccountTab);
  }

  async signIn(phone: string): Promise<void> {
    await this.phoneInput.fill(phone);
    await this.signInButton.click();
  }

  async openCreateAccount(): Promise<void> {
    await this.createAccountTab.click();
    await expect(this.firstNameInput).toBeVisible();
  }

  /** Fills the registration fields; tests never submit a complete form, which would create a real account. */
  async fillRegistration({ firstName, lastName, email }: Partial<Registration>): Promise<void> {
    if (firstName !== undefined) await this.firstNameInput.fill(firstName);
    if (lastName !== undefined) await this.lastNameInput.fill(lastName);
    if (email !== undefined) await this.emailInput.fill(email);
  }

  async expectError(message: string): Promise<void> {
    await expect(this.page.getByText(message, { exact: true })).toBeVisible();
  }
}
