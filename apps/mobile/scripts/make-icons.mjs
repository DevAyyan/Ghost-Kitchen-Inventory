// Renders the app icons (Android, splash, favicon, web install) from the Fluent Emoji ghost in
// components/halloween/art-data.ts, with ImageMagick 7 (`magick`). Run from apps/mobile:
//   node scripts/make-icons.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BG = '#120e15';
const root = fileURLToPath(new URL('..', import.meta.url));
const src = readFileSync(join(root, 'components/halloween/art-data.ts'), 'utf8');
const ghost = JSON.parse(src.match(/ghost: ("<svg[^\n]*"),/)[1]);
const svg = join(mkdtempSync(join(tmpdir(), 'gk-icons-')), 'ghost.svg');
writeFileSync(svg, ghost);

// [file, size, ghost share of the canvas, background]. Android adaptive icons and maskable web icons are
// cropped to a circle or squircle, so their ghost stays inside the middle ~60%.
const OUT = [
  ['assets/images/icon.png', 1024, 0.62, BG],
  ['assets/images/adaptive-icon.png', 1024, 0.5, 'none'],
  ['assets/images/splash.png', 1024, 0.4, 'none'],
  ['assets/images/favicon.png', 48, 0.9, 'none'],
  ['public/icons/icon-192.png', 192, 0.62, BG],
  ['public/icons/icon-512.png', 512, 0.62, BG],
  ['public/icons/maskable-512.png', 512, 0.5, BG],
  ['public/icons/apple-touch-icon.png', 180, 0.62, BG],
];

for (const [file, size, share, bg] of OUT) {
  const g = Math.round(size * share);
  execFileSync('magick', [
    '-background', 'none', '-density', '1200', svg, '-resize', `${g}x${g}`,
    '-gravity', 'center', '-background', bg, '-extent', `${size}x${size}`, `PNG32:${join(root, file)}`,
  ]);
  console.log(file, size);
}
