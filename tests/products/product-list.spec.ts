import { Severity, severity } from 'allure-js-commons';
import { test, expect } from '../../fixtures/test-fixtures';
import { Categories, SubCategories } from '../../test-data/products';
import { labelTest } from '../../utils/test-helpers';

test.describe('Product listing', { tag: '@regression' }, () => {
  test.beforeEach(async () => {
    await labelTest({ feature: 'Products', story: 'Listing' });
  });

  for (const [index, category] of Object.values(Categories).entries()) {
    test(`PLP-0${index + 1} Shows the "${category.linkText}" listing with a product count`, async ({ productListPage }) => {
      await test.step(`Open ${category.path}`, async () => {
        await productListPage.goto(category);
        await productListPage.expectLoaded(category);
      });

      await test.step('Verify the count and that the grid is populated', async () => {
        const total = await productListPage.readProductCount();
        expect(total).toBeGreaterThan(0);
        const shown = await productListPage.productCards.count();
        expect(shown).toBeGreaterThan(0);
        expect(shown).toBeLessThanOrEqual(total);
      });
    });
  }

  test('PLP-05 Every card shows a name, sale price, MRP and matching discount', { tag: '@smoke' }, async ({ menListingPage }) => {
    await severity(Severity.CRITICAL);
    const count = Math.min(await menListingPage.productCards.count(), 10);

    for (let index = 0; index < count; index++) {
      await test.step(`Verify card ${index + 1}`, async () => {
        const card = await menListingPage.readCard(menListingPage.card(index));
        expect(card.name, 'product name').not.toBe('');
        expect(card.price, `${card.name}: sale price`).toBeGreaterThan(0);
        expect(card.price, `${card.name}: sale price <= MRP`).toBeLessThanOrEqual(card.mrp);
        // The badge is rounded to whole percents, but some cards show two decimals (e.g. "20.01 off").
        const actualDiscount = ((card.mrp - card.price) / card.mrp) * 100;
        expect(Math.abs(actualDiscount - card.discount), `${card.name}: discount badge`).toBeLessThanOrEqual(1);
      });
    }
  });

  test('PLP-06 Opens the product page from a card', async ({ menListingPage, productDetailsPage }) => {
    const card = menListingPage.card(0);
    const { name, price } = await menListingPage.readCard(card);

    await test.step(`Open "${name}"`, async () => {
      await menListingPage.openProduct(card);
    });

    await test.step('Verify the details match the card', async () => {
      await productDetailsPage.expectLoaded();
      await expect(productDetailsPage.productName).toHaveText(name);
      expect((await productDetailsPage.readPricing()).price).toBe(price);
    });
  });

  test('PLP-07 Adds a product to the bag straight from the listing', async ({ menListingPage }) => {
    const card = menListingPage.card(0);

    await test.step('Click "Add to cart" on the first card', async () => {
      await menListingPage.expectCartCount(0);
      await menListingPage.quickAdd(card);
    });

    await test.step('Verify the card shows quantity 1 and the bag badge updates', async () => {
      await expect(card.getByText('1', { exact: true })).toBeVisible();
      await menListingPage.expectCartCount(1);
    });
  });

  test('PLP-08 Loads more products on scroll', async ({ menListingPage }) => {
    const total = await menListingPage.readProductCount();
    const firstPage = await menListingPage.productCards.count();

    await test.step('Scroll to the end of the grid', async () => {
      await menListingPage.scrollToLoadMore();
    });

    await test.step('Verify more cards are shown, never more than the total', async () => {
      const shown = await menListingPage.productCards.count();
      expect(shown).toBeGreaterThan(firstPage);
      expect(shown).toBeLessThanOrEqual(total);
    });
  });

  test('PLP-09 Sub-collection lists a subset of its parent', async ({ productListPage }) => {
    let parentTotal = 0;

    await test.step(`Read the "${Categories.men.linkText}" total`, async () => {
      await productListPage.goto(Categories.men);
      await productListPage.expectLoaded(Categories.men);
      parentTotal = await productListPage.readProductCount();
    });

    await test.step(`Open "${SubCategories.menTopWear.linkText}"`, async () => {
      await productListPage.goto(SubCategories.menTopWear);
      await productListPage.expectLoaded(SubCategories.menTopWear);
    });

    await test.step('Verify it has fewer products than the parent', async () => {
      const subTotal = await productListPage.readProductCount();
      expect(subTotal).toBeGreaterThan(0);
      expect(subTotal).toBeLessThan(parentTotal);
    });
  });

  test('PLP-10 Card stepper changes the quantity of that product', async ({ menListingPage }) => {
    const card = menListingPage.card(0);

    await test.step('Quick add the first product', async () => {
      await menListingPage.quickAdd(card);
      await expect(menListingPage.cardQuantity(card)).toHaveText('1');
    });

    await test.step('Increase to 2', async () => {
      await menListingPage.increaseCardQuantity(card);
      await expect(menListingPage.cardQuantity(card)).toHaveText('2');
      // The badge counts distinct products in the bag, not units.
      await menListingPage.expectCartCount(1);
    });

    await test.step('Decrease back to 1', async () => {
      await menListingPage.decreaseCardQuantity(card);
      await expect(menListingPage.cardQuantity(card)).toHaveText('1');
    });
  });

  test('PLP-11 Bag quantity matches the card stepper', async ({ menListingPage }) => {
    const card = menListingPage.card(0);
    const { name } = await menListingPage.readCard(card);

    await test.step('Add the product twice with the stepper', async () => {
      await menListingPage.quickAdd(card);
      await menListingPage.increaseCardQuantity(card);
      await expect(menListingPage.cardQuantity(card)).toHaveText('2');
    });

    await test.step('Verify the bag line shows quantity 2', async () => {
      const cart = await menListingPage.openCart();
      await expect(cart.lineQuantity(name)).toHaveText('2');
    });
  });
});

