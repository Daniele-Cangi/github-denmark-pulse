import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  assertRowsMatch,
  parseCaptureTime,
  parseGeneratedRows,
  readCliArgs,
  readHistory,
  reproduceUpstreamRankings,
  sha256,
  writeHistory
} from './lib.mjs';

const args = readCliArgs(process.argv.slice(2));
for (const required of ['engine', 'log', 'data-sha', 'action-sha', 'run-url']) {
  if (!args[required]) throw new Error(`Missing --${required}`);
}

const engine = resolve(args.engine);
const paths = {
  cache: resolve(engine, 'cache/denmark.json'),
  public: resolve(engine, 'markdown/public_contributions/denmark.md'),
  total: resolve(engine, 'markdown/total_contributions/denmark.md'),
  followers: resolve(engine, 'markdown/followers/denmark.md')
};
const [cacheText, publicText, totalText, followerText, log] = await Promise.all([
  readFile(paths.cache, 'utf8'),
  readFile(paths.public, 'utf8'),
  readFile(paths.total, 'utf8'),
  readFile(paths.followers, 'utf8'),
  readFile(resolve(args.log), 'utf8')
]);
const users = JSON.parse(cacheText);
if (!Array.isArray(users) || users.length === 0) throw new Error('Denmark cache is empty or malformed');

const expected = reproduceUpstreamRankings(users);
const actual = {
  publicRows: parseGeneratedRows(publicText),
  totalRows: parseGeneratedRows(totalText),
  followerRows: parseGeneratedRows(followerText)
};
assertRowsMatch('public contributions', actual.publicRows, expected.publicRows);
assertRowsMatch('total contributions', actual.totalRows, expected.totalRows);
assertRowsMatch('followers', actual.followerRows, expected.followerRows);

if (!/hasNextPage:\s*false/i.test(log)) throw new Error('GraphQL search did not report hasNextPage: false');
if (/octokit error minimum/i.test(log)) throw new Error('The upstream engine reached its Octokit error limit');
const observedErrors = [...log.matchAll(/errors:\((\d+)\//gi)].map((match) => Number(match[1]));
const maximumObservedErrors = observedErrors.length ? Math.max(...observedErrors) : 0;
if (maximumObservedErrors !== 0) throw new Error(`Observed ${maximumObservedErrors} Octokit errors`);

const account = users.find((user) => user.login.toLowerCase() === 'daniele-cangi');
if (!account) throw new Error('Daniele-Cangi is absent from the Denmark cache');
const findAccount = (rows) => rows.find((row) => row.login.toLowerCase() === 'daniele-cangi');
const publicMetric = findAccount(expected.publicRows);
const totalMetric = findAccount(expected.totalRows);
const followerMetric = findAccount(expected.followerRows);
if (!publicMetric || !totalMetric || !followerMetric) throw new Error('Account is absent from a generated ranking');

const capturedAt = parseCaptureTime(publicText);
const date = capturedAt.slice(0, 10);
const history = await readHistory();
const previous = history.filter((row) => row.date < date).at(-1);
const rankImprovement = previous ? Number(previous.public_rank) - publicMetric.rank : null;
const contributionChange = previous ? publicMetric.value - Number(previous.public_contributions) : null;
const thresholds = Object.fromEntries(
  [10, 20, 25, 30, 40, 50, 75, 100]
    .filter((rank) => expected.publicRows[rank - 1])
    .map((rank) => [rank, expected.publicRows[rank - 1].value])
);

const evidenceFiles = Object.fromEntries(
  await Promise.all(
    Object.entries(paths).map(async ([key, path]) => [
      key === 'cache'
        ? 'cache/denmark.json'
        : `markdown/${key === 'public' ? 'public_contributions' : key === 'total' ? 'total_contributions' : 'followers'}/denmark.md`,
      { sha256: await sha256(path) }
    ])
  )
);
const runId = Number(args['run-url'].split('/').at(-1));
const snapshot = {
  schema_version: 1,
  country: 'Denmark',
  country_code: 'DK',
  account: 'Daniele-Cangi',
  captured_at: capturedAt,
  time_precision: 'minute',
  candidate_count: users.length,
  metrics: {
    public_contributions: { rank: publicMetric.rank, value: publicMetric.value },
    total_contributions: { rank: totalMetric.rank, value: totalMetric.value },
    restricted_contributions: { value: Number(account.privateContributions) },
    followers: { rank: followerMetric.rank, value: followerMetric.value }
  },
  movement: previous
    ? {
        baseline_date: previous.date,
        baseline_public_rank: Number(previous.public_rank),
        baseline_public_contributions: Number(previous.public_contributions),
        rank_improvement: rankImprovement,
        public_contributions_change: contributionChange,
        public_contributions_change_percent: Number(
          ((contributionChange / Number(previous.public_contributions)) * 100).toFixed(1)
        )
      }
    : null,
  public_contribution_thresholds: thresholds,
  provenance: {
    data_repository: 'gayanvoice/top-github-users',
    data_commit_sha: args['data-sha'],
    action_repository: 'gayanvoice/top-github-users-action',
    action_commit_sha: args['action-sha'],
    evidence_repository: process.env.GITHUB_REPOSITORY ?? null,
    evidence_commit_sha: null,
    workflow_run_id: Number.isFinite(runId) ? runId : null,
    workflow_run_url: args['run-url'],
    evidence_files: evidenceFiles
  },
  validation: {
    candidate_records: users.length,
    graphql_search_completed: true,
    maximum_observed_octokit_errors: maximumObservedErrors,
    rows_checked: {
      public_contributions: actual.publicRows.length,
      total_contributions: actual.totalRows.length,
      followers: actual.followerRows.length
    },
    all_generated_rows_match_cache: true
  }
};

await mkdir('snapshots', { recursive: true });
await writeFile(`snapshots/${date}.json`, `${JSON.stringify(snapshot, null, 2)}\n`);
const row = {
  date,
  public_rank: String(publicMetric.rank),
  public_contributions: String(publicMetric.value),
  total_rank: String(totalMetric.rank),
  total_contributions: String(totalMetric.value),
  restricted_contributions: String(account.privateContributions),
  follower_rank: String(followerMetric.rank),
  followers: String(followerMetric.value),
  source: args['run-url'],
  evidence_commit_sha: '',
  upstream_data_sha: args['data-sha'],
  upstream_action_sha: args['action-sha']
};
await writeHistory([...history.filter((entry) => entry.date !== date), row]);

console.log(`Captured Denmark snapshot ${date}: public rank #${publicMetric.rank}`);
