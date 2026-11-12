// Generates self-hosted GitHub statistics cards (assets/stats/*.svg) from the public GitHub API.
// Because the SVGs are committed to the repo, the README never depends on a third-party
// image service being online. A scheduled workflow (.github/workflows/stats.yml) refreshes them.
//
// Usage: node generate-stats.mjs        (set GITHUB_TOKEN to raise API rate limits)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { textPath } from './lib/text.mjs';

const USER = process.env.PROFILE_USER || process.env.GITHUB_REPOSITORY_OWNER || 'jeondanel';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'stats');
mkdirSync(outDir, { recursive: true });

/* ------------------------------------------------------------------ API */
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'profile-stats-generator',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
  return res.json();
}

/** Run an optional data fetch; log and return `fallback` instead of failing the whole run. */
async function optional(label, fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`! ${label} unavailable: ${err.message}`);
    return fallback;
  }
}

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', PHP: '#8892bf', 'C#': '#3fa535', HTML: '#e34c26', CSS: '#7a5bd0',
  Svelte: '#ff3e00', 'C++': '#f34b7d', C: '#8a8a95', Python: '#3572a5', Java: '#b07219', Shell: '#89e051',
  SCSS: '#c6538c', Vue: '#41b883', Go: '#00add8', Rust: '#dea584', Kotlin: '#a97bff', Dart: '#00b4ab',
  PowerShell: '#4a7fb5', Batchfile: '#c1f12e', Makefile: '#427819',
};

/* ----------------------------------------------------------------- data */
async function collect() {
  const user = await api(`/users/${USER}`);
  const repos = (await api(`/users/${USER}/repos?per_page=100&type=owner&sort=pushed`)).filter((r) => !r.fork);

  const stars = repos.reduce((n, r) => n + r.stargazers_count, 0);

  const langBytes = {};
  await Promise.all(
    repos.map((r) =>
      optional(`languages for ${r.name}`, async () => {
        const langs = await api(`/repos/${r.full_name}/languages`);
        for (const [name, bytes] of Object.entries(langs)) langBytes[name] = (langBytes[name] || 0) + bytes;
      }),
    ),
  );

  const commits = await optional('commit count', async () => (await api(`/search/commits?q=author:${USER}&per_page=1`)).total_count);

  const events = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await optional(`events page ${page}`, () => api(`/users/${USER}/events/public?per_page=100&page=${page}`), []);
    events.push(...batch);
    if (batch.length < 100) break;
  }

  // With a token (always the case in the workflow) use the real contribution calendar;
  // without one, fall back to the public events feed, which only covers ~90 days.
  const calendar = process.env.GITHUB_TOKEN
    ? await optional('contribution calendar', async () => {
        const res = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{firstDay contributionDays{contributionCount}}}}}}`,
            variables: { login: USER },
          }),
        });
        const json = await res.json();
        const weeks = json.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
        if (!weeks) throw new Error(json.errors?.[0]?.message || `GraphQL ${res.status}`);
        return weeks.slice(-13).map((w) => ({
          start: Date.parse(w.firstDay),
          count: w.contributionDays.reduce((n, d) => n + d.contributionCount, 0),
        }));
      })
    : null;

  return { user, repos, stars, langBytes, commits, events, calendar };
}

/** Weekly activity buckets (weeks start Monday, UTC), oldest first. */
function weeklyActivity(events, weeks = 13) {
  const DAY = 86_400_000;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const thisMonday = today - ((now.getUTCDay() + 6) % 7) * DAY;
  const start = thisMonday - (weeks - 1) * 7 * DAY;
  const buckets = Array.from({ length: weeks }, (_, i) => ({ start: start + i * 7 * DAY, count: 0 }));
  const counted = new Set(['PushEvent', 'PullRequestEvent', 'PullRequestReviewEvent', 'IssuesEvent', 'IssueCommentEvent', 'CreateEvent']);

  for (const ev of events) {
    if (!counted.has(ev.type)) continue;
    if (ev.type === 'CreateEvent' && ev.payload?.ref_type !== 'repository') continue;
    const t = Date.parse(ev.created_at);
    const idx = Math.floor((t - start) / (7 * DAY));
    if (idx < 0 || idx >= weeks) continue;
    buckets[idx].count += ev.type === 'PushEvent' ? Math.max(1, ev.payload?.size ?? ev.payload?.commits?.length ?? 1) : 1;
  }
  return buckets;
}

/* ------------------------------------------------------------- rendering */
const C = { card: '#14141a', border: '#2a2a33', accent: '#e5384f', accentSoft: '#ff6a7c', text: '#f4f4f6', body: '#c9c9d0', muted: '#8d8b98' };
const fmt = (n) => Number(n).toLocaleString('en-US');
const stamp = new Date().toISOString().slice(0, 10);

function frame({ w, h, title, desc, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc">
  <title id="title">${title}</title>
  <desc id="desc">${desc}</desc>
  <rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="14" fill="${C.card}" stroke="${C.border}"/>
  ${body}
</svg>
`;
}

