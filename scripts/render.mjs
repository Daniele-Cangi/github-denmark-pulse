import { readFile, writeFile } from 'node:fs/promises';
import {
  escapeXml,
  formatDate,
  formatNumber,
  integer,
  readHistory,
  snapshotSha256
} from './lib.mjs';

const history = await readHistory();
if (history.length < 2) throw new Error('At least two observations are required to render a trajectory');

const points = history.map((row) => ({
  date: row.date,
  rank: integer(row.public_rank, `${row.date}.public_rank`),
  contributions: integer(row.public_contributions, `${row.date}.public_contributions`)
}));
const latest = points.at(-1);
const first = points[0];
const snapshotPath = `snapshots/${latest.date}.json`;
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const snapshotProof = await snapshotSha256(snapshotPath);
const rankImprovement = first.rank - latest.rank;
const milestoneRanks = [100, 75, 50, 25, 1];
const milestoneLabel = (rank) => (rank === 1 ? '#1' : `Top ${rank}`);
const milestoneAchievements = milestoneRanks
  .map((rank) => ({ rank, observation: points.find((point) => point.rank <= rank) }))
  .filter(({ observation }) => observation);
const nextMilestoneRank = milestoneRanks.find((rank) => !points.some((point) => point.rank <= rank)) ?? null;
const nextMilestoneDistance = nextMilestoneRank === null ? 0 : latest.rank - nextMilestoneRank;

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

const historyStart = '<!-- history:start -->';
const historyEnd = '<!-- history:end -->';
const historyRows = points.map((point, index) => {
  if (index === 0) {
    return `| ${formatDate(point.date)} | #${point.rank} | ${formatNumber(point.contributions)} | baseline |`;
  }
  const change = points[index - 1].rank - point.rank;
  const changeLabel = change === 0 ? 'no change' : `${change > 0 ? '+' : '-'}${Math.abs(change)} places`;
  return `| ${formatDate(point.date)} | #${point.rank} | ${formatNumber(point.contributions)} | ${changeLabel} |`;
});
const historyDynamic = `${historyStart}
| Date | Public rank | Public contributions | Change |
| --- | ---: | ---: | ---: |
${historyRows.join('\n')}
${historyEnd}`;
const historyPattern = new RegExp(`${historyStart}[\\s\\S]*?${historyEnd}`);
if (!historyPattern.test(readme)) throw new Error('README history markers are missing');
readme = readme.replace(historyPattern, historyDynamic);

const milestonesStart = '<!-- milestones:start -->';
const milestonesEnd = '<!-- milestones:end -->';
const milestoneRows = milestoneAchievements.length > 0
  ? milestoneAchievements
      .map(({ rank, observation }) =>
        `| **${milestoneLabel(rank)}** | ${formatDate(observation.date)} | #${observation.rank} | [Snapshot](snapshots/${observation.date}.json) |`)
      .join('\n')
  : '| _None yet_ | — | — | — |';
const nextMilestoneLine = nextMilestoneRank === null
  ? '**Highest milestone recorded:** #1.'
  : `**Next:** ${milestoneLabel(nextMilestoneRank)} — **${nextMilestoneDistance} place${nextMilestoneDistance === 1 ? '' : 's'}** away.`;
const milestonesDynamic = `${milestonesStart}
| Milestone | First verified observation | Observed rank | Evidence |
| --- | --- | ---: | --- |
${milestoneRows}

${nextMilestoneLine}
${milestonesEnd}`;
const milestonesPattern = new RegExp(`${milestonesStart}[\\s\\S]*?${milestonesEnd}`);
if (!milestonesPattern.test(readme)) throw new Error('README milestone markers are missing');
readme = readme.replace(milestonesPattern, milestonesDynamic);
await writeFile('README.md', readme);

const observationNumber = String(points.length).padStart(2, '0');
const engineShort = snapshot.provenance.action_commit_sha?.slice(0, 8) ?? 'historical';
const proofShort = snapshotProof.slice(0, 12);
const movement = snapshot.movement?.rank_improvement ?? rankImprovement;
const movementLabel = `${movement >= 0 ? '↑' : '↓'}${Math.abs(movement)}`;
const fingerprintBars = [...snapshotProof.slice(0, 32)]
  .map((character, index) => {
    const x = 60 + (index * 768) / 31;
    const height = 8 + Number.parseInt(character, 16) * 2;
    const y = 250 - height;
    return `<rect class="fingerprint" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="12" height="${height.toFixed(1)}" rx="2"/>`;
  })
  .join('\n  ');

