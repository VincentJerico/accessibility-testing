import { defineConfig, devices } from '@playwright/test';

/**
 * Chromium only, on purpose: axe results are DOM-based (browser-agnostic), and keyboard focus
 * behavior differs by browser (e.g. Safari skips links on Tab by default), so one consistent
 * engine keeps the keyboard audit deterministic. Tests use absolute URLs (two sites under test).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    ...devices['Desktop Chrome'],
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
