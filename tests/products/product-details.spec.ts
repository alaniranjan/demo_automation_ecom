import { Severity, severity } from 'allure-js-commons';
import { test, expect } from '../../fixtures/test-fixtures';
import { DefaultLocation } from '../../test-data/customers';
import { Products } from '../../test-data/products';
import { labelTest } from '../../utils/test-helpers';

const product = Products.muscleVest;

test.describe('Product details', { tag: '@regression' }, () => {
  test.beforeEach(async ({ productDetailsPage }) => {
    await labelTest({ feature: 'Products', story: 'Product details' });
    await productDetailsPage.goto(product);
    await productDetailsPage.expectLoaded(product);
  });

  test('PDP-01 Shows name, pricing and purchase actions', { tag: '@smoke' }, async ({ productDetailsPage }) => {
    await severity(Severity.CRITICAL);

    await test.step('Verify pricing', async () => {
      const { price, mrp, discount } = await productDetailsPage.readPricing();
      expect(price).toBeGreaterThan(0);
      expect(price).toBeLessThanOrEqual(mrp);
      expect(Math.abs(((mrp - price) / mrp) * 100 - discount)).toBeLessThanOrEqual(1);
      await expect(productDetailsPage.taxNote).toBeVisible();
    });

    await test.step('Verify the purchase actions', async () => {
      await expect(productDetailsPage.addToBagButton).toHaveText(/add to bag/i);
      await expect(productDetailsPage.buyNowButton).toBeVisible();
      await expect(productDetailsPage.wishlistButton).toBeVisible();
      await expect(productDetailsPage.sizeGuideButton).toBeVisible();
    });
  });

  test('PDP-02 Lists the sizes and preselects the first', async ({ productDetailsPage }) => {
    await test.step('Verify the size options', async () => {
      await expect(productDetailsPage.sizeOptions).toHaveText([...product.sizes]);
      await productDetailsPage.expectSizeSelected(product.sizes[0]);
    });
  });

  test('PDP-03 Selects a different size', async ({ productDetailsPage }) => {
    await test.step('Choose size M', async () => {
      await productDetailsPage.selectSize('M');
    });

    await test.step('Verify only M is selected', async () => {
      await expect(productDetailsPage.sizeOption('S')).not.toHaveClass(/selected/);
      await productDetailsPage.expectSizeSelected('M');
    });
  });

  test('PDP-04 Shows a delivery date for a serviceable pincode', async ({ productDetailsPage }) => {
    await test.step(`Check delivery to ${DefaultLocation.pincode}`, async () => {
      await productDetailsPage.checkDelivery(DefaultLocation.pincode);
    });

    await test.step('Verify an estimated delivery date', async () => {
      await expect(productDetailsPage.deliveryDate).toHaveText(/Delivery by \w{3}, \w{3} \d{1,2}, \d{4}/);
    });
  });

  test('PDP-05 Recommends other products', async ({ productDetailsPage }) => {
    await test.step('Verify the recommendations', async () => {
      // Rendered lazily below the fold.
      await productDetailsPage.recommendedHeading.scrollIntoViewIfNeeded({ timeout: 30_000 });
      await expect(productDetailsPage.recommendedHeading).toBeVisible();
      expect(await productDetailsPage.recommendedProducts.count()).toBeGreaterThan(0);
    });
  });

  test('PDP-06 Shows colour options and an image gallery', async ({ productDetailsPage }) => {
    await test.step('Verify the colour count', async () => {
      await expect(productDetailsPage.colourCount).toHaveText(/[1-9]\d* colours? available/i);
    });

    await test.step('Verify the gallery thumbnails', async () => {
      expect(await productDetailsPage.thumbnails.count()).toBeGreaterThan(1);
      await expect(productDetailsPage.thumbnails.first()).toBeVisible();
    });
  });

  test('PDP-07 Opens and closes the size guide', async ({ productDetailsPage, page }) => {
    await test.step('Open the size guide', async () => {
      await productDetailsPage.sizeGuideButton.click();
    });

    await test.step('Verify the measurement chart lists every size', async () => {
      await expect(productDetailsPage.sizeGuideDialog).toBeVisible();
      for (const size of product.sizes) {
        await expect(productDetailsPage.sizeGuideDialog).toContainText(size);
      }
    });

    await test.step('Close it with Escape', async () => {
      await page.keyboard.press('Escape');
      await expect(productDetailsPage.sizeGuideDialog).toBeHidden();
    });
  });
});

