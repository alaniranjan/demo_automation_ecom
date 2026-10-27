import { test, expect } from '../../fixtures/test-fixtures';
import { Products } from '../../test-data/products';
import { cartTotal, labelTest } from '../../utils/test-helpers';

const product = Products.muscleVest;

test.describe('Update bag', { tag: '@regression' }, () => {
  test.beforeEach(async ({ productDetailsPage }) => {
    await labelTest({ feature: 'Cart', story: 'Update bag' });
    await test.step(`Add "${product.name}" to the bag`, async () => {
      await productDetailsPage.goto(product);
      await productDetailsPage.expectLoaded(product);
      await productDetailsPage.addToBag();
      await productDetailsPage.expectCartCount(1);
    });
  });

  test('CART-05 Increases the quantity and the total', async ({ productDetailsPage }) => {
    const cart = await productDetailsPage.openCart();
    await expect(cart.line(product.name)).toBeVisible();
    const [before] = await cart.readLines();
    const unitPrice = before?.price ?? 0;

    await test.step('Increase the quantity to 2', async () => {
      await cart.increaseQuantity(product.name);
      await expect(cart.lineQuantity(product.name)).toHaveText('2');
    });

    await test.step('Verify the estimated total doubles', async () => {
      await expect(cart.estimatedTotal).not.toHaveText(/^₹0/);
      await expect.poll(() => cart.readEstimatedTotal()).toBeCloseTo(unitPrice * 2, 2);
      expect(await cart.readEstimatedTotal()).toBeCloseTo(cartTotal(await cart.readLines()), 2);
    });
  });

  test('CART-06 Decreasing the last unit empties the bag', async ({ productDetailsPage }) => {
    const cart = await productDetailsPage.openCart();

    await test.step('Decrease the quantity from 1', async () => {
      await cart.decreaseQuantity(product.name);
    });

    await test.step('Verify the empty bag', async () => {
      await cart.expectEmpty();
      await productDetailsPage.expectCartCount(0);
    });
  });

  test('CART-07 Removes a line from the bag', async ({ productDetailsPage }) => {
    const cart = await productDetailsPage.openCart();

    await test.step('Click the bin icon', async () => {
      await cart.removeItem(product.name);
    });

    await test.step('Verify the empty bag', async () => {
      await cart.expectEmpty();
      await productDetailsPage.expectCartCount(0);
    });
  });

  test('CART-08 Keeps the bag after a page reload', async ({ productDetailsPage, page }) => {
    await test.step('Reload the page', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await productDetailsPage.expectLoaded(product);
    });

    await test.step('Verify the bag still holds the product', async () => {
      await productDetailsPage.expectCartCount(1);
      const cart = await productDetailsPage.openCart();
      await expect(cart.line(product.name)).toBeVisible();
    });
  });

  test('CART-09 Closes the drawer and keeps shopping', async ({ productDetailsPage }) => {
    const cart = await productDetailsPage.openCart();

    await test.step('Close the drawer', async () => {
      await cart.close();
    });

    await test.step('Verify the product page is usable and the bag is unchanged', async () => {
      await expect(productDetailsPage.addToBagButton).toBeVisible();
      await productDetailsPage.expectCartCount(1);
    });
  });

  test('CART-10 "Continue exploring" closes the empty bag', async ({ productDetailsPage, page }) => {
    const cart = await productDetailsPage.openCart();

    await test.step('Empty the bag', async () => {
      await cart.removeItem(product.name);
      await cart.expectEmpty();
    });

    await test.step('Click "Continue exploring"', async () => {
      await cart.continueExploringButton.click();
    });

    await test.step('Verify the drawer closes on the same page', async () => {
      await expect(cart.root).toBeHidden();
      await expect(page).toHaveURL(new RegExp(product.slug));
    });
  });
});

