// Generates the source assets that @capacitor/assets needs to emit
// platform-specific icons + splash screens.
//
// Outputs to `resources/`:
//   - icon.png   1024x1024 — base for all iOS + Android icons
//   - splash.png 2732x2732 — base for all splash screens
//
// Run once whenever the brand changes; then `npm run cap:assets` to fan out
// to ios/App/App/Assets.xcassets/ and android/app/src/main/res/.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RES_DIR = path.resolve(__dirname, '..', 'resources');
await fs.mkdir(RES_DIR, { recursive: true });

const BG = '#1F1430';
const FG = '#FFD89C';

// 1024 icon. Same logo geometry as the PWA icons, just bigger.
function iconSvg() {
  const size = 1024;
  const r = size * 0.18;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/>
      <text x="${size / 2}" y="${size / 2}"
            font-family="ui-serif, Georgia, serif"
            font-weight="700"
            font-size="${size * 0.5}"
            fill="${FG}"
            text-anchor="middle"
            dominant-baseline="central">gL</text>
    </svg>
  `;
}

// 2732 splash — centered logo on the brand background. @capacitor/assets
// uses the centre of this canvas regardless of device aspect ratio.
function splashSvg() {
  const size = 2732;
  const logo = 460;
  const cx = size / 2;
  const cy = size / 2;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${BG}"/>
      <text x="${cx}" y="${cy}"
            font-family="ui-serif, Georgia, serif"
            font-weight="700"
            font-size="${logo}"
            fill="${FG}"
            text-anchor="middle"
            dominant-baseline="central">goodLoot</text>
    </svg>
  `;
}

await sharp(Buffer.from(iconSvg())).png().toFile(path.join(RES_DIR, 'icon.png'));
console.log('✓ resources/icon.png (1024x1024)');

await sharp(Buffer.from(splashSvg())).png().toFile(path.join(RES_DIR, 'splash.png'));
console.log('✓ resources/splash.png (2732x2732)');

// Dark variant (same as light for goodLoot — brand is dark already).
await sharp(Buffer.from(splashSvg())).png().toFile(path.join(RES_DIR, 'splash-dark.png'));
console.log('✓ resources/splash-dark.png');

console.log('\nNext: npm run cap:assets   # fans out to ios/ + android/ native projects');
