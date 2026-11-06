// Print the run summary as markdown. CI appends it to $GITHUB_STEP_SUMMARY.
//   node scripts/report.ts reports/a11y-summary.json
import { toMarkdown } from '../src/report.ts';
import { readSummary } from './github.ts';

process.stdout.write(toMarkdown(readSummary(process.argv[2] ?? 'reports/a11y-summary.json')));
