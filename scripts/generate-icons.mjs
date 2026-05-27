// Generates PWA icons from an inline SVG source.
// Run once (or whenever the brand changes): `node scripts/generate-icons.mjs`.
//
// Output: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png,
// apple-touch-icon.png. The maskable variant has 20% padding so the
// Android adaptive icon cropping doesn't clip the design.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, '..', 'public', 'icons');
await fs.mkdir(ICONS_DIR, { recursive: true });

// Brand: deep purple background (matches theme_color), warm gold "gL" mark.
// Keep it pure SVG so the file is tiny and re-renders crisply at any size.
const BG = '#1F1430';
const FG = '#FFD89C';
const ACCENT = '#FFC83D';

function svg({ size, padding = 0.08 }) {
  // padding is a fraction of size; design lives inside the padded box.
  const pad = Math.round(size * padding);
  const inner = size - pad * 2;
  const r = size * 0.18; // rounded square corner
  // Treasure-chest emoji-ish glyph — use clean geometric shapes for clarity
  // at 192px. A gold "G" in the centre with a tiny chest underneath.
  const fontSize = inner * 0.55;
  const cx = size / 2;
  const cy = size / 2;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/>
      <text x="${cx}" y="${cy}"
            font-family="ui-serif, Georgia, serif"
            font-weight="700"
            font-size="${fontSize}"
            fill="${FG}"
            text-anchor="middle"
            dominant-baseline="central">gL</text>
      <circle cx="${cx}" cy="${size - pad * 1.5}" r="${inner * 0.04}" fill="${ACCENT}"/>
    </svg>
  `;
}

async function emit(size, name, padding = 0.08) {
  const src = Buffer.from(svg({ size, padding }));
  const out = path.join(ICONS_DIR, name);
  await sharp(src).png().toFile(out);
  console.log(`✓ ${name} (${size}x${size})`);
}

await emit(192, 'icon-192.png', 0.10);
await emit(512, 'icon-512.png', 0.10);
// Maskable: Android crops 20% from each side, so the design lives inside a
// safe zone of 60% of the canvas. Increase padding so the "gL" mark doesn't
// get clipped.
await emit(512, 'icon-maskable-512.png', 0.20);
await emit(180, 'apple-touch-icon.png', 0.10);

console.log('Done. Drop a designed asset under public/icons/ to replace.');
