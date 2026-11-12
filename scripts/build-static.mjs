// Rebuilds the static artwork: the title text in assets/crimson-rain.svg, assets/stack.svg
// and the project cards in assets/projects/.
// Run with: npm run build:static (from the scripts/ folder).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { textPath, measure } from './lib/text.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');

/* ---------------------------------------------------------------- banner */
const bannerPath = join(assets, 'crimson-rain.svg');
const title = [
  '<path d="M570 104H630" stroke="#e5384f" stroke-width="2.5" stroke-linecap="round"/>',
  textPath('DANEL TUNGPALAN', { x: 600, y: 152, font: 'display', size: 44, spacing: 7, anchor: 'middle', fill: '#f4f4f6' }),
  textPath('INFORMATION TECHNOLOGY STUDENT', { x: 600, y: 182, font: 'medium', size: 12.5, spacing: 4.5, anchor: 'middle', fill: '#b9b7c3' }),
  textPath('WEB  ·  SOFTWARE  ·  HARDWARE', { x: 600, y: 204, font: 'medium', size: 10.5, spacing: 4, anchor: 'middle', fill: '#7d7a88' }),
].join('\n    ');
const nameWidth = measure('DANEL TUNGPALAN', { font: 'display', size: 44, spacing: 7 });
console.log(`banner name width: ${nameWidth.toFixed(0)}px (spans ${(600 - nameWidth / 2).toFixed(0)}–${(600 + nameWidth / 2).toFixed(0)})`);

const banner = readFileSync(bannerPath, 'utf8').replace(
  /<!-- title:start -->[\s\S]*?<!-- title:end -->/,
  `<!-- title:start -->\n    ${title}\n    <!-- title:end -->`,
);
writeFileSync(bannerPath, banner);

/* ----------------------------------------------------------- stack panel */
const icon = (name) => `data:image/svg+xml;base64,${readFileSync(join(assets, 'icons', `${name}.svg`)).toString('base64')}`;

const W = 1000;
const GAP = 20;
const CARD_H = 168;
const cards = [
  { title: 'LANGUAGES', x: 0, y: 0, w: W, items: [['javascript', 'JavaScript'], ['typescript', 'TypeScript'], ['php', 'PHP'], ['csharp', 'C#'], ['html5', 'HTML'], ['css3', 'CSS']] },
  { title: 'FRONTEND & BUILD', x: 0, y: CARD_H + GAP, w: (W - 2 * GAP) / 3, items: [['svelte', 'Svelte'], ['vite', 'Vite']] },
  { title: 'DATABASE & SERVER', x: (W - 2 * GAP) / 3 + GAP, y: CARD_H + GAP, w: (W - 2 * GAP) / 3, items: [['mysql', 'MySQL'], ['apache', 'Apache'], ['xampp', 'XAMPP']] },
  { title: 'HARDWARE & TOOLING', x: 2 * ((W - 2 * GAP) / 3 + GAP), y: CARD_H + GAP, w: (W - 2 * GAP) / 3, items: [['arduino', 'Arduino'], ['github', 'GitHub']] },
];
const H = 2 * CARD_H + GAP;

const body = cards
  .map((c) => {
    const slot = (c.w - 48) / c.items.length;
    const tiles = c.items
      .map(([file, label], i) => {
        const cx = c.x + 24 + slot * (i + 0.5);
        return [
          `<rect x="${(cx - 32).toFixed(1)}" y="${c.y + 58}" width="64" height="64" rx="14" fill="#1d1d26" stroke="#2a2a33"/>`,
          `<image href="${icon(file)}" x="${(cx - 20).toFixed(1)}" y="${c.y + 70}" width="40" height="40"/>`,
          textPath(label, { x: cx, y: c.y + 144, font: 'medium', size: 12, anchor: 'middle', fill: '#c9c9d0' }),
        ].join('\n    ');
      })
      .join('\n    ');
    return [
      `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${CARD_H}" rx="14" fill="#14141a" stroke="#2a2a33"/>`,
      `<path d="M${c.x + 24} ${c.y + 46}h22" stroke="#e5384f" stroke-width="2" stroke-linecap="round"/>`,
      textPath(c.title, { x: c.x + 24, y: c.y + 36, font: 'semibold', size: 11, spacing: 3, fill: '#ff6a7c' }),
      tiles,
    ].join('\n    ');
  })
  .join('\n\n    ');

