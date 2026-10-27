import { Severity, severity } from 'allure-js-commons';
import { test, expect } from '../../fixtures/test-fixtures';
import { PaymentMethod } from '../../pages/CheckoutPage';
import { Products } from '../../test-data/products';
import { labelTest } from '../../utils/test-helpers';

// Signed-in, read-only checks: nothing here places an order. Needs the session from `npm run auth:login`.
test.describe('Customer account', { tag: '@account' }, () => {
  test.beforeEach(async () => {
    await labelTest({ feature: 'Account', story: 'Signed-in customer' });
  });

  test('ACC-01 Header account icon opens the profile', { tag: '@smoke' }, async ({ homePage, accountPage }) => {
    await severity(Severity.CRITICAL);

    await test.step('Open the store and click the account icon', async () => {
      await homePage.goto();
      await homePage.expectLoaded();
      await homePage.accountIcon.click();
    });

    await test.step('Verify the profile page instead of the sign in dialog', async () => {
      await accountPage.expectProfileLoaded();
      await expect(accountPage.signInDialog.root).toBeHidden();
      await expect(accountPage.ordersLink).toBeVisible();
      await expect(accountPage.addressBookLink).toBeVisible();
    });
  });

  test('ACC-02 Order history lists previous orders', async ({ accountPage }) => {
    await test.step('Open My Orders', async () => {
      await accountPage.gotoOrders();
      await accountPage.expectOrdersLoaded();
    });

    await test.step('Verify each order has a number and a status', async () => {
      const numbers = await accountPage.readOrderNumbers();
      expect(numbers.length).toBeGreaterThan(0);
      await expect(accountPage.orderStatus(numbers[0]!)).toHaveText(/^(Pending|Delivered|Cancelled|Returned|Exchanged|Shipped|Confirmed)/i);
    });
  });

  test('ACC-03 Checkout is prefilled and totals add up', async ({ productDetailsPage, checkoutPage }) => {
    const product = Products.muscleVest;

    await test.step('Make sure the bag has a product', async () => {
      await productDetailsPage.goto(product);
      await productDetailsPage.expectLoaded(product);
      const cart = await productDetailsPage.openCart();
      if ((await cart.line(product.name).count()) === 0) {
        await cart.close();
        await productDetailsPage.addToBag();
        await productDetailsPage.openCart();
      }
    });

    await test.step('Go to checkout from the bag', async () => {
      await productDetailsPage.cartDrawer.checkout();
      await checkoutPage.expectLoaded();
    });

    await test.step('Verify contact and shipping details come from the account', async () => {
      await checkoutPage.expectShippingDetailsFilled();
    });

    await test.step('Verify the summary arithmetic', async () => {
      const mrpTotal = await checkoutPage.readSummaryAmount('MRP Total');
      const subtotal = await checkoutPage.readSummaryAmount('Subtotal');
      const amountToPay = await checkoutPage.readSummaryAmount('Amount to Pay');
      expect(subtotal).toBeLessThanOrEqual(mrpTotal);
      if ((await checkoutPage.summaryValue('Product Discount').count()) > 0) {
        const discount = await checkoutPage.readSummaryAmount('Product Discount');
        expect(Math.abs(mrpTotal - discount - subtotal)).toBeLessThanOrEqual(1);
      }
      await expect(checkoutPage.summaryValue('Shipping Charge')).toHaveText(/FREE|₹/);
      expect(amountToPay).toBeGreaterThan(0);
    });

    await test.step('Switch payment to Cash on Delivery (no order is placed)', async () => {
      await checkoutPage.choosePayment(PaymentMethod.CashOnDelivery);
      await expect(checkoutPage.paymentOption(PaymentMethod.Upi)).not.toBeChecked();
    });
  });
});
