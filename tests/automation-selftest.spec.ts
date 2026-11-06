import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planIssues, signature, type OpenIssue } from '../src/issues.ts';
import { COMMENT_MARKER, toMarkdown } from '../src/report.ts';
import { totals, type RunSummary, type TestRecord } from '../src/summary.ts';

/**
 * Self-tests for the automation around the suite: the summary reporter, the markdown report and
 * the regression-issue planner. No browser and no network; the planner is a pure function, so
 * every decision it makes about real GitHub issues is pinned here first.
 */
const rec = (over: Partial<TestRecord> = {}): TestRecord => ({
  id: 'tests/x.spec.ts › suite › login',
  title: 'login',
  file: 'tests/x.spec.ts',
  status: 'passed',
  durationMs: 10,
  tags: [],
  violations: [],
  incomplete: [],
  ...over,
});
const run = (...tests: TestRecord[]): RunSummary => ({
  generatedAt: '2026-11-06T00:00:00Z',
  runUrl: 'https://github.com/o/r/actions/runs/1',
  tests,
  totals: totals(tests),
});
const contrast = {
  rule: 'color-contrast',
  impact: 'serious',
  help: 'Contrast',
  helpUrl: 'https://x',
  nodes: 2,
  samples: [],
};
const failing = rec({ status: 'failed', violations: [contrast], error: 'WCAG 2.2 AA violations:' });
const issueFor = (t: TestRecord, number = 7): OpenIssue => ({
  number,
  text: `body\n<!-- a11y-key: ${t.id} -->\n<!-- a11y-sig: ${signature(t)} -->`,
});

test.describe('Regression issue planner @selftest', () => {
  test('opens one issue for a new failure, with its key and signature', () => {
    const [action, ...rest] = planIssues(run(failing), []);
    expect(rest).toHaveLength(0);
    expect(action).toMatchObject({
      kind: 'open',
      key: failing.id,
      title: 'Accessibility regression: login',
    });
    expect(action!.kind === 'open' && action.body).toContain(`<!-- a11y-key: ${failing.id} -->`);
    expect(action!.kind === 'open' && action.body).toContain('`color-contrast`');
  });

  test('titles a broken pin by its finding ID', () => {
    const [action] = planIssues(
      run(rec({ status: 'failed', finding: 'F-1', error: 'expected false' })),
      [],
    );
    expect(action).toMatchObject({ kind: 'open', title: 'Pinned finding F-1 changed: login' });
  });

  test('stays quiet while the same failure repeats', () => {
    expect(planIssues(run(failing), [issueFor(failing)])).toEqual([]);
  });

  test('comments when the failure changes', () => {
    const worse = { ...failing, violations: [{ ...contrast, nodes: 5 }] };
    expect(planIssues(run(worse), [issueFor(failing)])).toMatchObject([
      { kind: 'comment', number: 7 },
    ]);
  });

  test('reads the latest signature, so a changed failure is reported once', () => {
    const worse = { ...failing, violations: [{ ...contrast, nodes: 5 }] };
    const commented = issueFor(failing);
    commented.text += `\n<!-- a11y-sig: ${signature(worse)} -->`;
    expect(planIssues(run(worse), [commented])).toEqual([]);
  });

  test('closes the issue when the test passes again', () => {
    expect(planIssues(run(rec()), [issueFor(failing)])).toMatchObject([
      { kind: 'close', number: 7 },
    ]);
  });

  test('never acts on flaky or skipped tests, or on tests missing from the run', () => {
    const other = issueFor(rec({ id: 'tests/y.spec.ts › renamed' }), 9);
    expect(
      planIssues(run(rec({ status: 'flaky' }), rec({ status: 'skipped', id: 'b' })), [
        issueFor(failing),
        other,
      ]),
    ).toEqual([]);
    expect(planIssues(run(rec({ status: 'flaky', violations: [contrast] })), [])).toEqual([]);
  });

  test('signature ignores the order axe reports rules in', () => {
    const label = { ...contrast, rule: 'label', nodes: 1 };
    expect(signature(rec({ violations: [contrast, label] }))).toBe(
      signature(rec({ violations: [label, contrast] })),
    );
  });
});

test.describe('Markdown report @selftest', () => {
  test('summarises a failing run: verdict, axe rules, and a changed pin', () => {
    const md = toMarkdown(
      run(
        failing,
        rec({ id: 'pin', status: 'failed', finding: 'F-2', error: 'Expected: true' }),
        rec({ id: 'ok', finding: 'F-3' }),
      ),
    );
    expect(md.startsWith(COMMENT_MARKER)).toBe(true);
    expect(md).toContain('### Accessibility run: FAIL');
    expect(md).toContain('| `color-contrast` | serious | 2 |');
    expect(md).toContain('| F-2 | login | **changed**: fixed, or the pin broke |');
    expect(md).toContain('| F-3 | login | still present, as pinned |');
  });

  test('sums needs-review results per rule across scans', () => {
    const md = toMarkdown(
      run(
        rec({ incomplete: ['color-contrast (4)', 'aria-valid-attr-value (1)'] }),
        rec({ id: 'b', incomplete: ['color-contrast (3)'] }),
      ),
    );
    expect(md).toContain(
      'axe could not decide (check by hand): color-contrast (7 nodes), aria-valid-attr-value (1 node).',
    );
  });

  test('escapes table pipes in test names', () => {
    expect(toMarkdown(run({ ...failing, id: 'a | b' }))).toContain('a \\| b');
  });
});

test.describe('Summary reporter @selftest', () => {
  test('records status, finding, axe violations and errors from a real run', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'a11y-summary-')), 'summary.json');
    try {
      execFileSync(
        'npx',
        ['playwright', 'test', '-c', 'selftest/reporter-fixture/playwright.config.ts'],
        {
          env: { ...process.env, SUMMARY_FILE: out, CI: '' },
          stdio: 'pipe',
        },
      );
    } catch {
      // The fixture suite fails on purpose; the summary is what's under test.
    }
    const summary = JSON.parse(readFileSync(out, 'utf8')) as RunSummary;
    const byTitle = Object.fromEntries(summary.tests.map((t) => [t.title, t]));

    expect(summary.totals).toEqual({ passed: 2, failed: 1, flaky: 1, skipped: 1 });
    expect(byTitle['pinned defect']).toMatchObject({ status: 'passed', finding: 'F-9' });
    expect(byTitle['scan with violations']!.violations.map((v) => v.rule)).toEqual(['image-alt']);
    expect(byTitle['scan with violations']!.status).toBe('failed');
    expect(byTitle['scan with violations']!.error).toContain('planted failure');
    expect(byTitle['passes on retry']!.status).toBe('flaky');
    expect(byTitle['scan with violations']!.id).toBe(
      'reporter.spec.ts › fixture › scan with violations',
    );
  });
});
