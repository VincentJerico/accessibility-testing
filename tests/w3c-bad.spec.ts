import { test, expect } from '@playwright/test';
import { scan } from '../src/a11y.js';
import { W3C_BAD } from '../src/targets.js';

/**
 * W3C's Before-and-After demo: proves the suite catches real defects on the inaccessible version
 * and finds only the target-size gap (F-8) on the repaired one. See docs/FINDINGS.md.
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
    test(`${name}: fails WCAG 2.2 AA only on target size (2.5.8) [known gap F-8]`, async ({
      page,
    }) => {
      test.info().annotations.push({
        type: 'issue',
        description: 'F-8: the demo predates WCAG 2.2, so small targets fail SC 2.5.8',
      });
      await page.goto(url);
      expect((await scan(page)).map((v) => v.rule)).toEqual(['target-size']);
    });
  }
});
