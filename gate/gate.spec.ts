import { test, expect } from '@playwright/test';
import { expectNoViolations } from '../src/a11y.ts';
import { walkTabStops } from '../src/keyboard.ts';

/**
 * Reusable gate, driven by environment variables so any repo can point it at its own pages:
 *   A11Y_URLS      URLs to scan, separated by commas or new lines (required)
 *   A11Y_EXCLUDE   CSS selectors axe should skip, e.g. third-party widgets (comma-separated)
 *   A11Y_KEYBOARD  "false" turns off the keyboard checks (default on)
 * Each URL gets an axe WCAG 2.2 AA scan and, unless turned off, a keyboard walk: every tab stop
 * shows a visible focus indicator (2.4.7) and Tab never gets stuck (2.1.2).
 */
const list = (value: string | undefined) =>
  (value ?? '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

const urls = list(process.env.A11Y_URLS);
const exclude = list(process.env.A11Y_EXCLUDE);
const keyboard = process.env.A11Y_KEYBOARD !== 'false';

test('A11Y_URLS lists at least one page', () => {
  expect(urls, 'set A11Y_URLS to the pages to scan').not.toHaveLength(0);
});

for (const url of urls) {
  test.describe(url, () => {
    test('axe: no WCAG 2.2 AA violations @axe', async ({ page }, testInfo) => {
      const res = await page.goto(url);
      expect(res?.ok(), `${url} answered ${res?.status()}`).toBe(true);
      await expectNoViolations(page, testInfo, { exclude });
    });

    if (keyboard) {
      test('keyboard: visible focus on every tab stop, no keyboard trap @keyboard', async ({
        page,
      }) => {
        const res = await page.goto(url);
        expect(res?.ok(), `${url} answered ${res?.status()}`).toBe(true);
        const { stops, trapped } = await walkTabStops(page);
        expect(trapped, `keyboard trap: Tab stays on ${trapped}`).toBeUndefined();
        const invisible = stops.filter((s) => !s.focusVisible).map((s) => s.description);
        expect(invisible, `no visible focus indicator on: ${invisible.join(', ')}`).toEqual([]);
      });
    }
  });
}
