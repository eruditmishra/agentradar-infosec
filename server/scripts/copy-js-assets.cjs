/**
 * copy-js-assets.cjs
 *
 * Post-build script: copies all plain .js files from src/ into the
 * corresponding location inside dist/ so that TypeScript-compiled modules
 * that import them (e.g. providerDeepAlign -> adversarial/adverarialInventory)
 * can resolve them at runtime.
 *
 * tsc only emits files it compiled from .ts; it silently drops .js sources.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist', 'src');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const rel  = path.relative(SRC, full);
      const dest = path.join(DIST, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(full, dest);
      console.log(`[copy-js-assets] ${rel} → dist/src/${rel}`);
    }
  }
}

walk(SRC);
console.log('[copy-js-assets] done.');
