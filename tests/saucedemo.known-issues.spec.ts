import { test, expect } from '@playwright/test';
import { describeFocus, isFocusEntirelyObscured, reachableByTab } from '../src/keyboard.js';
import { login, openMenuWithKeyboard, waitForMenuToSettle } from '../src/saucedemo.js';
import { SAUCE } from '../src/targets.js';

/**
 * Defects axe's WCAG-tagged rules do NOT report (0 violations on every SauceDemo page) but a
 * keyboard and manual audit does. F-5 is the exception worth knowing: axe's best-practice rule
 * page-has-heading-one, which the WCAG 2.2 AA gate leaves out, does flag it.
 *
 * Each test pins the CURRENT defective behavior and carries an `issue` annotation, so it goes red
 * the day the defect is fixed and on any unrelated failure. Each negative pin sits behind a
 * presence check, so a wrong selector can't make it pass.
 * Details, evidence and recommendations: docs/FINDINGS.md.
 */
test.describe('SauceDemo — findings axe cannot detect', () => {
  test('F-1 · the cart is not reachable by keyboard (WCAG 2.1.1, Level A) @keyboard', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'issue',
      description:
        'F-1: cart is an <a role="button"> with no href/tabindex, announced but never focusable',
    });
    await login(page);
    await expect(page.locator('.shopping_cart_link')).toBeVisible();
    expect(await reachableByTab(page, '.shopping_cart_link')).toBe(false);
  });

  test('F-2 · the login button shows no visible focus indicator (WCAG 2.4.7, AA) @keyboard', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'issue',
      description: 'F-2: outline is removed and nothing replaces it, so focused looks identical',
    });
    await page.goto(SAUCE.url);
    const button = page.getByRole('button', { name: 'Login' });
    const unfocused = await button.screenshot();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    const focused = await button.screenshot();

    expect(focused.equals(unfocused), 'focused and unfocused button render identically').toBe(true);
  });

  test('F-3 · the menu button does not expose its expanded state (WCAG 4.1.2, Level A)', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'issue',
      description: 'F-3: no aria-expanded / aria-controls on the menu toggle',
    });
    await login(page);
    const toggle = page.getByRole('button', { name: 'Open Menu' });
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toHaveAttribute('aria-expanded');
    await expect(toggle).not.toHaveAttribute('aria-controls');
  });

  test('F-4 · closing the menu with Escape drops focus to <body> (WCAG 2.4.3, Level A) @keyboard', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'issue',
      description: 'F-4: after Escape, focus is dropped to <body> instead of the menu toggle',
    });
    await login(page);
    await openMenuWithKeyboard(page);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation')).toHaveCount(0);
    // Wait for the close animation: focus briefly touches the toggle, then drops to <body>.
    await waitForMenuToSettle(page);
    await expect(page.locator('body')).toBeFocused();
  });

  test('F-5 · the page title "Products" is not a heading (WCAG 1.3.1, Level A)', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'issue',
      description: 'F-5: styled like a heading but marked up as a <span>; the page has no headings',
    });
    await login(page);
    await expect(page.locator('.title')).toHaveText('Products');
    await expect(page.getByRole('heading')).toHaveCount(0);
  });

  test('F-6 · login fields have placeholders but no visible labels (WCAG 3.3.2, Level A)', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'issue',
      description: 'F-6: the only visible cue is placeholder text, which disappears on typing',
    });
    await page.goto(SAUCE.url);
    await expect(page.locator('#user-name')).toHaveAttribute('placeholder', 'Username');
    await expect(page.locator('#password')).toHaveAttribute('placeholder', 'Password');
    await expect(page.locator('label')).toHaveCount(0);
  });

  test('F-7 · Tab moves focus onto a link hidden behind the open menu (WCAG 2.4.11, AA) @keyboard', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'issue',
      description:
        'F-7: focus is not contained, so Tab walks behind the menu panel onto covered links',
    });
    await login(page);
    await openMenuWithKeyboard(page);

    const focusPath: { focus: string; obscured: boolean }[] = [];
    for (let tab = 1; tab <= 10; tab++) {
      await page.keyboard.press('Tab');
      focusPath.push({
        focus: await describeFocus(page),
        obscured: await isFocusEntirelyObscured(page),
      });
    }
    expect(focusPath.filter((step) => step.obscured).map((step) => step.focus)).toEqual([
      '<a#item_4_img_link> "View details for Sauce Labs Backpack"',
    ]);
  });
});
