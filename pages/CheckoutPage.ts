import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { waitForInteractive } from '../utils/hydration';
import { parseRupees } from '../utils/test-helpers';

export const PaymentMethod = {
  Upi: 'UPI',
  Card: 'Credit Card / Debit Card',
  CashOnDelivery: 'Cash On Delivery',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export interface CouponResult {
  readonly code: string;
  readonly applied: boolean;
  /** The store's reply, e.g. "Minimum order amount should be 1000 to apply this promo code." */
  readonly message: string;
}

export interface OrderSummaryLine {
  readonly name: string;
  readonly size: string;
  readonly quantity: number;
}

/** /checkout for a signed-in customer: contact, shipping address (prefilled from the account), payment, summary. */
export class CheckoutPage extends BasePage {
  readonly email: Locator;
  readonly phone: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly flat: Locator;
  readonly address: Locator;
  readonly city: Locator;
  readonly pincode: Locator;
  readonly state: Locator;
  readonly country: Locator;
  readonly placeOrderButton: Locator;
  readonly couponInput: Locator;
  readonly applyCouponButton: Locator;
  /** Codes offered under "Apply a voucher" (shown in bold: "WELCOME", "SPECIAL OFFER", ...). */
  readonly voucherCodes: Locator;
  /** One per bag line in the Order Summary ("<name>" / "Size: M · Qty: 1" / prices). */
  readonly summaryLines: Locator;

  constructor(page: Page) {
    super(page);
    const field = (name: string) => page.locator(`input[name="checkout-${name}"]`);
    this.email = field('email');
    this.phone = field('phone');
    this.firstName = field('first-name');
    this.lastName = field('last-name');
    this.flat = field('flat');
    this.address = field('address');
    this.city = field('city');
    this.pincode = field('pincode');
    this.state = field('state');
    this.country = field('country');
    this.placeOrderButton = page.getByRole('button', { name: /^place order$/i });
    this.couponInput = page.locator('input[name="promo-code"]');
    this.applyCouponButton = this.couponInput.locator('xpath=following::button[1]');
    this.voucherCodes = page.getByText(/^apply a voucher$/i).locator('xpath=..').locator('strong');
    this.summaryLines = page.getByText(/· Qty: \d+$/).locator('xpath=ancestor::div[.//img][1]');
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/checkout/);
    await expect(this.placeOrderButton).toBeVisible({ timeout: 45_000 });
    await waitForInteractive(this.placeOrderButton);
    // Amounts render as ₹0 until the cart is priced.
    await expect(this.summaryValue('Amount to Pay')).toHaveText(/^₹\s?[1-9]/, { timeout: 30_000 });
  }

  paymentOption(method: PaymentMethod): Locator {
    return this.page.getByRole('radio', { name: method });
  }

  async choosePayment(method: PaymentMethod): Promise<void> {
    await this.paymentOption(method).click();
    await expect(this.paymentOption(method)).toBeChecked();
  }

  /** Value next to an Order Summary label: "MRP Total", "Product Discount", "Subtotal", "Amount to Pay", ... */
  summaryValue(label: string): Locator {
    return this.page.getByText(new RegExp(`^${label}$`, 'i')).locator('xpath=following-sibling::span[1]');
  }

  async readSummaryAmount(label: string): Promise<number> {
    return parseRupees((await this.summaryValue(label).innerText()).replace('-', ''));
  }

  async readSummaryLines(): Promise<OrderSummaryLine[]> {
    const lines: OrderSummaryLine[] = [];
    for (const line of await this.summaryLines.all()) {
      const name = (await line.locator('p').first().innerText()).trim();
      const details = await line.getByText(/· Qty: \d+$/).innerText();
      lines.push({
        name,
        size: details.match(/Size:\s*(.+?)\s*·/)?.[1] ?? '',
        quantity: Number(details.match(/Qty:\s*(\d+)/)?.[1]),
      });
    }
    return lines;
  }

  /** Enters a code and applies it, returning the store's verdict from its coupons API (not a guess from the UI). */
  async applyCoupon(code: string): Promise<CouponResult> {
    await this.couponInput.fill(code);
    const response = this.page.waitForResponse((reply) => /\/coupons\/single/.test(reply.url()));
    await this.applyCouponButton.click();
    const reply = await response;
    const body = (await reply.json().catch(() => ({}))) as { status?: boolean; message?: string };
    return { code, applied: reply.ok() && body.status === true, message: body.message ?? `HTTP ${reply.status()}` };
  }

  /** The voucher box shows a spinner until the coupons API answers: codes, or "Unable to load vouchers right now." */
  async waitForVouchers(): Promise<void> {
    const settled = this.voucherCodes.first().or(this.page.getByText(/unable to load vouchers/i));
    await expect(settled).toBeVisible({ timeout: 30_000 });
  }

  /** Tries each offered voucher until one is accepted; returns every attempt (none applied if the order is too small). */
  async applyFirstEligibleVoucher(): Promise<CouponResult[]> {
    await this.waitForVouchers();
    const attempts: CouponResult[] = [];
    for (const code of (await this.voucherCodes.allInnerTexts()).map((text) => text.trim()).filter(Boolean)) {
      const result = await this.applyCoupon(code);
      attempts.push(result);
      if (result.applied) break;
    }
    return attempts;
  }

  async expectShippingDetailsFilled(): Promise<void> {
    for (const input of [this.email, this.phone, this.firstName, this.address, this.city, this.pincode, this.state, this.country]) {
      await expect(input).not.toHaveValue('');
    }
    await expect(this.pincode).toHaveValue(/^\d{6}$/);
  }

  async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
  }
}
