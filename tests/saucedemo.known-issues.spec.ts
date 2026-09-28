import { test, expect } from '@playwright/test';
import { describeFocus, isFocusEntirelyObscured, reachableByTab } from '../src/keyboard.js';
import { login, openMenuWithKeyboard, waitForMenuToSettle } from '../src/saucedemo.js';
import { SAUCE } from '../src/targets.js';

/**
 * Defects axe does NOT report (it finds 0 violations on every SauceDemo page) but a keyboard and
 * manual audit does. Each test asserts the CORRECT behavior and is marked test.fail(): it passes
 * while the defect exists, and Playwright flags an unexpected pass the day it gets fixed.
 * Details, evidence and recommendations: docs/FINDINGS.md.
 */
test.describe('SauceDemo — findings axe cannot detect', () => {
  test('F-1 · the cart is reachable by keyboard (WCAG 2.1.1, Level A) @keyboard', async ({
    page,
  }) => {
    test.fail(
      true,
      'F-1: cart is an <a role="button"> with no href/tabindex — announced, never focusable',
    );
    await login(page);
    expect(await reachableByTab(page, '.shopping_cart_link')).toBe(true);
  });

  test('F-2 · the login button shows a visible focus indicator (WCAG 2.4.7, AA) @keyboard', async ({
    page,
  }) => {
    test.fail(true, 'F-2: outline is removed and nothing replaces it — focused looks identical');
    await page.goto(SAUCE.url);
    const button = page.getByRole('button', { name: 'Login' });
    const unfocused = await button.screenshot();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    const focused = await button.screenshot();

    expect(focused.equals(unfocused), 'focused and unfocused button render identically').toBe(
      false,
    );
  });

  test('F-3 · the menu button exposes its expanded state (WCAG 4.1.2, Level A)', async ({
    page,
  }) => {
    test.fail(true, 'F-3: no aria-expanded / aria-controls on the menu toggle');
    await login(page);
    await expect(page.getByRole('button', { name: 'Open Menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
      { timeout: 2_000 },
    );
  });

  test('F-4 · closing the menu with Escape returns focus to its button (WCAG 2.4.3, Level A) @keyboard', async ({
    page,
  }) => {
    test.fail(true, 'F-4: after Escape, focus is dropped to <body>');
    await login(page);
    await openMenuWithKeyboard(page);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation')).toHaveCount(0);
    // Wait for the close animation: focus briefly touches the toggle, then drops to <body>.
    await waitForMenuToSettle(page);
    await expect(page.getByRole('button', { name: 'Open Menu' })).toBeFocused({ timeout: 2_000 });
  });

  test('F-5 · the page title "Products" is a real heading (WCAG 1.3.1, Level A)', async ({
    page,
  }) => {
    test.fail(
      true,
      'F-5: styled like a heading but marked up as a <span>; the page has no headings at all',
    );
    await login(page);
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible({ timeout: 2_000 });
  });

  test('F-6 · login fields have visible labels, not just placeholders (WCAG 3.3.2, Level A)', async ({
    page,
  }) => {
    test.fail(true, 'F-6: the only visible cue is placeholder text, which disappears on typing');
    await page.goto(SAUCE.url);
    await expect(page.locator('label[for="user-name"]')).toBeVisible({ timeout: 2_000 });
    await expect(page.locator('label[for="password"]')).toBeVisible({ timeout: 2_000 });
  });

  test('F-7 · focus never lands on a control hidden behind the open menu (WCAG 2.4.11, AA) @keyboard', async ({
    page,
  }) => {
    test.fail(
      true,
      'F-7: focus is not contained — Tab walks behind the menu panel onto covered links',
    );
    await login(page);
    await openMenuWithKeyboard(page);

    for (let tab = 1; tab <= 10; tab++) {
      await page.keyboard.press('Tab');
      const obscured = await isFocusEntirelyObscured(page);
      expect(obscured, `Tab ${tab}: ${await describeFocus(page)} is entirely hidden`).toBe(false);
    }
  });
});
