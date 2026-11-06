import { createHash } from 'node:crypto';
import type { RunSummary, TestRecord } from './summary.ts';

/** Label on every issue this automation owns; it only ever touches issues carrying it. */
export const LABEL = 'a11y-automation';

const KEY = /<!-- a11y-key: (.+?) -->/;
const SIG = /<!-- a11y-sig: ([0-9a-f]+) -->/g;

export interface OpenIssue {
  number: number;
  /** Issue body plus its comments, oldest first. The key and latest signature are read from it. */
  text: string;
}

export type Action =
  | { kind: 'open'; key: string; title: string; body: string }
  | { kind: 'comment'; number: number; key: string; body: string }
  | { kind: 'close'; number: number; key: string; body: string };

/**
 * Decide what to do with issues after a run. One issue per failing test, keyed by test ID:
 * - failing, no open issue: open one;
 * - failing, open issue, failure changed since the last report: comment with the new details;
 * - passing, open issue: close it with a comment.
 * Flaky and skipped tests, and open issues for tests that didn't run (a filtered run, a renamed
 * test), are left alone, so a partial run can never close an issue.
 */
export function planIssues(summary: RunSummary, open: readonly OpenIssue[]): Action[] {
  const byKey = new Map<string, OpenIssue>();
  for (const issue of open) {
    const key = issue.text.match(KEY)?.[1];
    if (key) byKey.set(key, issue);
  }

  const actions: Action[] = [];
  for (const test of summary.tests) {
    const issue = byKey.get(test.id);
    if (test.status === 'failed') {
      const sig = signature(test);
      if (!issue) {
        actions.push({
          kind: 'open',
          key: test.id,
          title: titleFor(test),
          body: bodyFor(test, summary, sig),
        });
      } else if (latestSignature(issue.text) !== sig) {
        actions.push({
          kind: 'comment',
          number: issue.number,
          key: test.id,
          body: commentFor(test, summary, sig),
        });
      }
    } else if (test.status === 'passed' && issue) {
      const run = summary.runUrl ? ` in [this run](${summary.runUrl})` : '';
      actions.push({
        kind: 'close',
        number: issue.number,
        key: test.id,
        body: `Passing again${run}. Closing automatically; it reopens as a new issue if it fails again.`,
      });
    }
  }
  return actions;
}

/** Same failure, same signature: the error's first line plus the rules and node counts axe found. */
export function signature(test: TestRecord): string {
  const rules = test.violations.map((v) => `${v.rule}:${v.nodes}`).sort();
  const head = (test.error ?? '').split('\n')[0];
  return createHash('sha256')
    .update(JSON.stringify([head, rules]))
    .digest('hex')
    .slice(0, 12);
}

function latestSignature(text: string): string | undefined {
  return [...text.matchAll(SIG)].at(-1)?.[1];
}

function titleFor(test: TestRecord): string {
  return test.finding
    ? `Pinned finding ${test.finding} changed: ${test.title}`
    : `Accessibility regression: ${test.title}`;
}

function details(test: TestRecord, summary: RunSummary): string[] {
  const lines = [`**Test:** \`${test.id}\``];
  if (test.finding) {
    lines.push(
      '',
      `This test pins finding **${test.finding}** (see [docs/FINDINGS.md](../blob/main/docs/FINDINGS.md)). ` +
        'It fails when the defect is fixed or when the page changed under it. Check which, then update the pin.',
    );
  }
  if (test.violations.length > 0) {
    lines.push('', '| Rule | Impact | Nodes | Help |', '| --- | --- | --: | --- |');
    for (const v of test.violations) {
      lines.push(`| \`${v.rule}\` | ${v.impact ?? ''} | ${v.nodes} | [${v.help}](${v.helpUrl}) |`);
    }
  }
  if (test.error) lines.push('', '```', test.error, '```');
  if (summary.runUrl) lines.push('', `Run: ${summary.runUrl}`);
  lines.push(
    '',
    `Reproduce: \`npx playwright test ${test.file} -g "${test.title.replace(/"/g, '\\"')}"\``,
  );
  return lines;
}

function bodyFor(test: TestRecord, summary: RunSummary, sig: string): string {
  return [
    ...details(test, summary),
    '',
    'Opened by the accessibility workflow. It comments if the failure changes and closes this issue when the test passes.',
    `<!-- a11y-key: ${test.id} -->`,
    `<!-- a11y-sig: ${sig} -->`,
  ].join('\n');
}

function commentFor(test: TestRecord, summary: RunSummary, sig: string): string {
  return ['The failure changed:', '', ...details(test, summary), `<!-- a11y-sig: ${sig} -->`].join(
    '\n',
  );
}
