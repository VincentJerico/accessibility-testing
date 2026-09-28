import { test, expect } from '@playwright/test';
import { login } from '../src/saucedemo.js';
import { SAUCE } from '../src/targets.js';

/**
 * Keyboard + semantics checks for what SauceDemo gets RIGHT. These are regression guards: if any of
 * them break, a keyboard or screen-reader user loses something that works today.
 */
test.describe('SauceDemo — keyboard & semantics that work @keyboard', () => {
  test('login fields and button are in a logical tab order', async ({ page }) => {
    await page.goto(SAUCE.url);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: 'Username' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Login' })).toBeFocused();
  });

  test('login can be completed entirely by keyboard', async ({ page }) => {
    await page.goto(SAUCE.url);
    await page.keyboard.press('Tab');
    await page.keyboard.type(SAUCE.username);
    await page.keyboard.press('Tab');
    await page.keyboard.type(SAUCE.password);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/inventory\.html/);
  });

  test('login errors are announced to screen readers (role="alert")', async ({ page }) => {
    await page.goto(SAUCE.url);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('alert')).toHaveText(/Username is required/);
  });

  test('a product can be added to the cart with Enter', async ({ page }) => {
    await login(page);
    const add = page.getByRole('button', { name: 'Add to cart' }).first();
    await add.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible();
  });

  test('the menu opens with Enter, moves focus into it and exposes its navigation', async ({
    page,
  }) => {
    await login(page);
    // The menu's <nav> is aria-hidden while closed, so the landmark only exists once it opens.
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open Menu' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'All Items' })).toBeFocused();
    await expect(page.getByRole('navigation')).toHaveCount(1);
  });

  test('pages expose banner, main and contentinfo landmarks', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
  });

  test('login form has the expected accessible structure', async ({ page }) => {
    await page.goto(SAUCE.url);
    await expect(page.locator('form')).toMatchAriaSnapshot(`
      - form "Login":
        - textbox "Username"
        - textbox "Password"
        - button "Login"
    `);
  });
});
