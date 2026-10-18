import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATE = path.join(root, 'skills/liquid-glass-card/assets/liquid-glass-card.html');

// The playground never carries its own copy of the card: _site/template.html is always the skill's asset.
export function buildSite(out = path.join(root, '_site')) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(path.join(root, 'site'), out, { recursive: true });
  fs.copyFileSync(TEMPLATE, path.join(out, 'template.html'));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`built ${path.relative(root, buildSite())}/`);
}
