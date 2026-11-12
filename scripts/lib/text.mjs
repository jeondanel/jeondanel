// Converts text to SVG path data using the bundled fonts, so the chosen typeface
// renders identically everywhere (GitHub's <img> sandbox blocks web fonts).
import opentype from 'opentype.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const fontDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const cache = new Map();

export const FONTS = {
  display: 'Cinzel-SemiBold.ttf',
  medium: 'Montserrat-Medium.ttf',
  semibold: 'Montserrat-SemiBold.ttf',
};

function load(key) {
  if (!cache.has(key)) cache.set(key, opentype.loadSync(join(fontDir, FONTS[key])));
  return cache.get(key);
}

/** Width of `text` in px, including letter spacing (no trailing space). */
export function measure(text, { font = 'medium', size = 14, spacing = 0 } = {}) {
  const f = load(font);
  const glyphs = f.stringToGlyphs(text);
  let w = 0;
  glyphs.forEach((g, i) => {
    w += (g.advanceWidth * size) / f.unitsPerEm;
    if (i < glyphs.length - 1) w += spacing + (f.getKerningValue(g, glyphs[i + 1]) * size) / f.unitsPerEm;
  });
  return w;
}

/**
 * Returns an SVG <path> element for `text`.
 * `anchor` is 'start' | 'middle' | 'end'; (x, y) is the baseline anchor point.
 */
export function textPath(text, { x, y, font = 'medium', size = 14, spacing = 0, anchor = 'start', fill = '#fff', opacity } = {}) {
  const f = load(font);
  const width = measure(text, { font, size, spacing });
  let cursor = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const glyphs = f.stringToGlyphs(text);
  let d = '';
  glyphs.forEach((g, i) => {
    d += g.getPath(cursor, y, size).toPathData(2);
    cursor += (g.advanceWidth * size) / f.unitsPerEm + spacing;
    if (i < glyphs.length - 1) cursor += (f.getKerningValue(g, glyphs[i + 1]) * size) / f.unitsPerEm;
  });
  const op = opacity == null ? '' : ` fill-opacity="${opacity}"`;
  return `<path aria-hidden="true" fill="${fill}"${op} d="${d}"/>`;
}

export const escapeXml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
