import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export const HISTORY_COLUMNS = [
  'date',
  'public_rank',
  'public_contributions',
  'total_rank',
  'total_contributions',
  'restricted_contributions',
  'follower_rank',
  'followers',
  'source',
  'evidence_commit_sha',
  'upstream_data_sha',
  'upstream_action_sha'
];

export async function readHistory(path = 'data/history.csv') {
  const text = await readFile(path, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  const columns = lines.shift().split(',');
  if (columns.join(',') !== HISTORY_COLUMNS.join(',')) {
    throw new Error(`Unexpected history schema in ${path}`);
  }
  return lines.filter(Boolean).map((line) => {
    const values = line.split(',');
    if (values.length !== columns.length) throw new Error(`Malformed CSV row: ${line}`);
    return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  });
}

export async function writeHistory(rows, path = 'data/history.csv') {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const lines = [
    HISTORY_COLUMNS.join(','),
    ...sorted.map((row) => HISTORY_COLUMNS.map((column) => row[column] ?? '').join(','))
  ];
  await writeFile(path, `${lines.join('\n')}\n`);
}

export function number(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

export function integer(value, label) {
  const parsed = number(value, label);
  if (!Number.isInteger(parsed)) throw new Error(`Expected integer ${label}: ${value}`);
  return parsed;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${date}T00:00:00Z`));
}

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function sha256(path) {
  const content = await readFile(path);
  return createHash('sha256').update(content).digest('hex');
}

export function parseCaptureTime(markdown) {
  const match = markdown.match(/on `([0-9]{4})\/([0-9]{1,2})\/([0-9]{1,2}) ([0-9]{1,2}):([0-9]{2}) (AM|PM) UTC`/i);
  if (!match) throw new Error('Could not read the UTC capture time from the generated table');
  const [, year, month, day, rawHour, minute, meridiem] = match;
  let hour = Number(rawHour) % 12;
  if (meridiem.toUpperCase() === 'PM') hour += 12;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(hour).padStart(2, '0')}:${minute}:00Z`;
}

function textContent(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseGeneratedRows(markdown) {
  const rows = [];
  for (const match of markdown.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const body = match[1];
    const loginMatch = body.match(/href="https:\/\/github\.com\/([^"/]+)"/i);
    if (!loginMatch) continue;
    const cells = [...body.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((cell) => textContent(cell[1]));
    if (cells.length < 2 || !/^\d+$/.test(cells[0]) || !/^\d+$/.test(cells.at(-1))) continue;
    rows.push({ rank: Number(cells[0]), login: loginMatch[1], value: Number(cells.at(-1)) });
  }
  return rows;
}

function rankedRows(users, valueOf) {
  return users
    .map((user, index) => ({ rank: index + 1, login: user.login, value: valueOf(user) }))
    .filter((row) => row.rank <= 1000 && row.value > 0);
}

export function reproduceUpstreamRankings(rawUsers) {
  const users = rawUsers.map((user) => ({
    ...user,
    followers: integer(user.followers, `${user.login}.followers`),
    publicContributions: integer(user.publicContributions, `${user.login}.publicContributions`),
    privateContributions: integer(user.privateContributions, `${user.login}.privateContributions`)
  }));

  // Each page first asks for the follower floor, which sorts the shared array.
  // Reproducing those mutations preserves the upstream tie order exactly.
  users.sort((a, b) => b.followers - a.followers);
  users.sort((a, b) => b.publicContributions - a.publicContributions);
  const publicRows = rankedRows(users, (user) => user.publicContributions);

  users.sort((a, b) => b.followers - a.followers);
  users.sort(
    (a, b) => b.publicContributions + b.privateContributions - (a.publicContributions + a.privateContributions)
  );
  const totalRows = rankedRows(users, (user) => user.publicContributions + user.privateContributions);

  users.sort((a, b) => b.followers - a.followers);
  users.sort((a, b) => b.followers - a.followers);
  const followerRows = rankedRows(users, (user) => user.followers);

  return { publicRows, totalRows, followerRows };
}

export function assertRowsMatch(label, actual, expected) {
  if (actual.length !== expected.length) {
    throw new Error(`${label}: generated ${actual.length} rows; expected ${expected.length}`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    const left = actual[index];
    const right = expected[index];
    if (left.rank !== right.rank || left.login !== right.login || left.value !== right.value) {
      throw new Error(`${label}: row ${index + 1} differs: ${JSON.stringify(left)} != ${JSON.stringify(right)}`);
    }
  }
}

export function readCliArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Malformed argument near ${key}`);
    result[key.slice(2)] = value;
  }
  return result;
}
