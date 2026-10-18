import { test, expect } from '@playwright/test';
import { TEMPLATE, collectErrors, frames, freezeMotion } from './helpers.js';

// A throw inside the render loop leaves the canvas blank but present, so pixel and DOM checks alone can pass on a broken template.
async function openStill(page) {
  const errors = collectErrors(page), warnings = [];
  page.on('console', m => m.type() === 'warning' && warnings.push(m.text()));
  await page.goto('file://' + TEMPLATE);
  await freezeMotion(page);
  await frames(page);
  expect(errors).toEqual([]);
  return { errors, warnings };
}

const stage = page => page.locator('#lg-stage');
const setGlows = (page, glows) => page.evaluate(g => { document.getElementById('lg-stage').lgConfig.glows = g; }, glows);

test('renders the WebGL glass, not the CSS fallback', async ({ page }) => {
  await openStill(page);
  await expect(stage(page)).not.toHaveClass(/lg-fallback/);
  await expect(stage(page).locator('canvas')).toHaveCount(1);
});

test('identical config renders identical pixels', async ({ page }) => {
  await openStill(page);
  const a = await stage(page).screenshot();
  await frames(page);
  expect((await stage(page).screenshot()).equals(a)).toBe(true);
});

test('edits to stage.lgConfig apply without a reload', async ({ page }) => {
  await openStill(page);
  const before = await stage(page).screenshot();
  await page.evaluate(() => {
    const cfg = document.getElementById('lg-stage').lgConfig;
    cfg.glows[0].color = '#00c8ff';
    cfg.glass.tintAmount = 0.6;
  });
  await frames(page);
  expect((await stage(page).screenshot()).equals(before)).toBe(false);
});

test('more than three glows: extras are dropped with a single warning', async ({ page }) => {
  const { errors, warnings } = await openStill(page);
  const base = await stage(page).screenshot();
  const glows = await page.evaluate(() => document.getElementById('lg-stage').lgConfig.glows);
  await setGlows(page, [...glows, { color: '#00ff00', x: 0.1, y: 0.1, r: 0.3, intensity: 3 }]);
  await frames(page);
  expect(errors).toEqual([]);
  expect((await stage(page).screenshot()).equals(base)).toBe(true);
  expect(warnings).toHaveLength(1);
});

test('a glow with only a colour still renders, using defaults', async ({ page }) => {
  const { errors } = await openStill(page);
  const base = await stage(page).screenshot();
  await setGlows(page, [{ color: '#00c8ff' }]);
  await frames(page);
  expect(errors).toEqual([]);
  expect((await stage(page).screenshot()).equals(base)).toBe(false);
});

test('a still card stops redrawing until its config changes', async ({ page }) => {
  await page.addInitScript(() => {
    const draw = WebGLRenderingContext.prototype.drawArrays;
    window.__draws = 0;
    WebGLRenderingContext.prototype.drawArrays = function (...args) { window.__draws++; return draw.apply(this, args); };
  });
  await openStill(page);
  await page.evaluate(() => { window.__draws = 0; });
  await frames(page, 10);
  expect(await page.evaluate(() => window.__draws)).toBe(0);
  await page.evaluate(() => { document.getElementById('lg-stage').lgConfig.glass.refraction = 40; });
  await frames(page);
  expect(await page.evaluate(() => window.__draws)).toBeGreaterThan(0);
});
