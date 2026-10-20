import { expect, type Page, type TestInfo } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * WCAG 2.2 AA = every Level A and AA criterion from WCAG 2.0, 2.1 and 2.2. axe tags each version
 * separately, so all five tags are needed. `best-practice` is deliberately excluded: it pulls in
 * non-WCAG rules (and some RGAA-only ones) that aren't conformance requirements.
 */
export const WCAG22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export interface ScanOptions {
  /** Skip regions you don't own, e.g. third-party widgets. */
  exclude?: string[];
}

export interface Violation {
  rule: string;
  impact: string | null | undefined;
  help: string;
  helpUrl: string;
  nodes: number;
  samples: string[];
}

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;

async function runAxe(page: Page, options: ScanOptions): Promise<AxeResults> {
  let builder = new AxeBuilder({ page }).withTags(WCAG22_AA);
  for (const selector of options.exclude ?? []) builder = builder.exclude(selector);
  return builder.analyze();
}

function toViolations(results: AxeResults): Violation[] {
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
    samples: v.nodes.slice(0, 3).map((n) => n.html),
  }));
}

function describe(violations: Violation[]): string {
  if (violations.length === 0) return 'no violations';
  return violations
    .map(
      (v) =>
        `• [${v.impact}] ${v.rule} — ${v.help} (${v.nodes} node${v.nodes === 1 ? '' : 's'})\n` +
        `  ${v.helpUrl}\n` +
        v.samples.map((html) => `    ${html}`).join('\n'),
    )
    .join('\n');
}

/** Run axe and return the violations — for tests that need to inspect which rules fired. */
export async function scan(page: Page, options: ScanOptions = {}): Promise<Violation[]> {
  return toViolations(await runAxe(page, options));
}

/**
 * Gate: fail the test if axe finds any WCAG 2.2 AA violation. The full axe results are attached
 * to the test report as an audit trail, and the failure message lists each rule with sample nodes.
 * Results axe could not decide ("needs review") don't fail the gate; they are counted in an
 * `axe-incomplete` annotation so a manual check isn't silently skipped.
 */
export async function expectNoViolations(
  page: Page,
  testInfo: TestInfo,
  options: ScanOptions = {},
): Promise<void> {
  const results = await runAxe(page, options);
  await testInfo.attach('axe-results.json', {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  if (results.incomplete.length > 0) {
    testInfo.annotations.push({
      type: 'axe-incomplete',
      description: results.incomplete.map((r) => `${r.id} (${r.nodes.length})`).join(', '),
    });
  }
  const violations = toViolations(results);
  expect(violations, `WCAG 2.2 AA violations:\n${describe(violations)}`).toEqual([]);
}
