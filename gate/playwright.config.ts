import { defineConfig, devices } from '@playwright/test';

/**
 * The reusable accessibility gate (see .github/workflows/a11y-gate.yml and the README). Scans the
 * URLs in A11Y_URLS; it knows nothing about this repo's sites under test.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'gate.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  outputDir: '../test-results/gate',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../playwright-report/gate' }],
    [
      '../reporters/summary-reporter.ts',
      { outputFile: process.env.A11Y_SUMMARY ?? 'reports/a11y-summary.json' },
    ],
  ],
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
});
