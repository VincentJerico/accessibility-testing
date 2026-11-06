import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import type { FullConfig, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import type { Violation } from '../src/a11y.ts';
import { totals, type RunSummary, type Status, type TestRecord } from '../src/summary.ts';

interface Options {
  /** Where to write the summary (default reports/a11y-summary.json). */
  outputFile?: string;
}

const ANSI = /\x1b\[[0-9;]*m/g; // eslint-disable-line no-control-regex

/** Writes RunSummary JSON at the end of the run. Pure bookkeeping: it never changes a result. */
export default class SummaryReporter implements Reporter {
  private config!: FullConfig;
  private suite!: Suite;
  private readonly outputFile: string;

  constructor(options: Options = {}) {
    this.outputFile = options.outputFile ?? 'reports/a11y-summary.json';
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.config = config;
    this.suite = suite;
  }

  onEnd(): void {
    const tests = this.suite.allTests().map((test) => this.record(test));
    const server = process.env.GITHUB_SERVER_URL;
    const summary: RunSummary = {
      generatedAt: new Date().toISOString(),
      commit: process.env.GITHUB_SHA,
      runUrl:
        server && process.env.GITHUB_RUN_ID
          ? `${server}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
          : undefined,
      tests,
      totals: totals(tests),
    };
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, JSON.stringify(summary, null, 2));
  }

  private record(test: TestCase): TestRecord {
    const last = test.results.at(-1);
    const file = relative(this.config.rootDir, test.location.file);
    const issue = test.annotations.find((a) => a.type === 'issue')?.description;
    const incomplete = test.annotations.find((a) => a.type === 'axe-incomplete')?.description;
    const error = last?.error?.message?.replace(ANSI, '').trim().slice(0, 800);
    return {
      id: `${file} › ${test.titlePath().slice(3).join(' › ')}`,
      title: test.title,
      file,
      status: statusOf(test),
      durationMs: last?.duration ?? 0,
      tags: test.tags.length > 0 ? test.tags : [...test.title.matchAll(/@\w+/g)].map((m) => m[0]),
      finding: issue?.match(/^[A-Z]+-\d+/)?.[0],
      violations: (last?.attachments ?? [])
        .filter((a) => a.name === 'axe-results.json' && a.body)
        .flatMap((a) => violationsFrom(a.body!.toString('utf8'))),
      incomplete: incomplete ? incomplete.split(', ') : [],
      error: error || undefined,
    };
  }
}

function statusOf(test: TestCase): Status {
  switch (test.outcome()) {
    case 'expected':
      return 'passed';
    case 'flaky':
      return 'flaky';
    case 'skipped':
      return 'skipped';
    default:
      return 'failed';
  }
}

function violationsFrom(json: string): Violation[] {
  const results = JSON.parse(json) as {
    violations: {
      id: string;
      impact?: string | null;
      help: string;
      helpUrl: string;
      nodes: { html: string }[];
    }[];
  };
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
    samples: v.nodes.slice(0, 3).map((n) => n.html),
  }));
}
