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

/** Wait for finite CSS transitions/animations, so focus styles are read when they've settled. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

export interface TabStop {
  description: string;
  /** False when the element looks the same focused and unfocused (WCAG 2.4.7). */
  focusVisible: boolean;
}

/**
 * Walk the page with Tab, up to `maxStops` distinct elements, and check each one shows a visible
 * focus indicator: a screenshot of the element plus a margin (outlines are drawn outside the box)
 * must differ between focused and blurred. Also reports a keyboard trap (WCAG 2.1.2): Tab pressed
 * three times in a row without focus moving, while the page has more than one focusable element.
 * Generic on purpose, for the reusable gate: it knows nothing about the page under test.
 */
export async function walkTabStops(
  page: Page,
  maxStops = 15,
): Promise<{ stops: TabStop[]; trapped?: string }> {
  const stops: TabStop[] = [];
  const seen: unknown[] = [];
  let stuck = 0;
  for (let press = 0; press < maxStops * 3 && stops.length < maxStops; press++) {
    await page.keyboard.press('Tab');
    const handle = await page.evaluateHandle(() => document.activeElement);
    const isBody = await handle.evaluate((el) => el === null || el === document.body);
    if (isBody) continue;

    const matches = await Promise.all(
      seen.map((s) => handle.evaluate((el, other) => el === other, s)),
    );
    if (matches.at(-1)) {
      // Tab left focus where it was. A real page moves on (or out to the browser UI, i.e. <body>).
      if (++stuck >= 2) return { stops, trapped: await describeFocus(page) };
      continue;
    }
    if (matches.includes(true)) break; // back at an earlier stop: the walk wrapped around
    stuck = 0;
    seen.push(handle);

    await settle(page);
    const box = await handle.asElement()?.boundingBox();
    if (!box || box.width === 0 || box.height === 0) continue;
    const pad = 8;
    const clip = {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    };
    const focused = await page.screenshot({ clip });
    await handle.evaluate((el) => (el as HTMLElement).blur());
    await settle(page);
    const blurred = await page.screenshot({ clip });
    await handle.evaluate((el) => (el as HTMLElement).focus());
    stops.push({ description: await describeFocus(page), focusVisible: !focused.equals(blurred) });
  }
  return { stops };
}
