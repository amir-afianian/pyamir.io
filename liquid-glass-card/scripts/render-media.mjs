// Renders the README images from the real template, through the same export path as the playground's Copy HTML.
// Needs libwebp's cwebp and img2webp on PATH (brew install webp).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PRESETS, allCards } from '../site/cards.js';
import { exportHtml, stateFromConfig, withOverrides } from '../site/share.js';
import { TEMPLATE } from './build-site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(root, '../media/liquid-glass-card');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-media-'));
const STAGE = { width: 992, height: 632 };
const FPS = 25;

const BANNER_CARD = {
  width: 620, height: 230,
  aria: 'Liquid Glass Card: an agent skill for real-refraction glass UI',
  html: `<span class="k">Agent skill</span>
<span class="v">Liquid Glass Card</span>
<span class="s">Real refraction, not just blur</span>`,
  css: '',
};

const templateText = fs.readFileSync(TEMPLATE, 'utf8');
const browser = await chromium.launch();

async function newPage(deviceScaleFactor, viewport = STAGE) {
  const page = await browser.newPage({ viewport, deviceScaleFactor });
  page.on('pageerror', e => { throw e; });
  return page;
}

const probe = await newPage(1);
await probe.goto('file://' + TEMPLATE);
const { defaults, metric } = await probe.evaluate(() => {
  const stage = document.getElementById('lg-stage');
  return {
    defaults: structuredClone(stage.lgConfig),
    metric: { aria: stage.getAttribute('aria-label'), html: stage.querySelector('.lg-content').innerHTML },
  };
});
await probe.close();
const CARDS = allCards(defaults, metric);
const baseState = stateFromConfig(defaults);
const pageHtml = (state, card = CARDS[state.c]) => exportHtml(templateText, defaults, state, card);

async function load(page, html, { frozen = true, stageCss = '' } = {}) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.addStyleTag({ content: `html,body{background:transparent!important}${stageCss}` });
  if (frozen) {
    await page.evaluate(() => Object.assign(document.getElementById('lg-stage').lgConfig.motion, { bounceIn: false, driftGlows: false }));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  return page.locator('#lg-stage').boundingBox();
}

const pngPath = name => path.join(TMP, `${name}.png`);
const webp = name =>
  execFileSync('cwebp', ['-quiet', '-q', '90', '-alpha_q', '100', pngPath(name), '-o', path.join(OUT, `${name}.webp`)]);

async function still(name, html, opts) {
  const page = await newPage(2, opts?.viewport);
  const box = await load(page, html, opts);
  const crop = opts?.crop?.(box);
  const clip = crop ? { ...crop, x: box.x + crop.x, y: box.y + crop.y } : box;
  await page.screenshot({ path: pngPath(name), clip, omitBackground: true });
  await page.close();
  webp(name);
}

async function gallery() {
  for (const preset of PRESETS) await still(`preset-${preset.id}`, pageHtml(withOverrides(baseState, preset)));
}

// Same glows, rim and nearly clear glass on both sides, cropped to the card's right edge: only refraction differs, so the bent dot grid is the one visible change.
async function comparison() {
  const look = withOverrides(baseState, { r: 0, f: 2, t: 0.2, i: [1.5, 1.1, 0.9] });
  const crop = box => {
    const rightEdge = box.width * defaults.card.x + defaults.card.width / 2;
    return { x: rightEdge - 250, y: box.height * defaults.card.y - 135, width: 380, height: 260 };
  };
  await still('compare-blur-only', pageHtml(look), { crop });
  await still('compare-refraction', pageHtml({ ...look, r: 55 }), { crop });
}

async function banner() {
  const wide = '.lg-stage{aspect-ratio:2/1!important;max-width:none!important;border-radius:0!important}';
  await still('banner', pageHtml(baseState, BANNER_CARD), { viewport: { width: 1312, height: 672 }, stageCss: wide });
}

// Paused fake time drives the template's requestAnimationFrame loop one frame at a time, so the motion is smooth however slow
// each screenshot is. install() alone keeps the clock running in real time, which skips the bounce-in.
async function hero() {
  const page = await newPage(1.5);
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  const box = await load(page, pageHtml(withOverrides(baseState, { r: 40, f: 6 })), { frozen: false });
  const centre = { x: box.x + box.width * defaults.card.x, y: box.y + box.height * defaults.card.y };
  const ease = u => u * u * (3 - 2 * u);
  const dragPath = u => ({ x: 230 * Math.sin(2 * Math.PI * ease(u)), y: 95 * Math.sin(4 * Math.PI * ease(u)) });

  const frames = [];
  const step = async () => {
    await page.clock.runFor(1000 / FPS);
    const file = path.join(TMP, `hero-${String(frames.length).padStart(4, '0')}.png`);
    await page.screenshot({ path: file, clip: box, omitBackground: true });
    frames.push(file);
  };
  const hold = async seconds => { for (let i = 0; i < seconds * FPS; i++) await step(); };

  await hold(1.8);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  const dragFrames = 2.8 * FPS;
  for (let i = 1; i <= dragFrames; i++) {
    const { x, y } = dragPath(i / dragFrames);
    await page.mouse.move(centre.x + x, centre.y + y);
    await step();
  }
  await page.mouse.up();
  await hold(0.8);
  await page.close();

  execFileSync('img2webp', ['-loop', '0', '-lossy', '-q', '72', '-m', '4', '-kmin', '0', '-kmax', '1', '-d', String(1000 / FPS), ...frames, '-o', path.join(OUT, 'hero.webp')]);
}

try {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  for (const [name, job] of Object.entries({ gallery, comparison, banner, hero })) {
    if (only.length && !only.includes(name)) continue;
    await job();
    console.log(`rendered ${name}`);
  }
} finally {
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
}