const heading = (label) => [
  `<path d="M24 46h22" stroke="${C.accent}" stroke-width="2" stroke-linecap="round"/>`,
  textPath(label, { x: 24, y: 36, font: 'semibold', size: 11, spacing: 3, fill: C.accentSoft }),
];

const footnote = (text, w) => textPath(text, { x: w - 24, y: 216, font: 'medium', size: 9.5, anchor: 'end', fill: C.muted });

function overviewCard({ user, repos, stars, commits }) {
  const stat = (x, y, value, label) => [
    textPath(value, { x, y, font: 'semibold', size: 28, fill: C.text }),
    textPath(label, { x, y: y + 20, font: 'medium', size: 10, spacing: 2, fill: C.muted }),
  ];
  const items = [
    stat(24, 106, fmt(repos.length), 'PUBLIC REPOSITORIES'),
    stat(256, 106, (commits == null ? '—' : fmt(commits)), 'PUBLIC COMMITS'),
    stat(24, 174, fmt(stars), 'STARS EARNED'),
    stat(256, 174, fmt(user.followers), 'FOLLOWERS'),
  ].flat();
  return frame({
    w: 490, h: 230,
    title: `GitHub overview for ${USER}`,
    desc: `${repos.length} public repositories, ${commits ?? 'an unknown number of'} public commits, ${stars} stars and ${user.followers} followers.`,
    body: [...heading('GITHUB OVERVIEW'), ...items, footnote(`@${USER}  ·  Updated ${stamp} UTC`, 490)].join('\n  '),
  });
}

function languagesCard({ langBytes }) {
  const entries = Object.entries(langBytes).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, b]) => n + b, 0) || 1;
  const top = entries.slice(0, 6);
  const otherBytes = entries.slice(6).reduce((n, [, b]) => n + b, 0);
  if (otherBytes) top.push(['Other', otherBytes]);
  const colorOf = (name) => (name === 'Other' ? '#4a4a55' : LANG_COLORS[name] || '#8d8b98');

  let x = 24;
  const barW = 442;
  const segs = top.map(([name, bytes]) => {
    const w = (bytes / total) * barW;
    const seg = `<rect x="${x.toFixed(2)}" y="64" width="${Math.max(w, 1).toFixed(2)}" height="12" fill="${colorOf(name)}"/>`;
    x += w;
    return seg;
  });

  const rows = top.map(([name, bytes], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const lx = 24 + col * 232;
    const y = 112 + row * 30;
    const pct = `${((bytes / total) * 100).toFixed(1)}%`;
    return [
      `<circle cx="${lx + 5}" cy="${y - 4}" r="5" fill="${colorOf(name)}"/>`,
      textPath(name, { x: lx + 18, y, font: 'medium', size: 12.5, fill: C.body }),
      textPath(pct, { x: lx + 206, y, font: 'medium', size: 12, anchor: 'end', fill: C.muted }),
    ].join('\n  ');
  });

  const summary = top.map(([n, b]) => `${n} ${((b / total) * 100).toFixed(1)}%`).join(', ');
  return frame({
    w: 490, h: 230,
    title: `Top languages for ${USER}`,
    desc: `Share of code by language across public, non-fork repositories: ${summary}.`,
    body: [
      ...heading('TOP LANGUAGES'),
      `<clipPath id="bar"><rect x="24" y="64" width="${barW}" height="12" rx="6"/></clipPath>`,
      `<g clip-path="url(#bar)">${segs.join('')}</g>`,
      ...rows,
      footnote('By bytes of code in public, non-fork repositories', 490),
    ].join('\n  '),
  });
}

