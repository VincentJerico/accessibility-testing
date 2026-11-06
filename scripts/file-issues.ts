// Open, update and close regression issues from a run summary (see planIssues in src/issues.ts).
//   node scripts/file-issues.ts reports/a11y-summary.json [--dry-run]
// --dry-run prints the plan as markdown and touches nothing; CI uses it on PRs.
import { LABEL, planIssues, type Action, type OpenIssue } from '../src/issues.ts';
import { gh, ghAll, readSummary } from './github.ts';

const summary = readSummary(process.argv[2] ?? 'reports/a11y-summary.json');
const dryRun = process.argv.includes('--dry-run');

const open: OpenIssue[] = [];
const issues = await ghAll<{ number: number; body?: string; pull_request?: unknown }>(
  `/issues?state=open&labels=${LABEL}`,
);
for (const issue of issues.filter((i) => !i.pull_request)) {
  const comments = await ghAll<{ body?: string }>(`/issues/${issue.number}/comments`);
  open.push({
    number: issue.number,
    text: [issue.body ?? '', ...comments.map((c) => c.body ?? '')].join('\n'),
  });
}

const actions = planIssues(summary, open);
console.log(describe(actions, dryRun));
if (!dryRun) await apply(actions);

async function apply(actions: Action[]): Promise<void> {
  if (actions.some((a) => a.kind === 'open')) await ensureLabel();
  for (const a of actions) {
    if (a.kind === 'open') {
      await gh('POST', '/issues', {
        title: a.title,
        body: a.body,
        labels: [LABEL, 'accessibility'],
      });
    } else {
      await gh('POST', `/issues/${a.number}/comments`, { body: a.body });
      if (a.kind === 'close') {
        await gh('PATCH', `/issues/${a.number}`, { state: 'closed', state_reason: 'completed' });
      }
    }
  }
}

async function ensureLabel(): Promise<void> {
  try {
    await gh('GET', `/labels/${LABEL}`);
  } catch {
    await gh('POST', '/labels', {
      name: LABEL,
      color: '005A9C',
      description: 'Opened and closed by the accessibility workflow',
    });
  }
}

function describe(actions: Action[], dryRun: boolean): string {
  const head = `#### Regression issues${dryRun ? ' (dry run: nothing changed)' : ''}`;
  if (actions.length === 0) return `${head}\n\nNo issues to open, update or close.\n`;
  const rows = actions.map((a) =>
    a.kind === 'open' ? `- open: ${a.title}` : `- ${a.kind} #${a.number}: \`${a.key}\``,
  );
  return [head, '', ...rows, ''].join('\n');
}
