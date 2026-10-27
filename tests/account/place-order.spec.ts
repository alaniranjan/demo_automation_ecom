import { Severity } from 'allure-js-commons';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../../fixtures/test-fixtures';
import { PaymentMethod, type CouponResult } from '../../pages/CheckoutPage';
import { Products } from '../../test-data/products';
import { cartTotal, labelTest } from '../../utils/test-helpers';

// Places a REAL Cash on Delivery order on the signed-in account. Runs only through `npm run test:order`
// (never in the normal, smoke or regression suites). It empties the account's bag first so exactly one known
// product is ordered, then follows the order from the bag to the order details page in My Account.

/** Full-page screenshot attached to the report (Allure, Playwright HTML and the dashboard) under `name`. */
async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

const near = (actual: number, expected: number, tolerance = 1) => Math.abs(actual - expected) <= tolerance;

test.describe('Place order', { tag: ['@order', '@e2e'] }, () => {
  test('ORD-01 Signed-in customer places a Cash on Delivery order', async ({
    productDetailsPage,
    checkoutPage,
    orderConfirmationPage,
    accountPage,
    orderDetailsPage,
    page,
  }, testInfo) => {
    test.setTimeout(6 * 60_000);
    await labelTest({ feature: 'Business workflow', story: 'Place order', severity: Severity.BLOCKER });
    const product = Products.muscleVest;
    const size = 'M';
    let bagTotal = 0;
    let amountToPay = 0;
    let coupon: CouponResult | undefined;
    let orderId = '';
    let deliveryCity = '';

    await test.step('1. Empty the bag', async () => {
      await productDetailsPage.goto(product);
      await productDetailsPage.expectLoaded(product);
      const cart = await productDetailsPage.openCart();
      await cart.removeAll();
      await cart.expectEmpty();
      await cart.close();
      await productDetailsPage.expectCartCount(0);
    });

    await test.step(`2. Add "${product.name}" in size ${size}`, async () => {
      await productDetailsPage.selectSize(size);
      await productDetailsPage.addToBag();
      await productDetailsPage.expectCartCount(1);
    });

    await test.step('3. Verify the bag calculation', async () => {
      const cart = await productDetailsPage.openCart();
      await cart.expectItemCount(1);
      await expect(cart.line(product.name)).toContainText(`Size: ${size}`);
      const lines = await cart.readLines();
      bagTotal = await cart.readEstimatedTotal();
      const mrpTotal = (await cart.readLineMrps()).reduce((sum, mrp) => sum + mrp, 0);

      expect(lines, 'one line, quantity 1').toEqual([expect.objectContaining({ name: product.name, quantity: 1 })]);
      expect(bagTotal, 'estimated total = sum of line price x quantity').toBeCloseTo(cartTotal(lines), 2);
      expect(await cart.readEstimatedMrp(), "estimated MRP = sum of line MRPs").toBeCloseTo(mrpTotal, 2);
      if (mrpTotal > bagTotal) {
        await expect(cart.savedSoFar, 'saved = MRP - total').toContainText((mrpTotal - bagTotal).toFixed(2));
      }
      await capture(page, testInfo, '01-cart');
    });

    await test.step('4. Check out', async () => {
      await productDetailsPage.cartDrawer.checkout();
      await checkoutPage.expectLoaded();
      await checkoutPage.expectShippingDetailsFilled();
      deliveryCity = await checkoutPage.city.inputValue();
    });

    await test.step('5. Verify the checkout calculation', async () => {
      expect(await checkoutPage.readSummaryLines()).toEqual([{ name: product.name, size, quantity: 1 }]);
      const mrpTotal = await checkoutPage.readSummaryAmount('MRP Total');
      const productDiscount = await checkoutPage.readSummaryAmount('Product Discount');
      const subtotal = await checkoutPage.readSummaryAmount('Subtotal');
      amountToPay = await checkoutPage.readSummaryAmount('Amount to Pay');
      const shippingFree = /free/i.test(await checkoutPage.summaryValue('Shipping Charge').innerText());

      expect(near(mrpTotal - productDiscount, subtotal), `MRP ${mrpTotal} - discount ${productDiscount} = subtotal ${subtotal}`).toBe(true);
      expect(shippingFree, 'free delivery on this order').toBe(true);
      expect(near(amountToPay, subtotal), `amount to pay ${amountToPay} = subtotal ${subtotal}`).toBe(true);
      expect(near(amountToPay, bagTotal), `checkout ${amountToPay} matches the bag ${bagTotal}`).toBe(true);
    });

    await test.step('6. Apply a voucher if the order qualifies, otherwise skip', async () => {
      const attempts = await checkoutPage.applyFirstEligibleVoucher();
      coupon = attempts.find((attempt) => attempt.applied);
      if (attempts.length === 0) {
        testInfo.annotations.push({ type: 'coupon', description: 'No vouchers offered; skipped' });
      }
      for (const attempt of attempts) {
        testInfo.annotations.push({ type: 'coupon', description: `${attempt.code}: ${attempt.applied ? 'applied' : attempt.message}` });
      }
      if (coupon) {
        await expect
          .poll(() => checkoutPage.readSummaryAmount('Amount to Pay'), { message: `"${coupon.code}" lowers the amount to pay` })
          .toBeLessThan(amountToPay);
        amountToPay = await checkoutPage.readSummaryAmount('Amount to Pay');
      } else {
        // No voucher accepted (or none offered): the total must be unchanged.
        expect(await checkoutPage.readSummaryAmount('Amount to Pay')).toBe(amountToPay);
      }
    });

    await test.step('7. Pay on delivery', async () => {
      await checkoutPage.choosePayment(PaymentMethod.CashOnDelivery);
      await capture(page, testInfo, '02-checkout');
    });

    // ORDER_DRY_RUN=true checks everything up to the Place order button without creating an order.
    if (process.env.ORDER_DRY_RUN === 'true') {
      testInfo.annotations.push({ type: 'dry-run', description: 'Stopped before "Place order"; no order was created' });
      return;
    }

    await test.step('8. Place the order and read the order ID on the thank-you page', async () => {
      await checkoutPage.placeOrder();
      await orderConfirmationPage.expectLoaded();
      orderId = await orderConfirmationPage.readOrderId();
      expect(orderId, 'order ID on the thank-you page').toMatch(/^ORD[A-Z]*\d+$/);
      testInfo.annotations.push({ type: 'order', description: orderId });
      testInfo.annotations.push({ type: 'thank-you-url', description: page.url() });
      await expect(orderConfirmationPage.paymentMethod).toHaveText(/pay on delivery/i);
      const finalAmount = await orderConfirmationPage.readFinalAmount();
      expect(near(finalAmount, amountToPay), `thank-you final amount ${finalAmount} = checkout ${amountToPay}`).toBe(true);
      await capture(page, testInfo, '03-thank-you');
    });

    await test.step('9. Find the order in My Account > Orders', async () => {
      await accountPage.gotoOrders();
      await accountPage.expectOrdersLoaded();
      const newest = (await accountPage.readOrderNumbers())[0] ?? '';
      expect(newest, 'the new order is listed first').toBe(`#${orderId}`);
      await expect(accountPage.orderStatus(newest)).toHaveText(/pending|confirmed|placed/i);
    });

    await test.step('10. Open the order and verify its details', async () => {
      await accountPage.page.getByText(`#${orderId}`, { exact: true }).click();
      await orderDetailsPage.expectLoaded(orderId);
      const details = await orderDetailsPage.read();

      expect(details.orderId, 'order ID matches the thank-you page').toBe(orderId);
      expect(details.itemText).toContain(product.name);
      expect(details.itemText).toContain(`Size: ${size}`);
      expect(details.itemText).toMatch(/\b1 X\b/);
      expect(
        near(details.totalAmount - details.discount, details.amountPayable),
        `total ${details.totalAmount} - discount ${details.discount} = payable ${details.amountPayable}`,
      ).toBe(true);
      expect(near(details.amountPayable, amountToPay), `payable ${details.amountPayable} = checkout ${amountToPay}`).toBe(true);
      expect(details.status).toMatch(/pending|confirmed/i);
      await expect(orderDetailsPage.detail('Deliver to')).toContainText(deliveryCity);
      await expect(orderDetailsPage.detail('Payment')).toHaveText(/pay on delivery/i);
      await expect(orderDetailsPage.detail('Payment status')).toHaveText(/not paid/i);
      await capture(page, testInfo, '04-order-details');
    });
  });
});