function activityCard({ events, calendar }) {
  const weeks = calendar ?? weeklyActivity(events);
  const max = Math.max(...weeks.map((w) => w.count), 1);
  const total = weeks.reduce((n, w) => n + w.count, 0);
  const X0 = 24, X1 = 976, Y0 = 72, Y1 = 170; // chart box
  const px = (i) => X0 + ((X1 - X0) * i) / (weeks.length - 1);
  const py = (v) => Y1 - ((Y1 - Y0) * v) / max;
  const pts = weeks.map((w, i) => [px(i), py(w.count)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const area = `${line}L${X1} ${Y1}L${X0} ${Y1}Z`;
  const label = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  const grid = [0, 0.5, 1].map((f) => {
    const y = Y1 - (Y1 - Y0) * f;
    return `<path d="M${X0} ${y}H${X1}" stroke="${C.border}" stroke-width="1" ${f ? 'stroke-dasharray="3 5"' : ''}/>`;
  });
  const dots = pts.map(([x, y], i) => (weeks[i].count ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${C.card}" stroke="${C.accentSoft}" stroke-width="1.5"/>` : ''));

  const subtitle = `${fmt(total)} contributions · last ${weeks.length} weeks`;
  return frame({
    w: 1000, h: 230,
    title: `Recent public activity for ${USER}`,
    desc: `Weekly public GitHub activity over the last ${weeks.length} weeks: ${weeks.map((w) => w.count).join(', ')}.`,
    body: [
      `<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity=".45"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient></defs>`,
      ...heading('RECENT ACTIVITY'),
      textPath(subtitle, { x: 976, y: 36, font: 'medium', size: 11, anchor: 'end', fill: C.muted }),
      ...grid,
      total ? `<path d="${area}" fill="url(#fill)"/>` : '',
      total ? `<path d="${line}" fill="none" stroke="${C.accentSoft}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : '',
      ...dots,
      total ? '' : textPath('No public activity in this period', { x: 500, y: 126, font: 'medium', size: 12, anchor: 'middle', fill: C.muted }),
      textPath(`Week of ${label(weeks[0].start)}`, { x: X0, y: 194, font: 'medium', size: 10, fill: C.muted }),
      textPath(`Week of ${label(weeks.at(-1).start)}`, { x: X1, y: 194, font: 'medium', size: 10, anchor: 'end', fill: C.muted }),
      textPath(`Peak ${fmt(max)} / week`, { x: X1, y: Y0 - 8, font: 'medium', size: 10, anchor: 'end', fill: C.muted }),
      textPath(`Source: ${calendar ? 'GitHub contribution calendar' : 'GitHub public events API'}  ·  Updated ${stamp} UTC`, { x: 24, y: 216, font: 'medium', size: 9.5, fill: C.muted }),
    ].filter(Boolean).join('\n  '),
  });
}

/* ------------------------------------------------------------------ main */
try {
  const data = await collect();
  writeFileSync(join(outDir, 'overview.svg'), overviewCard(data));
  writeFileSync(join(outDir, 'languages.svg'), languagesCard(data));
  writeFileSync(join(outDir, 'activity.svg'), activityCard(data));
  console.log(`Stats for ${USER}: ${data.repos.length} repos, ${data.stars} stars, ${data.commits ?? '?'} commits, ${Object.keys(data.langBytes).length} languages, ${data.events.length} events.`);
} catch (err) {
  // Keep the previously generated cards so the README never shows a broken image.
  console.error(`Could not refresh stats: ${err.message}`);
  process.exit(existsSync(join(outDir, 'overview.svg')) ? 0 : 1);
}
