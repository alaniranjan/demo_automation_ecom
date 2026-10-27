import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { LocationDialog } from './components/LocationDialog';
import type { Product } from '../test-data/products';
import { clickUntilCartUpdates, open, waitForGuestCart, waitForInteractive } from '../utils/hydration';
import { parseDiscount, parseRupees } from '../utils/test-helpers';

export class ProductDetailsPage extends BasePage {
  readonly locationDialog: LocationDialog;
  readonly productName: Locator;
  readonly price: Locator;
  readonly mrp: Locator;
  readonly discount: Locator;
  readonly taxNote: Locator;
  readonly sizeGuideButton: Locator;
  readonly addToBagButton: Locator;
  readonly buyNowButton: Locator;
  readonly wishlistButton: Locator;
  readonly pincodeInput: Locator;
  readonly checkDeliveryButton: Locator;
  readonly deliveryDate: Locator;
  readonly recommendedProducts: Locator;
  readonly recommendedHeading: Locator;
  readonly colourCount: Locator;
  readonly thumbnails: Locator;
  readonly sizeGuideDialog: Locator;

  constructor(page: Page) {
    super(page);
    this.locationDialog = new LocationDialog(page);
    // Recommended product cards reuse id="product-name", so the page title is read from the <h1>.
    this.productName = page.getByRole('heading', { level: 1 });
    this.price = page.getByTestId('retail-price');
    this.mrp = page.getByTestId('mrp');
    this.discount = page.getByTestId('discount');
    this.taxNote = page.getByText('Inclusive of all taxes');
    this.sizeGuideButton = page.getByRole('button', { name: 'Size Guide' });
    this.addToBagButton = page.getByTestId('add-to-cart-button');
    this.buyNowButton = page.getByTestId('quick-buy-button');
    this.wishlistButton = page.getByTestId('whislist-button');
    this.pincodeInput = page.getByPlaceholder('Enter pincode');
    this.checkDeliveryButton = page.getByTestId('change-location');
    this.deliveryDate = page.getByTestId('shipping-date');
    this.recommendedProducts = page.getByTestId('product-card');
    this.recommendedHeading = page.getByText(/^recommended products$/i).first();
    this.colourCount = page.getByText(/\d+ colours? available/i);
    this.thumbnails = page.locator('[id^="thumbnail-image-"]');
    this.sizeGuideDialog = page.getByRole('dialog').filter({ hasText: /item measurement/i });
  }

  async goto(product: Product): Promise<void> {
    await open(this.page, `/product/${product.slug}`);
  }

  async expectLoaded(product?: Product): Promise<void> {
    await expect(this.page).toHaveURL(/\/product\//);
    if (product) {
      await expect(this.productName).toHaveText(product.name);
    } else {
      await expect(this.productName).toBeVisible();
    }
    await expect(this.addToBagButton).toBeVisible();
    await waitForInteractive(this.addToBagButton);
    await waitForGuestCart(this.page);
  }

  sizeOption(size: string): Locator {
    return this.page.getByTestId(`size-div-${size}`);
  }

  /** All size buttons, in display order. */
  get sizeOptions(): Locator {
    return this.page.locator('[id^="size-div-"]');
  }

  async selectSize(size: string): Promise<void> {
    await this.sizeOption(size).click();
    await this.expectSizeSelected(size);
  }

  async expectSizeSelected(size: string): Promise<void> {
    await expect(this.sizeOption(size)).toHaveClass(/selected/);
  }

  /** Adds the selected size to the bag (the delivery location must already be set). */
  async addToBag(): Promise<void> {
    await waitForInteractive(this.addToBagButton);
    await clickUntilCartUpdates(this.page, this.addToBagButton);
  }

  /** A single plain click, for flows where the store answers with a dialog instead of adding (no location yet). */
  async clickAddToBag(): Promise<void> {
    await waitForInteractive(this.addToBagButton);
    await waitForGuestCart(this.page);
    await this.addToBagButton.click();
  }

  async expectAddedToBag(): Promise<void> {
    await expect(this.addToBagButton).toHaveText(/added/i);
  }

  async readPricing(): Promise<{ price: number; mrp: number; discount: number }> {
    return {
      price: parseRupees(await this.price.innerText()),
      mrp: parseRupees(await this.mrp.innerText()),
      discount: parseDiscount(await this.discount.innerText()),
    };
  }

  async checkDelivery(pincode: string): Promise<void> {
    await this.pincodeInput.fill(pincode);
    await this.checkDeliveryButton.click();
  }
}
