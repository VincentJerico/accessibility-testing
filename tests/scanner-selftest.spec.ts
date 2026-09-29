import { test, expect } from '@playwright/test';
import { expectNoViolations } from '../src/a11y.js';

/**
 * Guards against vacuous passes: an a11y suite that's green because axe scanned a blank page or a
 * redirect is worse than none. Plant known defects of mixed impact into a clean page and require
 * the gate to reject each one by rule name — and require it to pass the clean page itself.
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

const IMG = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />';

const PLANTED: [rule: string, impact: string, html: string][] = [
  ['label', 'critical', CLEAN.replace('<label for="email">Email</label>', '')],
  ['html-has-lang', 'serious', CLEAN.replace(' lang="en"', '')],
  ['button-name', 'critical', CLEAN.replace('>Send</button>', '></button>')],
  ['image-alt', 'critical', CLEAN.replace('<h1>Contact us</h1>', `<h1>Contact us</h1>${IMG}`)],
  [
    'color-contrast',
    'serious',
    CLEAN.replace(
      '<h1>Contact us</h1>',
      '<h1>Contact us</h1><p style="color:#ccc;background:#fff">Hard to read</p>',
    ),
  ],
  // A WCAG 2.1 rule, so the gate can't silently drop the wcag21a/wcag21aa tags.
  [
    'autocomplete-valid',
    'serious',
    CLEAN.replace('type="email" />', 'type="email" autocomplete="nonsense" />'),
  ],
];

test.describe('Scanner self-test @axe', () => {
  test('the gate passes a clean page', async ({ page }, testInfo) => {
    await page.setContent(CLEAN);
    await expectNoViolations(page, testInfo);
  });

  for (const [rule, impact, html] of PLANTED) {
    test(`the gate rejects a planted ${impact} "${rule}" defect`, async ({ page }, testInfo) => {
      await page.setContent(html);
      await expect(expectNoViolations(page, testInfo)).rejects.toThrow(`• [${impact}] ${rule} — `);
    });
  }

  test('the gate skips an excluded region', async ({ page }, testInfo) => {
    await page.setContent(CLEAN.replace('</main>', `</main><div id="third-party">${IMG}</div>`));
    await expect(expectNoViolations(page, testInfo)).rejects.toThrow('image-alt');
    await expectNoViolations(page, testInfo, { exclude: ['#third-party'] });
  });

  test('the gate counts needs-review results without failing on them', async ({
    page,
  }, testInfo) => {
    await page.setContent(
      CLEAN.replace(
        '<h1>Contact us</h1>',
        '<h1>Contact us</h1><p style="color:#777;background-image:linear-gradient(#fff,#eee)">Over a gradient</p>',
      ),
    );
    await expectNoViolations(page, testInfo);
    // Match the rule, not the exact list: newer axe versions may flag more nodes or rules here.
    const incomplete = testInfo.annotations.find((a) => a.type === 'axe-incomplete');
    expect(incomplete?.description).toMatch(/\bcolor-contrast \(\d+\)/);
  });
});
