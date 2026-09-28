import { test, expect } from '@playwright/test';
import { expectNoViolations, scan } from '../src/a11y.js';
import { W3C_BAD } from '../src/targets.js';

/**
 * W3C's Before-and-After demo: proves the suite catches real defects on the inaccessible version
 * and passes the repaired one. See docs/FINDINGS.md for the full comparison.
 */
test.describe('W3C BAD — inaccessible "before" site @axe', () => {
  test('home: detects missing alt text, missing lang, empty links and unlabeled selects', async ({
    page,
  }) => {
    await page.goto(W3C_BAD.before.home);
    const rules = (await scan(page)).map((v) => v.rule);
    expect(rules).toEqual(
      expect.arrayContaining(['image-alt', 'html-has-lang', 'link-name', 'select-name']),
    );
  });

  test('survey: detects unlabeled form fields', async ({ page }) => {
    await page.goto(W3C_BAD.before.survey);
    const rules = (await scan(page)).map((v) => v.rule);
    expect(rules).toEqual(expect.arrayContaining(['label', 'image-alt']));
  });
});

test.describe('W3C BAD — repaired "after" site @axe', () => {
  for (const [name, url] of Object.entries(W3C_BAD.after)) {
    test(`${name}: passes WCAG 2.2 AA apart from the documented target-size gap`, async ({
      page,
    }, testInfo) => {
      await page.goto(url);
      // target-size (WCAG 2.2 SC 2.5.8) is excluded here ONLY because it is tracked on its own
      // below as finding F-8: the demo was built before WCAG 2.2 existed.
      await expectNoViolations(page, testInfo, { disableRules: ['target-size'] });
    });
  }

  test('home meets WCAG 2.2 target size (2.5.8) [known gap F-8]', async ({ page }, testInfo) => {
    test.fail(true, 'F-8: the demo predates WCAG 2.2 — small targets fail SC 2.5.8');
    await page.goto(W3C_BAD.after.home);
    await expectNoViolations(page, testInfo);
  });
});
