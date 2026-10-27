import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Mobile-number sign-in dialog opened by the header account icon and by guest-only actions such as the wishlist.
 * Tests never request an OTP: that would send an SMS to a real phone.
 */
export class SignInDialog {
  readonly page: Page;
  readonly root: Locator;
  readonly heading: Locator;
  readonly countryCode: Locator;
  readonly mobileInput: Locator;
  readonly getOtpButton: Locator;
  readonly termsLink: Locator;
  readonly privacyLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByTestId('signin-dialog');
    this.heading = this.root.getByRole('heading', { name: 'Sign In' });
    this.countryCode = this.root.getByText('+91', { exact: true });
    this.mobileInput = this.root.getByTestId('mobile-input');
    // Rendered as a styled <div>, so "disabled" is its not-allowed cursor rather than a disabled attribute.
    this.getOtpButton = this.root.getByTestId('get-otp-button');
    this.termsLink = this.root.getByTestId('terms-of-service-link');
    this.privacyLink = this.root.getByTestId('privacy-policy-link');
  }

  async expectOpen(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.heading).toBeVisible();
    await expect(this.mobileInput).toBeVisible();
  }

  async expectGetOtpDisabled(): Promise<void> {
    await expect(this.getOtpButton).toHaveCSS('cursor', 'not-allowed');
  }

  async expectGetOtpEnabled(): Promise<void> {
    await expect(this.getOtpButton).toHaveCSS('cursor', 'pointer');
  }

  /** The dialog has no close button and ignores Escape; clicking the dimmed backdrop dismisses it. */
  async dismiss(): Promise<void> {
    await this.page.mouse.click(5, 5);
    await expect(this.root).toBeHidden();
  }
}
