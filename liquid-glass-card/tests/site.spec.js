import { test, expect } from '@playwright/test';
import fs from 'fs';
import { TEMPLATE, collectErrors, frames as framesIn, freezeMotion, readConfig } from './helpers.js';

const stage = page => page.frameLocator('#lg-frame').locator('#lg-stage');
// The template's rAF loop runs inside the iframe, so waits and config reads target that frame.
const templateFrame = page => page.frame({ url: /\/template\.html$/ });
const frames = page => framesIn(templateFrame(page));
const lgConfig = page => readConfig(templateFrame(page));

async function openSite(page, hash = '') {
  const errors = collectErrors(page);
  await page.addInitScript(() => {
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { window.__copied.push(text); } },
    });
  });
  await page.goto('/' + hash);
  await expect(stage(page)).toBeVisible();
  await templateFrame(page).waitForFunction(() => document.getElementById('lg-stage')?.lgConfig);
  await freezeMotion(templateFrame(page));
  await frames(page);
  return errors;
}

const copied = page => page.evaluate(() => window.__copied.at(-1));
const hashOf = page => page.evaluate(() => location.hash);
const preset = (page, name) => page.locator(`[data-preset="${name}"]`);
const cardText = page => stage(page).locator('.lg-content').innerText();

test('loads with no page errors and renders WebGL in the card frame', async ({ page }) => {
  const errors = await openSite(page);
  await expect(stage(page)).not.toHaveClass(/lg-fallback/);
  await expect(stage(page).locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the playground runs the template file byte for byte', async ({ request }) => {
  const served = await (await request.get('/template.html')).text();
  expect(served).toBe(fs.readFileSync(TEMPLATE, 'utf8'));
});

test('moving the refraction slider drives the live config and changes the pixels', async ({ page }) => {
  await openSite(page);
  const before = await stage(page).screenshot();
  await page.locator('#ctl-refraction').fill('55');
  await frames(page);
  expect((await lgConfig(page)).glass.refraction).toBe(55);
  expect((await stage(page).screenshot()).equals(before)).toBe(false);
  await expect(page.locator('#out-refraction')).toHaveText('55');
});

test('each slider, glow colour, intensity and the dot grid write to the live config', async ({ page }) => {
  await openSite(page);
  await page.locator('#ctl-frost').fill('3');
  await page.locator('#ctl-dispersion').fill('33');
  await page.locator('#ctl-lightAngle').fill('120');
  await page.locator('#ctl-tintAmount').fill('0.5');
  await page.locator('#glow-1-color').fill('#00c8ff');
  await page.locator('#glow-1-intensity').fill('1.5');
  await page.locator('#ctl-dotGrid').uncheck();
  const cfg = await lgConfig(page);
  expect(cfg.glass).toMatchObject({ frost: 3, dispersion: 33, lightAngle: 120, tintAmount: 0.5 });
  expect(cfg.glows[1]).toMatchObject({ color: '#00c8ff', intensity: 1.5 });
  expect(cfg.dotGrid).toBe(false);
});

test('original preset is the template defaults with the metric card', async ({ page }) => {
  await openSite(page, '#c=pricing&r=50');
  await preset(page, 'original').click();
  await frames(page);
  const cfg = await lgConfig(page);
  expect(cfg.glass).toMatchObject({ refraction: 20, frost: 14, dispersion: 0, lightAngle: 300, tintAmount: 0.35 });
  expect(cfg.glows.map(g => g.color)).toEqual(['#ff6b14', '#f22e73', '#5940ff']);
  expect(await cardText(page)).toContain('$48,210');
  await expect(preset(page, 'original')).toHaveAttribute('aria-pressed', 'true');
});

const PRESETS = [
  { name: 'apple-clear', glass: { frost: 5, tintAmount: 0.2 }, card: 'profile' },
  { name: 'showy-liquid', glass: { refraction: 45, frost: 10 }, card: 'pricing' },
  { name: 'rainbow-edge', glass: { dispersion: 40 }, card: 'notification' },
];

for (const p of PRESETS) {
  test(`preset ${p.name} applies its look and card`, async ({ page }) => {
    const errors = await openSite(page);
    const metricText = await cardText(page);
    await preset(page, p.name).click();
    await frames(page);
    const cfg = await lgConfig(page);
    expect(cfg.glass).toMatchObject(p.glass);
    await expect(preset(page, p.name)).toHaveAttribute('aria-pressed', 'true');
    await expect(preset(page, 'original')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator(`[data-card="${p.card}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await cardText(page)).not.toBe(metricText);
    await expect(stage(page)).toHaveAttribute('aria-label', /.+/);
    await expect(stage(page)).not.toHaveAttribute('aria-label', /Revenue card/);
    expect(errors).toEqual([]);
    await expect(stage(page)).not.toHaveClass(/lg-fallback/);
  });
}

test('share URL round-trips controls and card into a fresh page', async ({ page }) => {
  await openSite(page);
  await page.locator('[data-card="pricing"]').click();
  await page.locator('#ctl-refraction').fill('35');
  await page.locator('#ctl-frost').fill('8');
  await page.locator('#ctl-dispersion').fill('12');
  await page.locator('#ctl-lightAngle').fill('210');
  await page.locator('#ctl-tintAmount').fill('0.45');
  await page.locator('#glow-0-color').fill('#112233');
  await page.locator('#glow-2-intensity').fill('0.4');
  await page.locator('#ctl-dotGrid').uncheck();
  await expect.poll(() => hashOf(page)).toContain('n=0');
  const hash = await hashOf(page);
  expect(hash).toMatch(/r=35/);
  expect(hash).toMatch(/g=112233,f22e73,5940ff/);
  const historyLength = await page.evaluate(() => history.length);
  expect(historyLength).toBeLessThanOrEqual(2);

  const fresh = await page.context().newPage();
  await openSite(fresh, hash);
  expect(await lgConfig(fresh)).toMatchObject({
    dotGrid: false,
    glass: { refraction: 35, frost: 8, dispersion: 12, lightAngle: 210, tintAmount: 0.45 },
  });
  expect((await lgConfig(fresh)).glows).toMatchObject([{ color: '#112233' }, { color: '#f22e73' }, { color: '#5940ff', intensity: 0.4 }]);
  await expect(fresh.locator('#ctl-refraction')).toHaveValue('35');
  await expect(fresh.locator('#ctl-dotGrid')).not.toBeChecked();
  await expect(fresh.locator('[data-card="pricing"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await cardText(fresh)).toBe(await cardText(page));
});

test('a hand-written hash with junk values is clamped or ignored, not fatal', async ({ page }) => {
  const errors = await openSite(page, '#r=9999&f=abc&g=zzz,ff0000&c=nope');
  const cfg = await lgConfig(page);
  expect(cfg.glass.refraction).toBe(60);
  expect(cfg.glass.frost).toBe(14);
  expect(cfg.glows[0].color).toBe('#ff6b14');
  expect(cfg.glows[1].color).toBe('#ff0000');
  expect(await cardText(page)).toContain('$48,210');
  expect(errors).toEqual([]);
});

test('copy agent prompt emits one line in the skill vocabulary', async ({ page }) => {
  await openSite(page, '#r=45&f=10&d=0&l=300&g=ff6b14,f22e73,5940ff&c=pricing');
  await page.locator('#btn-copy-prompt').click();
  await expect.poll(() => copied(page)).toBe(
    '/liquid-glass-card pricing card, refraction 45, frost 10, dispersion 0, light angle 300, glows #ff6b14 #f22e73 #5940ff',
  );
  await expect(page.locator('#status')).toContainText(/copied/i);
});

test('copy agent prompt names only lit glows and mentions non-default tint', async ({ page }) => {
  await openSite(page, '#g=ff6b14,f22e73,5940ff&i=1,0,1&t=0.5');
  await page.locator('#btn-copy-prompt').click();
  await expect.poll(() => copied(page)).toMatch(/glows #ff6b14 #5940ff, tint 0\.5$/);
});

test('copy HTML returns a standalone page that reflects the edited state', async ({ page }) => {
  await openSite(page, '#r=41&f=6&d=9&l=200&t=0.3&g=00c8ff,f22e73,5940ff&c=profile');
  await page.locator('#btn-copy-html').click();
  await expect.poll(() => copied(page)).toContain('<!doctype html>');
  const html = await copied(page);
  const label = await stage(page).getAttribute('aria-label');

  const standalone = await page.context().newPage();
  const errors = collectErrors(standalone);
  await standalone.setContent(html);
  await freezeMotion(standalone);
  await framesIn(standalone);
  expect(errors).toEqual([]);
  const stageEl = standalone.locator('#lg-stage');
  await expect(stageEl).not.toHaveClass(/lg-fallback/);
  await expect(stageEl).toHaveAttribute('aria-label', label);
  const cfg = await readConfig(standalone);
  expect(cfg.glass).toMatchObject({ refraction: 41, frost: 6, dispersion: 9, lightAngle: 200, tintAmount: 0.3 });
  expect(cfg.glows[0].color).toBe('#00c8ff');
  expect(await standalone.locator('.lg-content').innerText()).toBe(await cardText(page));
  expect(html).not.toContain('$48,210');
});

test('a clipboard failure is reported and the text stays reachable', async ({ page }) => {
  await openSite(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
    document.execCommand = () => false;
  });
  await page.locator('#btn-copy-prompt').click();
  await expect(page.locator('#status')).toContainText(/couldn.t copy/i);
  await expect(page.locator('#fallback-copy')).toHaveValue(/^\/liquid-glass-card /);
});

test('install section lists the four routes and copies a command', async ({ page }) => {
  await openSite(page);
  const install = page.locator('#install');
  for (const cmd of [
    '/plugin marketplace add amir-afianian/pyamir.io',
    '/plugin install liquid-glass-card@pyamir',
    'codex plugin marketplace add amir-afianian/pyamir.io',
    'codex plugin add liquid-glass-card@pyamir',
    'npx skills add amir-afianian/pyamir.io --skill liquid-glass-card',
  ]) await expect(install).toContainText(cmd);
  await expect(install).toContainText('liquid-glass-card.zip');
  await expect(install.locator('a[href="https://github.com/amir-afianian/pyamir.io/tree/main/liquid-glass-card"]').first()).toBeVisible();
  await expect(page.locator('a[href="https://www.youtube.com/watch?v=fJJ6YhaUWB8"]')).toBeVisible();
  await install.locator('.copy').first().click();
  await expect(install.locator('.copy').first()).toHaveAttribute('aria-label', 'Copy: /plugin marketplace add amir-afianian/pyamir.io');
  await expect.poll(() => copied(page)).toContain('/plugin marketplace add amir-afianian/pyamir.io');
});

test('replay bounce restarts the grow-in', async ({ page }) => {
  await openSite(page);
  await templateFrame(page).evaluate(() => {
    const st = document.getElementById('lg-stage');
    st.lgConfig.motion.bounceIn = true;
    window.__replays = 0;
    const orig = st.lgReplay;
    st.lgReplay = () => { window.__replays++; orig(); };
  });
  await page.locator('#btn-replay').click();
  expect(await templateFrame(page).evaluate(() => window.__replays)).toBe(1);
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('no horizontal scroll and the card fits', async ({ page }) => {
    await openSite(page);
    const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
    expect(scroll).toBeLessThanOrEqual(inner);
    const box = await page.locator('#lg-frame').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(15);
    expect(box.x + box.width).toBeLessThanOrEqual(inner - 15);
  });
});
