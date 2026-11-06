import type { RunSummary, TestRecord } from './summary.ts';

/** Hidden marker the PR-comment job uses to find and update its own comment. */
export const COMMENT_MARKER = '<!-- a11y-report -->';

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const firstLine = (s: string | undefined) => (s ?? '').split('\n')[0]!.slice(0, 160);

/** Markdown for the job summary and the PR comment. */
export function toMarkdown(summary: RunSummary): string {
  const { tests, totals } = summary;
  const failed = tests.filter((t) => t.status === 'failed');
  const pinned = tests.filter((t) => t.finding);
  const keyboard = tests.filter((t) => t.tags.includes('@keyboard'));
  const verdict = totals.failed === 0 ? 'PASS' : 'FAIL';

  const lines = [
    COMMENT_MARKER,
    `### Accessibility run: ${verdict}`,
    '',
    '| Passed | Failed | Flaky | Skipped |',
    '| -----: | -----: | ----: | ------: |',
    `| ${totals.passed} | ${totals.failed} | ${totals.flaky} | ${totals.skipped} |`,
  ];

  if (failed.length > 0) {
    lines.push('', '#### Failing tests', '', '| Test | Finding | Reason |', '| --- | --- | --- |');
    for (const t of failed) {
      lines.push(`| ${cell(t.id)} | ${t.finding ?? ''} | ${cell(reason(t))} |`);
    }
  }

  const violations = failed.flatMap((t) => t.violations);
  if (violations.length > 0) {
    lines.push(
      '',
      '#### axe violations (WCAG 2.2 AA)',
      '',
      '| Rule | Impact | Nodes | Help |',
      '| --- | --- | --: | --- |',
    );
    for (const v of byRule(violations)) {
      lines.push(
        `| \`${v.rule}\` | ${v.impact ?? ''} | ${v.nodes} | [${cell(v.help)}](${v.helpUrl}) |`,
      );
    }
  }

  if (pinned.length > 0) {
    lines.push('', '#### Pinned findings', '', '| Finding | Test | State |', '| --- | --- | --- |');
    for (const t of pinned) {
      const state =
        t.status === 'passed'
          ? 'still present, as pinned'
          : t.status === 'failed'
            ? '**changed**: fixed, or the pin broke'
            : t.status;
      lines.push(`| ${t.finding} | ${cell(t.title)} | ${state} |`);
    }
  }

  if (keyboard.length > 0) {
    const ok = keyboard.filter((t) => t.status === 'passed').length;
    lines.push('', `Keyboard checks: ${ok} of ${keyboard.length} passed.`);
  }

  const needsReview = incompleteByRule(tests);
  if (needsReview.length > 0) {
    lines.push('', `axe could not decide (check by hand): ${needsReview.join(', ')}.`);
  }

  if (summary.runUrl) lines.push('', `[Full report and axe JSON](${summary.runUrl})`);
  return lines.join('\n') + '\n';
}

/** "color-contrast (8 nodes)": entries look like "rule (n)", one per scan, summed per rule. */
function incompleteByRule(tests: readonly TestRecord[]): string[] {
  const nodes = new Map<string, number>();
  for (const entry of tests.flatMap((t) => t.incomplete)) {
    const [, rule = entry, n = '0'] = entry.match(/^(.+?) \((\d+)\)$/) ?? [];
    nodes.set(rule, (nodes.get(rule) ?? 0) + Number(n));
  }
  return [...nodes].map(([rule, n]) => `${rule} (${n} node${n === 1 ? '' : 's'})`);
}

function reason(t: TestRecord): string {
  if (t.violations.length > 0) {
    return `${t.violations.length} axe rule(s): ${t.violations.map((v) => v.rule).join(', ')}`;
  }
  return firstLine(t.error);
}

/** One row per rule: worst impact, total nodes. */
function byRule(violations: TestRecord['violations']) {
  const rank = ['minor', 'moderate', 'serious', 'critical'];
  const rules = new Map<string, TestRecord['violations'][number]>();
  for (const v of violations) {
    const seen = rules.get(v.rule);
    if (!seen) {
      rules.set(v.rule, { ...v });
    } else {
      seen.nodes += v.nodes;
      if (rank.indexOf(v.impact ?? '') > rank.indexOf(seen.impact ?? '')) seen.impact = v.impact;
    }
  }
  return [...rules.values()].sort(
    (a, b) => rank.indexOf(b.impact ?? '') - rank.indexOf(a.impact ?? ''),
  );
}
