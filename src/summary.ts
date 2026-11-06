import type { Violation } from './a11y.ts';

/**
 * Machine-readable result of one run, written by reporters/summary-reporter.ts. Everything that
 * automates around the suite (job summary, PR comment, regression issues, the trend page) reads
 * this file, so it is the one place that decides what a run "found".
 */
export type Status = 'passed' | 'failed' | 'flaky' | 'skipped';

export interface TestRecord {
  /** Stable key across runs: spec file plus the describe/test title path. */
  id: string;
  title: string;
  file: string;
  status: Status;
  durationMs: number;
  tags: string[];
  /** Finding ID from an `issue` annotation ("F-1"), when the test pins a known defect. */
  finding?: string;
  /** Every axe violation the test recorded, across all scans it ran. */
  violations: Violation[];
  /** Rules axe couldn't decide ("needs review"), from the `axe-incomplete` annotation. */
  incomplete: string[];
  /** First part of the failure message, without colour codes. */
  error?: string;
}

export interface RunSummary {
  generatedAt: string;
  commit?: string;
  runUrl?: string;
  tests: TestRecord[];
  totals: Record<Status, number>;
}

export function totals(tests: readonly TestRecord[]): Record<Status, number> {
  const t: Record<Status, number> = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
  for (const test of tests) t[test.status]++;
  return t;
}
