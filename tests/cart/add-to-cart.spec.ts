import { Severity, severity } from 'allure-js-commons';
import { test, expect } from '../../fixtures/test-fixtures';
import { DefaultLocation } from '../../test-data/customers';
import { Products } from '../../test-data/products';
import { cartTotal, labelTest } from '../../utils/test-helpers';

test.describe('Add to bag', { tag: '@regression' }, () => {
  test.beforeEach(async () => {
    await labelTest({ feature: 'Cart', story: 'Add to bag' });
  });

  test('CART-01 Adds a product in the chosen size', { tag: '@smoke' }, async ({ productDetailsPage }) => {
    await severity(Severity.BLOCKER);
    const product = Products.muscleVest;

    await test.step('Open the product and choose size M', async () => {
      await productDetailsPage.goto(product);
      await productDetailsPage.expectLoaded(product);
      await productDetailsPage.expectCartCount(0);
      await productDetailsPage.selectSize('M');
    });

    await test.step('Add to bag', async () => {
      await productDetailsPage.addToBag();
      await productDetailsPage.expectAddedToBag();
      await productDetailsPage.expectCartCount(1);
    });

    await test.step('Verify the bag line', async () => {
      const cart = await productDetailsPage.openCart();
      await cart.expectItemCount(1);
      await expect(cart.line(product.name)).toContainText('Size: M');
      await expect(cart.lineQuantity(product.name)).toHaveText('1');
    });
  });

  test('CART-02 Adds two different products', async ({ productDetailsPage }) => {
    const products = [Products.muscleVest, Products.regularShorts];

    for (const [index, product] of products.entries()) {
      await test.step(`Add "${product.name}"`, async () => {
        await productDetailsPage.goto(product);
        await productDetailsPage.expectLoaded(product);
        await productDetailsPage.addToBag();
        await productDetailsPage.expectCartCount(index + 1);
      });
    }

    await test.step('Verify both lines and the estimated total', async () => {
      const cart = await productDetailsPage.openCart();
      await cart.expectItemCount(products.length);
      await expect(cart.lines).toHaveCount(products.length);
      for (const product of products) {
        await expect(cart.line(product.name)).toBeVisible();
      }
      const lines = await cart.readLines();
      expect(await cart.readEstimatedTotal()).toBeCloseTo(cartTotal(lines), 2);
    });
  });

  test('CART-03 Bag line price matches the product page', async ({ productDetailsPage }) => {
    const product = Products.regularShorts;
    let pagePrice = 0;

    await test.step('Read the price and add to bag', async () => {
      await productDetailsPage.goto(product);
      await productDetailsPage.expectLoaded(product);
      pagePrice = (await productDetailsPage.readPricing()).price;
      await productDetailsPage.addToBag();
      await productDetailsPage.expectCartCount(1);
    });

    await test.step('Verify the bag shows the same price', async () => {
      const cart = await productDetailsPage.openCart();
      await expect(cart.line(product.name)).toBeVisible();
      const [line] = await cart.readLines();
      expect(line?.name).toBe(product.name);
      // The product page rounds to whole rupees; the bag shows paise (e.g. ₹759 vs ₹759.05).
      expect(Math.abs((line?.price ?? 0) - pagePrice)).toBeLessThan(1);
    });
  });
});

test.describe('Delivery location', { tag: '@regression' }, () => {
  // Start as a first-time visitor with no saved location.
  test.use({ deliveryLocation: null });

  test('CART-04 Asks for a delivery location before the first add to bag', async ({ productDetailsPage }) => {
    await labelTest({ feature: 'Cart', story: 'Delivery location' });

    await test.step('Click "Add to bag" without a saved location', async () => {
      await productDetailsPage.goto(Products.muscleVest);
      await productDetailsPage.expectLoaded(Products.muscleVest);
      await productDetailsPage.clickAddToBag();
    });

    await test.step('Verify the location panel opens and nothing is added yet', async () => {
      await productDetailsPage.locationDialog.expectOpen();
      await productDetailsPage.expectCartCount(0);
    });

    await test.step(`Choose pincode ${DefaultLocation.pincode}`, async () => {
      await productDetailsPage.locationDialog.choosePincode(DefaultLocation.pincode);
    });

    await test.step('Add to bag again and verify it succeeds', async () => {
      await productDetailsPage.addToBag();
      await productDetailsPage.expectCartCount(1);
    });
  });
});
