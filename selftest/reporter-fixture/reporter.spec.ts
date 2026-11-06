import { test, expect } from '@playwright/test';

// Not part of the real suite: run only by tests/automation-selftest.spec.ts.
test.describe('fixture', () => {
  test('clean pass', () => {
    expect(1).toBe(1);
  });

  test('pinned defect', () => {
    test.info().annotations.push({ type: 'issue', description: 'F-9: planted pin' });
    expect(true).toBe(true);
  });

  test('scan with violations', async () => {
    const axe = {
      violations: [
        {
          id: 'image-alt',
          impact: 'critical',
          help: 'Images need alt',
          helpUrl: 'https://x',
          nodes: [{ html: '<img>' }],
        },
      ],
    };
    await test
      .info()
      .attach('axe-results.json', { body: JSON.stringify(axe), contentType: 'application/json' });
    expect(false, 'planted failure').toBe(true);
  });

  test('passes on retry', () => {
    expect(test.info().retry).toBe(1);
  });

  test('skipped', () => {
    test.skip(true, 'planted skip');
  });
});
