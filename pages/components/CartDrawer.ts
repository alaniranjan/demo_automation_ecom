import { expect, type Locator, type Page } from '@playwright/test';
import { EmptyBag } from '../../test-data/customers';
import { parseRupees, type CartLine } from '../../utils/test-helpers';

/** The "Your Cart" side drawer opened from the header bag icon. */
export class CartDrawer {
  readonly page: Page;
  readonly root: Locator;
  readonly title: Locator;
  readonly closeButton: Locator;
  /** One per bag line. "Better Together" suggestions also have quantity steppers but no Remove button. */
  readonly lines: Locator;
  readonly estimatedTotal: Locator;
  /** Struck-through MRP total next to the estimated total. */
  readonly estimatedMrp: Locator;
  /** "₹39.95 Saved so far!" banner. */
  readonly savedSoFar: Locator;
  readonly checkoutButton: Locator;
  readonly emptyHeading: Locator;
  readonly emptyText: Locator;
  readonly continueExploringButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog').filter({ hasText: /Your Cart \(/ });
    this.title = this.root.getByText(/^Your Cart \(\d+ items?\)$/);
    this.closeButton = this.root.getByRole('button').first();
    this.lines = this.root.getByRole('button', { name: 'Remove item' }).locator('xpath=ancestor::div[.//p][1]');
    // Last rupee amount in the "Estimated Total" row is the payable total; the first is the struck-through MRP.
    const totalRow = this.root.getByText('Estimated Total', { exact: true }).locator('xpath=ancestor::div[2]');
    this.estimatedTotal = totalRow.getByText(/^₹[\d,.]+$/).last();
    this.estimatedMrp = totalRow.getByText(/^₹[\d,.]+$/).first();
    this.savedSoFar = this.root.getByText(/saved so far/i);
    this.checkoutButton = this.root.getByRole('button', { name: /checkout/i });
    this.emptyHeading = this.root.getByText(new RegExp(`^${EmptyBag.heading}$`, 'i'));
    this.emptyText = this.root.getByText(EmptyBag.text);
    this.continueExploringButton = this.root.getByRole('button', { name: /continue exploring/i });
  }

  async expectOpen(options?: { timeout?: number }): Promise<void> {
    await expect(this.title).toBeVisible(options);
  }

  /** Removes every bag line, one at a time (each removal is a server round trip for a signed-in customer). */
  async removeAll(): Promise<void> {
    let remaining = await this.lines.count();
    while (remaining > 0) {
      await this.lines.first().getByRole('button', { name: 'Remove item' }).click();
      await expect(this.lines).toHaveCount(remaining - 1);
      remaining -= 1;
    }
  }

  async expectItemCount(count: number): Promise<void> {
    await expect(this.title).toHaveText(`Your Cart (${count} items)`);
  }

  line(name: string): Locator {
    return this.lines.filter({ has: this.page.getByText(name, { exact: true }) });
  }

  lineQuantity(name: string): Locator {
    return this.line(name).getByRole('button', { name: 'Decrease quantity' }).locator('xpath=following-sibling::span[1]');
  }

  async increaseQuantity(name: string): Promise<void> {
    await this.line(name).getByRole('button', { name: 'Increase quantity' }).click();
  }

  async decreaseQuantity(name: string): Promise<void> {
    await this.line(name).getByRole('button', { name: 'Decrease quantity' }).click();
  }

  async removeItem(name: string): Promise<void> {
    await this.line(name).getByRole('button', { name: 'Remove item' }).click();
  }

  /** Reads every bag line: name, unit sale price (the second rupee amount; the first is MRP) and quantity. */
  async readLines(): Promise<CartLine[]> {
    const result: CartLine[] = [];
    for (const line of await this.lines.all()) {
      const name = (await line.locator('p').first().innerText()).trim();
      const amounts = await line.getByText(/^₹[\d,.]+$/).allInnerTexts();
      const quantity = await line
        .getByRole('button', { name: 'Decrease quantity' })
        .locator('xpath=following-sibling::span[1]')
        .innerText();
      result.push({ name, price: parseRupees(amounts.at(-1) ?? ''), quantity: Number(quantity) });
    }
    return result;
  }

  /** Reads every line's MRP (the first rupee amount) times its quantity. */
  async readLineMrps(): Promise<number[]> {
    const result: number[] = [];
    for (const line of await this.lines.all()) {
      const amounts = await line.getByText(/^₹[\d,.]+$/).allInnerTexts();
      const quantity = Number(
        await line.getByRole('button', { name: 'Decrease quantity' }).locator('xpath=following-sibling::span[1]').innerText(),
      );
      result.push(parseRupees(amounts[0] ?? '') * quantity);
    }
    return result;
  }

  async readEstimatedMrp(): Promise<number> {
    return parseRupees(await this.estimatedMrp.innerText());
  }

  async readEstimatedTotal(): Promise<number> {
    return parseRupees(await this.estimatedTotal.innerText());
  }

  async expectEmpty(): Promise<void> {
    await this.expectItemCount(0);
    await expect(this.emptyHeading).toBeVisible();
    await expect(this.emptyText).toBeVisible();
    await expect(this.lines).toHaveCount(0);
  }

  async checkout(): Promise<void> {
    await this.checkoutButton.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.root).toBeHidden();
  }
}
