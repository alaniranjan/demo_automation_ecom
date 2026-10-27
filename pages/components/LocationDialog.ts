import { expect, type Locator, type Page } from '@playwright/test';

/** "Enter Pincode or Location" panel the store opens before the first add to bag when no location is saved. */
export class LocationDialog {
  readonly page: Page;
  readonly panel: Locator;
  readonly input: Locator;
  readonly currentLocationOption: Locator;
  readonly confirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('location-drawer');
    this.input = page.getByTestId('location-input');
    this.currentLocationOption = page.getByText('Current location', { exact: true });
    this.confirmButton = page.getByTestId('confirm-location');
  }

  async expectOpen(): Promise<void> {
    await expect(this.input).toBeVisible();
    await expect(this.currentLocationOption).toBeVisible();
  }

  /**
   * Types a pincode, picks the first Indian suggestion and confirms the pin on the map. Suggestions come from a
   * worldwide geocoder, so "560001" also lists Japanese postcodes like "560-0011".
   */
  async choosePincode(pincode: string): Promise<void> {
    // Suggestions are fetched on key events, so type like a user; fill() can leave the result list empty.
    await this.input.pressSequentially(pincode, { delay: 80 });
    await this.panel.getByText(new RegExp(`\\b${pincode}, India$`)).first().click();
    await this.confirmButton.click();
    await expect(this.input).toBeHidden();
  }
}
