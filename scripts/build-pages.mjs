import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite as buildLiquidGlassCard } from '../liquid-glass-card/scripts/build-site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'site'), out, { recursive: true });
// Each plugin's demo is served from its own folder name, so pyamir.io/<plugin>/ mirrors the repo layout.
buildLiquidGlassCard(path.join(out, 'liquid-glass-card'));
console.log('built _site/');
