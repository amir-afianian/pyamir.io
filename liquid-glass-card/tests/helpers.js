export { TEMPLATE } from '../scripts/build-site.mjs';

// Each helper takes a Page or a Frame, so the same code drives the bare template and the one inside the playground's iframe.
export const frames = (target, n = 3) => target.evaluate(n => new Promise(done => {
  const tick = k => (k ? requestAnimationFrame(() => tick(k - 1)) : done());
  tick(n);
}), n);

export const freezeMotion = target => target.evaluate(() => {
  const { motion } = document.getElementById('lg-stage').lgConfig;
  motion.bounceIn = false;
  motion.driftGlows = false;
});

export const readConfig = target => target.evaluate(() => JSON.parse(JSON.stringify(document.getElementById('lg-stage').lgConfig)));

export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}
