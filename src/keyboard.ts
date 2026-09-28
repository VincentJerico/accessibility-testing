import type { Page } from '@playwright/test';

/**
 * Press Tab up to `maxTabs` times and report whether `selector` ever received focus.
 * Used to prove an element is (or isn't) reachable by keyboard.
 */
export async function reachableByTab(page: Page, selector: string, maxTabs = 40): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(
      (sel) => document.activeElement?.matches(sel) ?? false,
      selector,
    );
    if (focused) return true;
  }
  return false;
}

/** A readable description of the focused element, for assertion messages. */
export async function describeFocus(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return 'nothing';
    const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? '';
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}> "${name}"`;
  });
}

/**
 * WCAG 2.2 SC 2.4.11 (Focus Not Obscured, Minimum): the focused element must not be ENTIRELY
 * hidden by author-created content. Samples the element's four corners and centre with
 * elementFromPoint — if something else is on top at every point, it is entirely obscured.
 * axe-core has no rule for this criterion, which is why it's checked here.
 */
export async function isFocusEntirelyObscured(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const r = el.getBoundingClientRect();
    const inset = 2;
    const points: Array<[number, number]> = [
      [r.left + inset, r.top + inset],
      [r.right - inset, r.top + inset],
      [r.left + inset, r.bottom - inset],
      [r.right - inset, r.bottom - inset],
      [r.left + r.width / 2, r.top + r.height / 2],
    ];
    return points.every(([x, y]) => {
      const top = document.elementFromPoint(x, y);
      return top !== null && top !== el && !el.contains(top);
    });
  });
}
