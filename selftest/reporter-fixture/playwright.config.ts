import { defineConfig } from '@playwright/test';

// Fixture suite for tests/automation-selftest.spec.ts: one of each outcome the reporter handles.
export default defineConfig({
  testDir: '.',
  retries: 1,
  reporter: [['../../reporters/summary-reporter.ts', { outputFile: process.env.SUMMARY_FILE }]],
});
