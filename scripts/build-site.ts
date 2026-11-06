// Build the GitHub Pages site: the latest run, a run-over-run trend, and the Playwright report.
//   PAGES_URL=https://vincentjerico.github.io/accessibility-testing node scripts/build-site.ts reports/a11y-summary.json site
// History lives on the published site itself: the previous history.json is fetched, this run is
// appended, and the result is published again. No branch or database to maintain.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunSummary } from '../src/summary.ts';
import { readSummary } from './github.ts';

interface HistoryEntry {
  date: string;
  commit?: string;
  runUrl?: string;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  /** Pinned findings whose test failed: the defect was fixed or the page changed. */
  pinsChanged: number;
}

const KEEP = 90;

function entryFor(summary: RunSummary): HistoryEntry {
  return {
    date: summary.generatedAt,
    commit: summary.commit,
    runUrl: summary.runUrl,
    ...summary.totals,
    pinsChanged: summary.tests.filter((t) => t.finding && t.status === 'failed').length,
  };
}

async function previousHistory(): Promise<HistoryEntry[]> {
  const base = process.env.PAGES_URL;
  if (!base) return [];
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/history.json`);
    return res.ok ? ((await res.json()) as HistoryEntry[]) : [];
  } catch {
    return []; // first publish, or the site is down: start a new history
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Stacked bars, one per run: passed (bottom) and failed (top). */
function chart(history: HistoryEntry[]): string {
  const w = 760;
  const h = 180;
  const max = Math.max(1, ...history.map((e) => e.passed + e.failed));
  const step = w / Math.max(history.length, 1);
  const bar = Math.max(2, Math.min(18, step - 2));
  const bars = history
    .map((e, i) => {
      const x = (i * step + (step - bar) / 2).toFixed(1);
      const pH = (e.passed / max) * (h - 20);
      const fH = (e.failed / max) * (h - 20);
      const label = `${e.date.slice(0, 10)}: ${e.passed} passed, ${e.failed} failed`;
      return `<g><title>${esc(label)}</title><rect x="${x}" y="${(h - pH).toFixed(1)}" width="${bar}" height="${pH.toFixed(1)}" class="pass"/><rect x="${x}" y="${(h - pH - fH).toFixed(1)}" width="${bar}" height="${fH.toFixed(1)}" class="fail"/></g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="trend-title"><title id="trend-title">Passed and failed tests in the last ${history.length} runs</title>${bars}</svg>`;
}

function page(summary: RunSummary, history: HistoryEntry[]): string {
  const latest = history.at(-1)!;
  const failing = summary.tests.filter((t) => t.status === 'failed');
  const pins = summary.tests.filter((t) => t.finding);
  const rows = history
    .slice(-10)
    .reverse()
    .map(
      (e) =>
        `<tr><td>${e.runUrl ? `<a href="${esc(e.runUrl)}">${e.date.slice(0, 10)}</a>` : e.date.slice(0, 10)}</td><td>${e.commit?.slice(0, 7) ?? ''}</td><td>${e.passed}</td><td>${e.failed}</td><td>${e.flaky}</td><td>${e.pinsChanged}</td></tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Accessibility results</title>
<style>
  :root { color-scheme: dark light; --bg: #0b0f14; --surface: #11161d; --line: #232b36; --text: #e6edf3; --muted: #9aa4af; --accent: #58a6ff; --pass: #3fb950; --fail: #f85149; }
  @media (prefers-color-scheme: light) { :root { --bg: #fafaf7; --surface: #fff; --line: #e3e3de; --text: #111418; --muted: #555d66; --accent: #0b5fd8; --pass: #1a7f37; --fail: #cf222e; } }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, sans-serif; }
  main { max-width: 52rem; margin: 0 auto; padding: 2.5rem 1rem 4rem; }
  h1 { font: 400 2.4rem/1.1 Georgia, serif; margin: 0 0 .25rem; }
  h2 { font-size: 1.15rem; margin: 2.25rem 0 .75rem; }
  .muted { color: var(--muted); }
  .verdict { font: 600 .85rem ui-monospace, monospace; padding: .15rem .5rem; border: 1.5px solid currentColor; border-radius: 4px; }
  .verdict.ok { color: var(--pass); } .verdict.bad { color: var(--fail); }
  a { color: var(--accent); }
  :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  svg { width: 100%; height: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
  .pass { fill: var(--pass); } .fail { fill: var(--fail); }
  table { width: 100%; border-collapse: collapse; font-size: .95rem; }
  th, td { text-align: left; padding: .45rem .5rem; border-bottom: 1px solid var(--line); }
  td:nth-child(n+3), th:nth-child(n+3) { text-align: right; font-variant-numeric: tabular-nums; }
  .wrap { overflow-x: auto; }
</style>
</head>
<body>
<main>
  <h1>Accessibility results</h1>
  <p class="muted">WCAG 2.2 AA with axe-core, plus a keyboard audit. Updated ${latest.date.slice(0, 16).replace('T', ' ')} UTC.</p>
  <p><span class="verdict ${latest.failed === 0 ? 'ok">PASS' : 'bad">FAIL'}</span> ${latest.passed} passed, ${latest.failed} failed, ${latest.flaky} flaky. <a href="report/index.html">Full Playwright report</a>${latest.runUrl ? ` · <a href="${esc(latest.runUrl)}">CI run</a>` : ''}</p>

  <h2>Trend</h2>
  ${chart(history)}
  <p class="muted">One bar per run on <code>main</code> (pushes and the weekly scheduled run), green passed, red failed. Hover a bar for its date.</p>

  ${failing.length ? `<h2>Failing now</h2><ul>${failing.map((t) => `<li><code>${esc(t.id)}</code>${t.finding ? ` (${t.finding})` : ''}</li>`).join('')}</ul>` : ''}

  ${pins.length ? `<h2>Pinned findings</h2><p class="muted">Defects axe can't detect, pinned by tests. "Still present" is expected until they're fixed.</p><ul>${pins.map((t) => `<li>${t.finding}: ${t.status === 'passed' ? 'still present' : '<strong>changed</strong>'}</li>`).join('')}</ul>` : ''}

  <h2>Recent runs</h2>
  <div class="wrap" role="region" aria-label="Recent runs" tabindex="0">
  <table><thead><tr><th>Date</th><th>Commit</th><th>Passed</th><th>Failed</th><th>Flaky</th><th>Pins changed</th></tr></thead><tbody>${rows}</tbody></table>
  </div>
</main>
</body>
</html>
`;
}

const [summaryFile = 'reports/a11y-summary.json', outDir = 'site'] = process.argv.slice(2);
const summary = readSummary(summaryFile);
const history = [...(await previousHistory()), entryFor(summary)].slice(-KEEP);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'history.json'), JSON.stringify(history, null, 2));
writeFileSync(join(outDir, 'index.html'), page(summary, history));
console.log(`Wrote ${outDir}/index.html with ${history.length} run(s) of history`);
