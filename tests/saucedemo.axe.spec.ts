import { test, expect } from '@playwright/test';
import { expectNoViolations } from '../src/a11y.js';
import { login } from '../src/saucedemo.js';
import { SAUCE } from '../src/targets.js';

/**
 * Automated WCAG 2.2 AA scan of every SauceDemo page — including interactive states (error shown,
 * menu open, validation error), which carry different markup than the default page load.
 * All of these pass; the defects axe cannot see are in saucedemo.known-issues.spec.ts.
 */
test.describe('SauceDemo — automated scan @axe', () => {
  test('login', async ({ page }, testInfo) => {
    await page.goto(SAUCE.url);
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expectNoViolations(page, testInfo);
  });

  test('login with a validation error shown', async ({ page }, testInfo) => {
    await page.goto(SAUCE.url);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoViolations(page, testInfo);
  });

  test('inventory', async ({ page }, testInfo) => {
    await login(page);
    await expectNoViolations(page, testInfo);
  });

  test('inventory with the menu open', async ({ page }, testInfo) => {
    await login(page);
    await page.getByRole('button', { name: 'Open Menu' }).click();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expectNoViolations(page, testInfo);
  });

  test('product detail', async ({ page }, testInfo) => {
    await login(page);
    await page.goto(`${SAUCE.url}/inventory-item.html?id=4`);
    await expect(page.locator('.inventory_details_name')).toHaveText('Sauce Labs Backpack');
    await expectNoViolations(page, testInfo);
  });

  test('cart', async ({ page }, testInfo) => {
    await login(page);
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.goto(`${SAUCE.url}/cart.html`);
    await expect(page.locator('.cart_item')).toBeVisible();
    await expectNoViolations(page, testInfo);
  });

  test('checkout information with a validation error', async ({ page }, testInfo) => {
    await login(page);
    await page.goto(`${SAUCE.url}/checkout-step-one.html`);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('[data-test="error"]')).toBeVisible();
    await expectNoViolations(page, testInfo);
  });

  test('checkout overview and completion', async ({ page }, testInfo) => {
    await login(page);
    await page.goto(`${SAUCE.url}/checkout-step-one.html`);
    await page.locator('[data-test="firstName"]').fill('Vincent');
    await page.locator('[data-test="lastName"]').fill('Jerico');
    await page.locator('[data-test="postalCode"]').fill('1000');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('.summary_info')).toBeVisible();
    await expectNoViolations(page, testInfo);

    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.getByText('Thank you for your order!')).toBeVisible();
    await expectNoViolations(page, testInfo);
  });
});