const observationSvg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="observation-title observation-desc" viewBox="0 0 900 300">
  <title id="observation-title">GitHub Denmark Pulse observation ${observationNumber}</title>
  <desc id="observation-desc">On ${formatDate(latest.date)}, Daniele-Cangi ranked number ${latest.rank} with ${formatNumber(latest.contributions)} public contributions. The bars are a non-temporal fingerprint of the canonical snapshot hash, whose proof begins ${proofShort}.</desc>
  <style>
    .frame, .rule { fill: none; stroke: #d0d7de; }
    .text { fill: #24292f; }
    .muted { fill: #57606a; }
    .fingerprint { fill: #0969da; }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    @media (prefers-color-scheme: dark) {
      .frame, .rule { stroke: #30363d; }
      .text { fill: #c9d1d9; }
      .muted { fill: #8b949e; }
      .fingerprint { fill: #58a6ff; }
    }
  </style>
  <rect class="frame" x="0.5" y="0.5" width="899" height="299"/>
  <text class="text" x="60" y="38" font-size="14" font-weight="500" letter-spacing="2">GITHUB DENMARK PULSE</text>
  <text class="muted" x="840" y="38" text-anchor="end" font-size="13">OBSERVATION ${observationNumber}</text>
  <line class="rule" x1="60" x2="840" y1="56" y2="56"/>
  <text class="muted" x="60" y="88" font-size="12" letter-spacing="1">PUBLIC RANK</text>
  <text class="text" x="60" y="146" font-size="58" font-weight="500">#${latest.rank}</text>
  <text class="muted" x="285" y="88" font-size="12" letter-spacing="1">PUBLIC CONTRIBUTIONS</text>
  <text class="text" x="285" y="138" font-size="42" font-weight="500">${formatNumber(latest.contributions)}</text>
  <text class="muted" x="570" y="88" font-size="12" letter-spacing="1">MOVEMENT</text>
  <text class="text" x="570" y="138" font-size="42" font-weight="500">${movementLabel}</text>
  <text class="muted" x="570" y="162" font-size="12">since ${formatDate(snapshot.movement?.baseline_date ?? first.date)}</text>
  <line class="rule" x1="60" x2="840" y1="180" y2="180"/>
  <text class="muted" x="60" y="204" font-size="11" letter-spacing="1.2">SNAPSHOT FINGERPRINT · SHA-256</text>
  ${fingerprintBars}
  <text class="muted" x="60" y="278" font-size="12" letter-spacing="0.5">ENGINE ${engineShort} · PROOF ${proofShort}</text>
  <text class="muted" x="840" y="278" text-anchor="end" font-size="12">${escapeXml(formatDate(latest.date))}</text>
</svg>
`;
await writeFile('assets/observation.svg', observationSvg);

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

const trajectorySvg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc" viewBox="0 0 ${width} ${height}">
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
await writeFile('assets/trajectory.svg', trajectorySvg);

const ladderPlot = { x: 450, top: 86, bottom: 398 };
const ladderBottomRank = Math.max(150, Math.ceil(Math.max(...points.map((point) => point.rank)) / 25) * 25);
const ladderY = (rank) =>
  ladderPlot.top + ((rank - 1) * (ladderPlot.bottom - ladderPlot.top)) / (ladderBottomRank - 1);
const firstLadderY = ladderY(first.rank);
const latestLadderY = ladderY(latest.rank);
const movementMidY = (firstLadderY + latestLadderY) / 2;
const movementWord = rankImprovement >= 0 ? 'climbed' : 'fell';
const ladderMilestones = [...milestoneRanks].reverse().map((rank) => {
  const reached = points.some((point) => point.rank <= rank);
  const isNext = rank === nextMilestoneRank;
  const status = reached ? 'reached' : isNext ? 'next' : 'future';
  const suffix = reached
    ? ' · REACHED'
    : isNext
      ? ` · NEXT (${nextMilestoneDistance} PLACE${nextMilestoneDistance === 1 ? '' : 'S'})`
      : '';
  const emphasized = reached || isNext;
  return `<g><line class="milestone ${status}" data-milestone="${rank}" data-status="${status}" x1="438" x2="462" y1="${ladderY(rank).toFixed(1)}" y2="${ladderY(rank).toFixed(1)}" stroke-width="5" stroke-linecap="round"/><text class="${emphasized ? 'label' : 'muted'}" x="490" y="${(ladderY(rank) + 4).toFixed(1)}" font-size="13" font-weight="${emphasized ? '600' : '400'}">${milestoneLabel(rank).toUpperCase()}${suffix}</text></g>`;
}).join('\n  ');

const ladderSvg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="ladder-title ladder-desc" viewBox="0 0 900 460">
  <title id="ladder-title">Daniele-Cangi Denmark ranking ladder</title>
  <desc id="ladder-desc">Number 1 is at the top. Public contribution rank ${movementWord} ${Math.abs(rankImprovement)} places from number ${first.rank} on ${formatDate(first.date)} to number ${latest.rank} on ${formatDate(latest.date)}. ${nextMilestoneRank === null ? 'The number 1 milestone is recorded.' : `${milestoneLabel(nextMilestoneRank)} is ${nextMilestoneDistance} places away.`}</desc>
  <style>
    .frame, .rule, .track, .connector { fill: none; stroke: #d0d7de; }
    .label { fill: #24292f; }
    .muted { fill: #57606a; }
    .climb { stroke: #0969da; }
    .current { fill: #0969da; stroke: #ffffff; }
    .baseline { fill: #6e7781; stroke: #ffffff; }
    .milestone.reached { stroke: #1a7f37; }
    .milestone.next { stroke: #0969da; }
    .milestone.future { stroke: #afb8c1; }
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    @media (prefers-color-scheme: dark) {
      .frame, .rule, .track, .connector { stroke: #30363d; }
      .label { fill: #c9d1d9; }
      .muted { fill: #8b949e; }
      .climb, .milestone.next { stroke: #58a6ff; }
      .current { fill: #58a6ff; stroke: #0d1117; }
      .baseline { fill: #8b949e; stroke: #0d1117; }
      .milestone.reached { stroke: #3fb950; }
      .milestone.future { stroke: #484f58; }
    }
  </style>
  <rect class="frame" x="0.5" y="0.5" width="899" height="459"/>
  <text class="label" x="60" y="34" font-size="16" font-weight="600" letter-spacing="1.5">RANKING LADDER</text>
  <text class="muted" x="840" y="34" text-anchor="end" font-size="12" letter-spacing="0.8">#1 IS HIGHER · LOWER NUMBER = BETTER</text>
  <line class="rule" x1="60" x2="840" y1="52" y2="52"/>
  <line class="track" x1="450" x2="450" y1="86" y2="398" stroke-width="4" stroke-linecap="round"/>
  ${ladderMilestones}
  <line class="climb" x1="450" x2="450" y1="${firstLadderY.toFixed(1)}" y2="${latestLadderY.toFixed(1)}" stroke-width="6" stroke-linecap="round"/>
  <line class="connector" x1="418" x2="438" y1="${latestLadderY.toFixed(1)}" y2="${latestLadderY.toFixed(1)}"/>
  <circle class="current" data-rank="${latest.rank}" cx="450" cy="${latestLadderY.toFixed(1)}" r="10" stroke-width="3"/>
  <text class="label" x="408" y="${(latestLadderY + 5).toFixed(1)}" text-anchor="end" font-size="15" font-weight="600">${escapeXml(formatDate(latest.date))} · #${latest.rank}</text>
  <line class="connector" x1="418" x2="438" y1="${firstLadderY.toFixed(1)}" y2="${firstLadderY.toFixed(1)}"/>
  <circle class="baseline" data-rank="${first.rank}" cx="450" cy="${firstLadderY.toFixed(1)}" r="7" stroke-width="3"/>
  <text class="muted" x="408" y="${(firstLadderY + 5).toFixed(1)}" text-anchor="end" font-size="13">${escapeXml(formatDate(first.date))} · #${first.rank}</text>
  <text class="label" x="400" y="${(movementMidY + 5).toFixed(1)}" text-anchor="end" font-size="14" font-weight="600">${rankImprovement >= 0 ? '↑' : '↓'} ${Math.abs(rankImprovement)} PLACES</text>
  <line class="rule" x1="60" x2="840" y1="418" y2="418"/>
  <text class="muted" x="60" y="442" font-size="11" letter-spacing="0.8">FIRST VERIFIED THRESHOLDS · NOT A FORECAST</text>
  <text class="muted" x="840" y="442" text-anchor="end" font-size="11">through ${escapeXml(formatDate(latest.date))}</text>
</svg>
`;
await writeFile('assets/ladder.svg', ladderSvg);

console.log(`Rendered observation ${observationNumber}, trajectory, ladder, and milestones through ${latest.date}`);
