const sharp = require('sharp');
const fs = require('fs');

async function generateIcons() {
  const svgBuffer = fs.readFileSync('assets/logo_yinyang.svg');

  // Generate 192x192 icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('assets/logo_yinyang_192.png');

  console.log('Generated 192x192 icon');

  // Generate 512x512 icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('assets/logo_yinyang_512.png');

  console.log('Generated 512x512 icon');

  // Also generate logo.png (used elsewhere)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('assets/logo.png');

  console.log('Generated logo.png');
}

generateIcons().catch(console.error);
