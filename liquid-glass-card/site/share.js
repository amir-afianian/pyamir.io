// Pure state logic: no DOM. A state is the part of LG_CONFIG the playground edits, plus the card type.
export const RANGES = {
  r: { min: 0, max: 60, step: 1 },
  f: { min: 0, max: 30, step: 1 },
  d: { min: 0, max: 60, step: 1 },
  l: { min: 0, max: 360, step: 1 },
  t: { min: 0, max: 0.8, step: 0.01 },
  i: { min: 0, max: 2.5, step: 0.05 },
};
export const GLOW_COUNT = 3;

const HEX = /^[0-9a-f]{6}$/i;
const clamp = (v, { min, max }) => Math.min(max, Math.max(min, v));
export const num = x => String(Math.round(x * 100) / 100);

export function stateFromConfig(cfg) {
  const g = cfg.glass;
  return {
    c: 'metric',
    r: g.refraction, f: g.frost, d: g.dispersion, l: g.lightAngle, t: g.tintAmount,
    g: Array.from({ length: GLOW_COUNT }, (_, k) => (cfg.glows[k]?.color ?? '#000000').toLowerCase()),
    i: Array.from({ length: GLOW_COUNT }, (_, k) => cfg.glows[k]?.intensity ?? 0),
    n: cfg.dotGrid,
  };
}

export const withOverrides = (base, { id, ...overrides }) => ({ ...base, ...overrides });

export function applyState(cfg, s, card) {
  Object.assign(cfg.glass, { refraction: s.r, frost: s.f, dispersion: s.d, lightAngle: s.l, tintAmount: s.t });
  cfg.dotGrid = s.n;
  s.g.forEach((color, k) => {
    cfg.glows[k] ??= { x: 0.5, y: 0.5, r: 0.2 };
    Object.assign(cfg.glows[k], { color, intensity: s.i[k] });
  });
  Object.assign(cfg.card, { width: card.width, height: card.height });
}

export function encode(s) {
  return '#' + [
    ['r', num(s.r)], ['f', num(s.f)], ['d', num(s.d)], ['l', num(s.l)], ['t', num(s.t)],
    ['g', s.g.map(c => c.replace('#', '')).join(',')],
    ['i', s.i.map(num).join(',')],
    ['n', s.n ? 1 : 0],
    ['c', s.c],
  ].map(([k, v]) => `${k}=${v}`).join('&');
}

// Hand-edited hashes are expected: anything unparsable keeps the base value, numbers are clamped into range.
export function decode(hash, base, cardTypes) {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const s = structuredClone(base);
  for (const k of ['r', 'f', 'd', 'l', 't']) {
    const v = parseFloat(q.get(k));
    if (Number.isFinite(v)) s[k] = clamp(v, RANGES[k]);
  }
  (q.get('g') ?? '').split(',').slice(0, GLOW_COUNT).forEach((c, k) => { if (HEX.test(c)) s.g[k] = '#' + c.toLowerCase(); });
  (q.get('i') ?? '').split(',').slice(0, GLOW_COUNT).forEach((v, k) => {
    const x = parseFloat(v);
    if (Number.isFinite(x)) s.i[k] = clamp(x, RANGES.i);
  });
  if (q.has('n')) s.n = q.get('n') !== '0';
  if (cardTypes.includes(q.get('c'))) s.c = q.get('c');
  return s;
}

export function agentPrompt(s, base) {
  const lit = s.g.filter((_, k) => s.i[k] > 0);
  return [
    `/liquid-glass-card ${s.c} card`,
    `refraction ${num(s.r)}`, `frost ${num(s.f)}`, `dispersion ${num(s.d)}`, `light angle ${num(s.l)}`,
    ...(lit.length ? [`glows ${lit.join(' ')}`] : []),
    ...(s.t !== base.t ? [`tint ${num(s.t)}`] : []),
    ...(s.n !== base.n ? [s.n ? 'dot grid' : 'no dot grid'] : []),
  ].join(', ');
}

const escapeAttr = v => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function replaceOnce(text, pattern, replacement, what) {
  if (!pattern.test(text)) throw new Error(`template changed: could not find ${what}`);
  return text.replace(pattern, typeof replacement === 'function' ? replacement : () => replacement);
}

const FALLBACK_MARKER = '/* Fallback when WebGL';

// The live preview and the exported page both put card CSS here, so they share one cascade order.
export const withCardCss = (styleText, css) =>
  css ? replaceOnce(styleText, /\/\* Fallback when WebGL/, `${css}\n${FALLBACK_MARKER}`, 'fallback style marker') : styleText;

function reindent(markup, pad) {
  const rows = markup.replace(/^\s*\n|\s+$/g, '').split('\n');
  const common = Math.min(...rows.filter(r => r.trim()).map(r => r.match(/^ */)[0].length));
  return rows.map(r => (r.trim() ? pad + r.slice(common) : '')).join('\n');
}

const literal = v => (typeof v === 'string' ? JSON.stringify(v) : String(v));
const inline = o => `{ ${Object.entries(o).map(([k, v]) => `${k}: ${literal(v)}`).join(', ')} }`;

function patchLine(block, key, values) {
  return replaceOnce(block, new RegExp(`^[ \\t]*${key}:.*$`, 'm'), row =>
    Object.entries(values).reduce((r, [k, v]) => replaceOnce(r, new RegExp(`\\b${k}: [^,}\\s]+`), `${k}: ${literal(v)}`, `${key}.${k}`), row), key);
}

// Edits values inside the template's own LG_CONFIG so its explanatory comments survive. A string transform on purpose: there is no second template.
function patchConfig(block, cfg) {
  const { refraction, dispersion, frost, lightAngle, tintAmount } = cfg.glass;
  block = patchLine(block, 'card', { width: cfg.card.width, height: cfg.card.height });
  block = patchLine(block, 'glass', { refraction, dispersion, frost, lightAngle, tintAmount });
  block = patchLine(block, 'dotGrid', { dotGrid: cfg.dotGrid });
  return replaceOnce(block, /(glows: \[[^\n]*\n)[\s\S]*?(\n[ \t]*\],)/,
    (_, open, close) => open + cfg.glows.map(g => `    ${inline(g)}`).join(',\n') + close, 'LG_CONFIG glows');
}

export function buildHtml(templateText, cfg, card) {
  let html = replaceOnce(templateText, /const LG_CONFIG = \{[\s\S]*?\n\};/, block => patchConfig(block, cfg), 'LG_CONFIG');
  html = replaceOnce(html, /(<div class="lg-content" aria-hidden="true">)[\s\S]*?(\n([ \t]*)<\/div>)/,
    (_, open, close, indent) => `${open}\n${reindent(card.html, indent + '  ')}${close}`, '.lg-content');
  html = replaceOnce(html, /(<div class="lg-stage"[^>]*aria-label=")[^"]*"/, (_, open) => `${open}${escapeAttr(card.aria)}"`, 'aria-label');
  return withCardCss(html, card.css);
}

export function exportHtml(templateText, defaults, state, card) {
  const cfg = structuredClone(defaults);
  applyState(cfg, state, card);
  return buildHtml(templateText, cfg, card);
}
