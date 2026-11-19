// Re-vendor the pinned Three.js browser build from node_modules into
// public/vendor/ (served locally by the overlay; never loaded from a CDN).
// three.module.js imports ./three.core.js, so BOTH files must be vendored
// together. Run after `npm ci` / `npm install`:
//   npm run vendor:three
import { copyFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['three.module.js', 'three.core.js'];
const srcDir = path.join(ROOT, 'node_modules', 'three', 'build');
const destDir = path.join(ROOT, 'public', 'vendor');

mkdirSync(destDir, { recursive: true });
for (const file of FILES) {
  const from = path.join(srcDir, file);
  const to = path.join(destDir, file);
  copyFileSync(from, to);
  const a = createHash('sha256').update(readFileSync(from)).digest('hex');
  const b = createHash('sha256').update(readFileSync(to)).digest('hex');
  if (a !== b) {
    console.error(`vendor:three hash mismatch: ${file}`);
    process.exit(1);
  }
  console.log(`${file}: sha256 ${a.slice(0, 16)}… ok`);
}
console.log('vendor:three done — three.module.js + three.core.js in public/vendor/');
