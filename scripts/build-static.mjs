// Rebuilds the static artwork: the title text in assets/crimson-rain.svg and assets/stack.svg.
// Run with: npm run build:static (from the scripts/ folder).
import { readFileSync, writeFileSync } from 'node:fs';
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
