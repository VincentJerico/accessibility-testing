// Self-test for the reusable gate: it must fail the planted-bad page for the planted reasons, pass
// the clean page, and fail when no URLs are given. A gate that can't fail isn't a gate.
//   node gate/selftest.ts
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { RunSummary } from '../src/summary.ts';

const fixtures = join(import.meta.dirname, 'fixtures');
const server = createServer((req, res) => {
  try {
    const body = readFileSync(join(fixtures, (req.url ?? '/').replace(/[^\w.-]/g, '')));
    res.writeHead(200, { 'content-type': 'text/html' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

// Async on purpose: the fixture server runs in this process and must keep answering while the gate runs.
async function gate(urls: string): Promise<{ code: number | null; summary: RunSummary }> {
  const out = join('reports', 'gate-selftest.json');
  const child = spawn('npx', ['playwright', 'test', '-c', 'gate/playwright.config.ts'], {
    env: { ...process.env, A11Y_URLS: urls, A11Y_SUMMARY: out, CI: '' },
    stdio: 'ignore',
  });
  const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
  return { code, summary: JSON.parse(readFileSync(out, 'utf8')) as RunSummary };
}

const failures: string[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

try {
  const bad = await gate(`${base}/bad.html`);
  const rules = bad.summary.tests.flatMap((t) => t.violations.map((v) => v.rule));
  const kb = bad.summary.tests.find((t) => t.tags.includes('@keyboard'));
  check(bad.code !== 0, 'the gate fails the planted-bad page');
  check(
    rules.includes('image-alt') && rules.includes('label'),
    `it reports the planted axe rules (got: ${rules.join(', ') || 'none'})`,
  );
  check(
    kb?.status === 'failed' && /no visible focus indicator on: <button>/.test(kb.error ?? ''),
    'it reports the button with no visible focus',
  );

  const trap = await gate(`${base}/trap.html`);
  const trapKb = trap.summary.tests.find((t) => t.tags.includes('@keyboard'));
  check(
    /keyboard trap: Tab stays on <input#q>/.test(trapKb?.error ?? ''),
    'it reports the keyboard trap on the search field',
  );

  const good = await gate(`${base}/good.html`);
  check(good.code === 0, 'the gate passes the clean page');
  check(
    good.summary.totals.passed === 3,
    `all 3 clean-page tests pass (got ${good.summary.totals.passed})`,
  );

  const none = await gate('');
  check(none.code !== 0, 'the gate fails when A11Y_URLS is empty');
} finally {
  server.close();
}

if (failures.length > 0) {
  console.error(`\nGate self-test failed: ${failures.length} check(s).`);
  process.exit(1);
}
console.log('\nGate self-test passed: the gate can fail, and fails for the right reasons.');
