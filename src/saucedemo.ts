import { expect, type Page } from '@playwright/test';
import { SAUCE } from './targets.js';

/** Log in through the UI and wait until the product list has actually rendered (it's an SPA). */
export async function login(page: Page): Promise<void> {
  await page.goto(SAUCE.url);
  await page.getByRole('textbox', { name: 'Username' }).fill(SAUCE.username);
  await page.getByRole('textbox', { name: 'Password' }).fill(SAUCE.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.locator('.inventory_list')).toBeVisible();
}

/** Wait for the side menu's 0.5 s slide transition to finish, so focus/geometry checks are stable. */
export async function waitForMenuToSettle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('.bm-menu-wrap')?.getAnimations().length === 0,
  );
}

/** Open the side menu the way a keyboard user would: focus the toggle and press Enter. */
export async function openMenuWithKeyboard(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open Menu' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'All Items' })).toBeFocused();
  await waitForMenuToSettle(page);
}