const labels = cards.flatMap((c) => c.items.map((i) => i[1])).join(', ');
writeFileSync(
  join(assets, 'stack.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">Tech stack: ${labels}</title>
  <g>
    ${body}
  </g>
</svg>
`,
);
console.log('wrote assets/crimson-rain.svg title + assets/stack.svg');

/* ------------------------------------------------------- project cards */
const projects = [
  { file: 'ecohydrate', tag: 'HARDWARE', name: 'EcoHydrate', stack: ['arduino', 'csharp'],
    desc: 'Exchanges inserted plastic bottles for timed water refills using sensors and automated dispensing.' },
  { file: 'enrollment', tag: 'WEB APPLICATION', name: 'Enrollment & Registration', stack: ['php', 'mysql', 'javascript', 'html5', 'css3'],
    desc: 'Centralizes student applications, subject selection, and registrar enrollment management.' },
  { file: 'qatrail', tag: 'SOFTWARE TESTING', name: 'QATrail', chip: 'Test management',
    desc: 'Connects test cases, execution results, and bug tracking in one workflow.' },
  { file: 'portfolio', tag: 'WEB', name: 'Portfolio', stack: ['svelte', 'typescript', 'vite'],
    desc: 'A one-page portfolio with project, about, and contact sections.' },
];

function wrap(text, opts, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, opts) > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  return line ? [...lines, line] : lines;
}

const CW = 490, CH = 210;
mkdirSync(join(assets, 'projects'), { recursive: true });
projects.forEach((p, i) => {
  const descOpts = { font: 'regular', size: 13.5 };
  const lines = wrap(p.desc, descOpts, CW - 48);
  if (lines.length > 3) console.warn(`! ${p.file}: description wraps to ${lines.length} lines`);

  const bottom = p.chip
    ? (() => {
        const w = measure(p.chip, { font: 'medium', size: 11.5, spacing: 0.5 }) + 28;
        return [
          `<rect x="24" y="160" width="${w.toFixed(1)}" height="30" rx="15" fill="#1d1d26" stroke="#2a2a33"/>`,
          textPath(p.chip, { x: 24 + w / 2, y: 179, font: 'medium', size: 11.5, spacing: 0.5, anchor: 'middle', fill: '#c9c9d0' }),
        ];
      })()
    : p.stack.flatMap((name, k) => [
        `<rect x="${24 + k * 42}" y="158" width="34" height="34" rx="9" fill="#1d1d26" stroke="#2a2a33"/>`,
        `<image href="${icon(name)}" x="${31 + k * 42}" y="165" width="20" height="20"/>`,
      ]);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" role="img" aria-labelledby="title desc">
  <title id="title">${p.name.replace(/&/g, '&amp;')}</title>
  <desc id="desc">${p.desc}${p.stack ? ` Built with ${p.stack.join(', ')}.` : ` ${p.chip}.`}</desc>
  <rect x=".5" y=".5" width="${CW - 1}" height="${CH - 1}" rx="14" fill="#14141a" stroke="#2a2a33"/>
  <path d="M24 46h22" stroke="#e5384f" stroke-width="2" stroke-linecap="round"/>
  ${textPath(p.tag, { x: 24, y: 36, font: 'semibold', size: 11, spacing: 3, fill: '#ff6a7c' })}
  ${textPath(String(i + 1).padStart(2, '0'), { x: CW - 24, y: 48, font: 'display', size: 34, anchor: 'end', fill: '#2a2a33' })}
  ${textPath(p.name, { x: 24, y: 86, font: 'display', size: 28, spacing: 0.5, fill: '#f4f4f6' })}
  ${lines.map((l, k) => textPath(l, { x: 24, y: 114 + k * 20, ...descOpts, fill: '#c9c9d0' })).join('\n  ')}
  ${bottom.join('\n  ')}
  ${textPath('View repository', { x: CW - 40, y: 180, font: 'medium', size: 11.5, spacing: 0.5, anchor: 'end', fill: '#ff6a7c' })}
  <path d="M${CW - 33} 173l5.5 5.5-5.5 5.5" fill="none" stroke="#ff6a7c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
  writeFileSync(join(assets, 'projects', `${p.file}.svg`), svg);
});
console.log(`wrote ${projects.length} project cards`);
