import { test, expect } from '@playwright/test';
import { scan } from '../src/a11y.js';

/**
 * Guards against vacuous passes: an a11y suite that's green because axe scanned a blank page or a
 * redirect is worse than none. Plant known defects into a clean page and require each one to be
 * caught — and require the clean page itself to pass.
 */
const CLEAN = `<!doctype html>
<html lang="en">
  <head><title>Contact us</title></head>
  <body>
    <main>
      <h1>Contact us</h1>
      <p><label for="email">Email</label></p>
      <p><input id="email" type="email" /></p>
      <p><button type="submit" style="min-width: 48px; min-height: 48px">Send</button></p>
    </main>
  </body>
</html>`;

const PLANTED: [rule: string, html: string][] = [
  ['label', CLEAN.replace('<label for="email">Email</label>', '')],
  ['html-has-lang', CLEAN.replace(' lang="en"', '')],
  ['button-name', CLEAN.replace('>Send</button>', '></button>')],
  [
    'image-alt',
    CLEAN.replace(
      '<h1>Contact us</h1>',
      '<h1>Contact us</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />',
    ),
  ],
  [
    'color-contrast',
    CLEAN.replace(
      '<h1>Contact us</h1>',
      '<h1>Contact us</h1><p style="color:#ccc;background:#fff">Hard to read</p>',
    ),
  ],
];

test.describe('Scanner self-test @axe', () => {
  test('a clean page has no violations', async ({ page }) => {
    await page.setContent(CLEAN);
    expect(await scan(page)).toEqual([]);
  });

  for (const [rule, html] of PLANTED) {
    test(`a planted "${rule}" defect is detected`, async ({ page }) => {
      await page.setContent(html);
      expect((await scan(page)).map((v) => v.rule)).toContain(rule);
    });
  }
});
