import { readFile, writeFile } from 'node:fs/promises';
import { escapeXml, formatDate, formatNumber, integer, readHistory } from './lib.mjs';

const history = await readHistory();
if (history.length < 2) throw new Error('At least two observations are required to render a trajectory');

const points = history.map((row) => ({
  date: row.date,
  rank: integer(row.public_rank, `${row.date}.public_rank`),
  contributions: integer(row.public_contributions, `${row.date}.public_contributions`)
}));
const latest = points.at(-1);
const first = points[0];
const snapshot = JSON.parse(await readFile(`snapshots/${latest.date}.json`, 'utf8'));
const rankImprovement = first.rank - latest.rank;

let readme = await readFile('README.md', 'utf8');
const start = '<!-- latest:start -->';
const end = '<!-- latest:end -->';
const dynamic = `${start}
| Public rank | Public contributions | Movement since ${formatDate(first.date)} |
| ---: | ---: | ---: |
| **#${latest.rank}** | **${formatNumber(latest.contributions)}** | **${rankImprovement >= 0 ? '↑' : '↓'} ${Math.abs(rankImprovement)} places** |

Captured ${formatDate(latest.date)}. Secondary measures: **#${snapshot.metrics.total_contributions.rank}** by total contributions
(${formatNumber(snapshot.metrics.total_contributions.value)}, including ${formatNumber(snapshot.metrics.restricted_contributions.value)} restricted contributions) and **#${snapshot.metrics.followers.rank}** by followers
(${formatNumber(snapshot.metrics.followers.value)}). [Inspect the snapshot](snapshots/${latest.date}.json).
${end}`;
const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
if (!pattern.test(readme)) throw new Error('README latest markers are missing');
readme = readme.replace(pattern, dynamic);
await writeFile('README.md', readme);

const width = 900;
const height = 340;
const plot = { left: 92, right: 54, top: 56, bottom: 72 };
const minRank = Math.min(...points.map((point) => point.rank));
const maxRank = Math.max(...points.map((point) => point.rank));
const padding = Math.max(8, Math.ceil((maxRank - minRank) * 0.18));
const domainTop = Math.max(1, minRank - padding);
const domainBottom = maxRank + padding;
const x = (index) =>
  plot.left + (points.length === 1 ? 0 : (index * (width - plot.left - plot.right)) / (points.length - 1));
const y = (rank) =>
  plot.top + ((rank - domainTop) * (height - plot.top - plot.bottom)) / (domainBottom - domainTop);
const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.rank).toFixed(1)}`).join(' ');
const gridRanks = [...new Set([domainTop, Math.round((domainTop + domainBottom) / 2), domainBottom])];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" viewBox="0 0 ${width} ${height}">
  <title id="title">Daniele-Cangi public contribution rank in Denmark</title>
  <desc id="desc">Rank improved from number ${first.rank} on ${formatDate(first.date)} to number ${latest.rank} on ${formatDate(latest.date)}.</desc>
  <style>
    :root { color: #24292f; }
    .muted { fill: #57606a; }
    .grid { stroke: #d0d7de; }
    .line { stroke: #0969da; }
    .point { fill: #0969da; stroke: #ffffff; }
    .label { fill: #24292f; }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    @media (prefers-color-scheme: dark) {
      :root { color: #c9d1d9; }
      .muted { fill: #8b949e; }
      .grid { stroke: #30363d; }
      .line { stroke: #58a6ff; }
      .point { fill: #58a6ff; stroke: #0d1117; }
      .label { fill: #c9d1d9; }
    }
  </style>
  <text class="label" x="${plot.left}" y="26" font-size="18" font-weight="600">Public contribution rank</text>
  <text class="muted" x="${width - plot.right}" y="26" text-anchor="end" font-size="13">Lower is better</text>
  ${gridRanks.map((rank) => `<g><line class="grid" x1="${plot.left}" x2="${width - plot.right}" y1="${y(rank).toFixed(1)}" y2="${y(rank).toFixed(1)}" stroke-width="1"/><text class="muted" x="${plot.left - 14}" y="${(y(rank) + 5).toFixed(1)}" text-anchor="end" font-size="13">#${rank}</text></g>`).join('\n  ')}
  <path d="${path}" class="line" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  ${points.map((point, index) => `<g><circle class="point" cx="${x(index).toFixed(1)}" cy="${y(point.rank).toFixed(1)}" r="7" stroke-width="3"/><text class="label" x="${x(index).toFixed(1)}" y="${(y(point.rank) - 18).toFixed(1)}" text-anchor="${index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}" font-size="14" font-weight="600">#${point.rank} · ${formatNumber(point.contributions)} public</text><text class="muted" x="${x(index).toFixed(1)}" y="${height - 28}" text-anchor="${index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}" font-size="13">${escapeXml(formatDate(point.date))}</text></g>`).join('\n  ')}
</svg>
`;
await writeFile('assets/trajectory.svg', svg);

console.log(`Rendered README and trajectory through ${latest.date}`);
