import { access, readFile } from 'node:fs/promises';
import { integer, readHistory } from './lib.mjs';

const history = await readHistory();
if (history.length < 2) throw new Error('History must contain at least two observations');
const dates = history.map((row) => row.date);
if (new Set(dates).size !== dates.length) throw new Error('History contains duplicate dates');
if ([...dates].sort().join(',') !== dates.join(',')) throw new Error('History is not chronological');

for (const row of history) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error(`Invalid date ${row.date}`);
  if (integer(row.public_rank, `${row.date}.public_rank`) < 1) throw new Error('Rank must be positive');
  if (integer(row.public_contributions, `${row.date}.public_contributions`) < 0) {
    throw new Error('Contribution count cannot be negative');
  }
  if (!row.source.startsWith('https://github.com/')) throw new Error(`Invalid source for ${row.date}`);
}

const latest = history.at(-1);
const snapshot = JSON.parse(await readFile(`snapshots/${latest.date}.json`, 'utf8'));
if (snapshot.account !== 'Daniele-Cangi' || snapshot.country !== 'Denmark') {
  throw new Error('Latest snapshot has the wrong account or country');
}
if (snapshot.captured_at.slice(0, 10) !== latest.date) throw new Error('Snapshot date differs from history');
if (snapshot.metrics.public_contributions.rank !== Number(latest.public_rank)) {
  throw new Error('Snapshot public rank differs from history');
}
if (snapshot.metrics.public_contributions.value !== Number(latest.public_contributions)) {
  throw new Error('Snapshot public contributions differ from history');
}
if (!snapshot.validation.all_generated_rows_match_cache) throw new Error('Snapshot row validation is false');
if (!snapshot.validation.graphql_search_completed) throw new Error('Snapshot pagination is incomplete');
if (snapshot.validation.maximum_observed_octokit_errors !== 0) throw new Error('Snapshot records API errors');
if (!/^[0-9a-f]{40}$/.test(snapshot.provenance.data_commit_sha)) throw new Error('Data SHA is not full length');
if (!/^[0-9a-f]{40}$/.test(snapshot.provenance.action_commit_sha)) throw new Error('Action SHA is not full length');

const [readme, workflow, svg, notices] = await Promise.all([
  readFile('README.md', 'utf8'),
  readFile('.github/workflows/capture-denmark.yml', 'utf8'),
  readFile('assets/trajectory.svg', 'utf8'),
  readFile('THIRD_PARTY_NOTICES.md', 'utf8')
]);
if (!readme.includes(`**#${latest.public_rank}**`) || !readme.includes(`snapshots/${latest.date}.json`)) {
  throw new Error('README latest block is stale');
}
if (!svg.includes('<title') || !svg.includes('<desc') || !svg.includes(`number ${latest.public_rank}`)) {
  throw new Error('Trajectory SVG is stale or inaccessible');
}
if (/\bschedule\s*:/i.test(workflow)) throw new Error('Workflow must remain manual-only');
for (const sha of [
  '11d5960a326750d5838078e36cf38b85af677262',
  '49933ea5288caeca8642d1e84afbd3f7d6820020',
  '2b5c26a06abea2b0a7ba98a013ff0ce7fc913477'
]) {
  if (!workflow.includes(sha)) throw new Error(`Workflow is missing pinned SHA ${sha}`);
}
if (!notices.includes('gayanvoice/top-github-users-action')) throw new Error('Third-party attribution is missing');
await access('LICENSE');

console.log(`Verified ${history.length} observations; latest is ${latest.date} at #${latest.public_rank}`);
