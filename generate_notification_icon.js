/*
 * Generates the Android status-bar notification icon (`ic_stat_notification.png`)
 * from `balance_logo.png` — the 和 (Harmony) kanji inside a circle.
 *
 * Android status-bar icons must be white-only on a transparent background;
 * the system ignores RGB colour and tints via `iconColor` at runtime
 * (see capacitor.config.ts → LocalNotifications.iconColor).
 *
 * Run once (or whenever the logo changes):
 *   node generate_notification_icon.js
 *
 * Outputs PNGs to android/app/src/main/res/drawable-{m,h,xh,xxh,xxxh}dpi/.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, 'balance_logo.png');
const RES_DIR = path.join(__dirname, 'android/app/src/main/res');

// Standard Android notification-icon densities.
const SIZES = [
  { dir: 'drawable-mdpi', size: 24 },
  { dir: 'drawable-hdpi', size: 36 },
  { dir: 'drawable-xhdpi', size: 48 },
  { dir: 'drawable-xxhdpi', size: 72 },
  { dir: 'drawable-xxxhdpi', size: 96 },
];

async function generate({ dir, size }) {
  const outDir = path.join(RES_DIR, dir);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'ic_stat_notification.png');

  // 1) Load the source, grayscale, resize.
  const { data, info } = await sharp(SOURCE)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 2) Turn luminance into a white silhouette on transparent:
  //    dark pixels (the kanji & ring) -> opaque white,
  //    light pixels (background)      -> transparent.
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i++) {
    const lum = data[i];
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = 255 - lum;
  }

  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outFile);

  console.log(`wrote ${path.relative(__dirname, outFile)} (${size}x${size})`);
}

(async () => {
  for (const entry of SIZES) await generate(entry);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
