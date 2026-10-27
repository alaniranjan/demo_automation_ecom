import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { parseRupees } from '../utils/test-helpers';

/** "ORDT1102291" anywhere in a text, with or without the leading "#". */
export const ORDER_ID = /\bORD[A-Z]*\d{4,}\b/;

/** The page the store shows right after "Place order" (thank you / order confirmation). */
export class OrderConfirmationPage extends BasePage {
  readonly orderId: Locator;
  readonly paymentMethod: Locator;
  readonly finalAmount: Locator;

  constructor(page: Page) {
    super(page);
    this.orderId = page.getByText(ORDER_ID).first();
    this.paymentMethod = page.getByText(/^payment method$/i).locator('xpath=following::*[normalize-space()][1]');
    this.finalAmount = page.getByText(/^final amount$/i).locator('xpath=following::*[normalize-space()][1]');
  }

  async readFinalAmount(): Promise<number> {
    return parseRupees(await this.finalAmount.innerText());
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/checkout\/?$/, { timeout: 60_000 });
    await expect(this.orderId).toBeVisible({ timeout: 30_000 });
  }

  async readOrderId(): Promise<string> {
    return (await this.orderId.innerText()).match(ORDER_ID)?.[0] ?? '';
  }
}

export interface OrderDetails {
  readonly orderId: string;
  readonly itemText: string;
  readonly totalAmount: number;
  readonly discount: number;
  readonly amountPayable: number;
  readonly status: string;
}

/** /my-account/orders/<uuid>: one order's items, charges and delivery details. */
export class OrderDetailsPage extends BasePage {
  readonly heading: Locator;
  readonly itemList: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByText(/^Order ID:/);
    this.itemList = page.getByText(/^item list$/i).locator('xpath=..');
  }

  async expectLoaded(orderId: string): Promise<void> {
    await expect(this.page).toHaveURL(/\/my-account\/orders\/[\w-]+/);
    await expect(this.heading).toContainText(orderId, { timeout: 30_000 });
  }

  /** Value printed after a label in the details panel ("AMOUNT PAYABLE" -> "₹ 379.00"). */
  value(label: RegExp): Locator {
    return this.page.getByText(label).first().locator('xpath=following::*[normalize-space()][1]');
  }

  async read(): Promise<OrderDetails> {
    const body = await this.page.locator('body').innerText();
    const amountAfter = async (label: RegExp) => parseRupees(await this.value(label).innerText());
    return {
      orderId: body.match(/Order ID:\s*(\S+)/)?.[1] ?? '',
      itemText: body.slice(body.search(/item list/i), body.search(/total amount/i)),
      totalAmount: await amountAfter(/^total amount$/i),
      discount: await amountAfter(/^discount \(-\)$/i),
      amountPayable: await amountAfter(/^amount payable$/i),
      status: (body.match(/\b(Pending|Confirmed|Shipped|Delivered|Cancelled)\b/) ?? [''])[0],
    };
  }

  /** "DELIVER TO", "CUSTOMER NAME", "PHONE NUMBER" ... in the "Other details" block. */
  detail(label: string): Locator {
    return this.value(new RegExp(`^${label}$`, 'i'));
  }
}
