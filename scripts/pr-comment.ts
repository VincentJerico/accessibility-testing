// Post the run summary on a PR as one comment, updated in place on every later run.
//   PR_NUMBER=12 node scripts/pr-comment.ts reports/a11y-summary.json
import { COMMENT_MARKER, toMarkdown } from '../src/report.ts';
import { env, gh, ghAll, readSummary } from './github.ts';

const body = toMarkdown(readSummary(process.argv[2] ?? 'reports/a11y-summary.json'));
const pr = env('PR_NUMBER');

const comments = await ghAll<{ id: number; body?: string }>(`/issues/${pr}/comments`);
const mine = comments.find((c) => c.body?.includes(COMMENT_MARKER));
if (mine) {
  await gh('PATCH', `/issues/comments/${mine.id}`, { body });
  console.log(`Updated comment ${mine.id} on #${pr}`);
} else {
  await gh('POST', `/issues/${pr}/comments`, { body });
  console.log(`Commented on #${pr}`);
}
