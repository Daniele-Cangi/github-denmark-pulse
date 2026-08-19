import { access, readFile } from 'node:fs/promises';
import { integer, readHistory, snapshotSha256 } from './lib.mjs';

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

const snapshots = [];
const snapshotPaths = [];
for (let index = 0; index < history.length; index += 1) {
  const row = history[index];
  const snapshotPath = `snapshots/${row.date}.json`;
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
  if (snapshot.account !== 'Daniele-Cangi' || snapshot.country !== 'Denmark') {
    throw new Error(`${row.date}: snapshot has the wrong account or country`);
  }
  if (snapshot.captured_at.slice(0, 10) !== row.date) {
    throw new Error(`${row.date}: snapshot date differs from history`);
  }
  if (snapshot.metrics.public_contributions.rank !== Number(row.public_rank)) {
    throw new Error(`${row.date}: snapshot public rank differs from history`);
  }
  if (snapshot.metrics.public_contributions.value !== Number(row.public_contributions)) {
    throw new Error(`${row.date}: snapshot public contributions differ from history`);
  }

  if (index === 0) {
    if (snapshot.previous_snapshot_date !== null || snapshot.previous_snapshot_sha256 !== null) {
      throw new Error(`${row.date}: first snapshot must start the integrity chain`);
    }
  } else {
    const previousDate = history[index - 1].date;
    const expectedHash = await snapshotSha256(snapshotPaths[index - 1]);
    if (snapshot.previous_snapshot_date !== previousDate) {
      throw new Error(`${row.date}: previous snapshot date should be ${previousDate}`);
    }
    if (snapshot.previous_snapshot_sha256 !== expectedHash) {
      throw new Error(`${row.date}: previous snapshot hash does not match ${previousDate}`);
    }
  }
  snapshots.push(snapshot);
  snapshotPaths.push(snapshotPath);
}

const latest = history.at(-1);
const snapshot = snapshots.at(-1);
if (!snapshot.validation.all_generated_rows_match_cache) throw new Error('Snapshot row validation is false');
if (!snapshot.validation.graphql_search_completed) throw new Error('Snapshot pagination is incomplete');
if (snapshot.validation.maximum_observed_octokit_errors !== 0) throw new Error('Snapshot records API errors');
if (!/^[0-9a-f]{40}$/.test(snapshot.provenance.data_commit_sha)) throw new Error('Data SHA is not full length');
if (!/^[0-9a-f]{40}$/.test(snapshot.provenance.action_commit_sha)) throw new Error('Action SHA is not full length');

const [readme, workflow, svg, observationSvg, notices] = await Promise.all([
  readFile('README.md', 'utf8'),
  readFile('.github/workflows/capture-denmark.yml', 'utf8'),
  readFile('assets/trajectory.svg', 'utf8'),
  readFile('assets/observation.svg', 'utf8'),
  readFile('THIRD_PARTY_NOTICES.md', 'utf8')
]);
if (
  !readme.includes(`**#${latest.public_rank}**`) ||
  !readme.includes(`snapshots/${latest.date}.json`) ||
  !readme.includes('assets/observation.svg')
) {
  throw new Error('README latest block is stale');
}
if (!svg.includes('<title') || !svg.includes('<desc') || !svg.includes(`number ${latest.public_rank}`)) {
  throw new Error('Trajectory SVG is stale or inaccessible');
}
const latestProof = await snapshotSha256(snapshotPaths.at(-1));
const observationNumber = String(history.length).padStart(2, '0');
const expectedPulsePoints = [...latestProof.slice(0, 32)]
  .map((character, index) => {
    const x = 60 + (index * 780) / 31;
    const y = 226 - (Number.parseInt(character, 16) - 7.5) * 3.4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  })
  .join(' ');
if (
  !observationSvg.includes('<title') ||
  !observationSvg.includes('<desc') ||
  !observationSvg.includes(`OBSERVATION ${observationNumber}`) ||
  !observationSvg.includes(latestProof.slice(0, 12)) ||
  !observationSvg.includes(`points="${expectedPulsePoints}"`)
) {
  throw new Error('Observation SVG does not represent the latest snapshot proof');
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

console.log(
  `Verified ${history.length}-observation SHA-256 chain; latest is ${latest.date} at #${latest.public_rank}`
);
