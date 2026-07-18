import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'store-listing', 'source');
const outputRoot = path.join(root, 'store-listing');
const logoPath = path.join(root, 'balance_logo_transparent.png');

const palette = {
  cream: '#F7F1E7',
  creamDeep: '#E9DCC4',
  ink: '#1E2533',
  gold: '#C89B32',
  goldLight: '#E1BE67',
  green: '#4F8A63',
  black: '#090A0D',
};

const slides = [
  { file: '01-community-challenge.jpg', eyebrow: 'BALANCE', title: ['Plant-based fitness', 'all in one place'] },
  { file: '02-vegan-meals.jpg', eyebrow: 'VEGAN NUTRITION', title: ['Meals made', 'much simpler'] },
  { file: '03-training.jpg', eyebrow: 'TRAINING', title: ['Train with', 'direction'] },
  { file: '04-learning.jpg', eyebrow: 'HEALTH IQ', title: ['Learn what', 'actually works'] },
  { file: '05-weekly-plan.jpg', eyebrow: 'YOUR PLAN', title: ['See your week', 'at a glance'] },
  { file: '06-community-feed.jpg', eyebrow: 'REAL PROGRESS', title: ['Share the wins', 'that matter'], redact: 'feed-member' },
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function backgroundSvg(width, height) {
  const circles = [
    [width * 0.88, height * 0.08, width * 0.23, palette.goldLight, 0.23],
    [width * 0.07, height * 0.44, width * 0.18, palette.green, 0.09],
    [width * 0.94, height * 0.79, width * 0.2, palette.gold, 0.1],
  ];
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette.cream}"/>
        <stop offset="1" stop-color="${palette.creamDeep}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    ${circles.map(([cx, cy, r, fill, opacity]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`).join('')}
  </svg>`);
}

function copySvg({ width, eyebrowY, titleY, eyebrowSize, titleSize, lineHeight, eyebrow, title }) {
  return Buffer.from(`<svg width="${width}" height="900" xmlns="http://www.w3.org/2000/svg">
    <style>
      .eyebrow { font-family: Arial, Helvetica, sans-serif; font-size: ${eyebrowSize}px; font-weight: 700; letter-spacing: 4px; fill: ${palette.gold}; }
      .title { font-family: Arial, Helvetica, sans-serif; font-size: ${titleSize}px; font-weight: 800; letter-spacing: -2px; fill: ${palette.ink}; }
    </style>
    <text x="${width / 2}" y="${eyebrowY}" text-anchor="middle" class="eyebrow">${escapeXml(eyebrow)}</text>
    <text x="${width / 2}" y="${titleY}" text-anchor="middle" class="title">
      <tspan x="${width / 2}" dy="0">${escapeXml(title[0])}</tspan>
      <tspan x="${width / 2}" dy="${lineHeight}">${escapeXml(title[1])}</tspan>
    </text>
  </svg>`);
}

async function prepareSource(slide) {
  const sourcePath = path.join(sourceDir, slide.file);
  if (slide.redact !== 'feed-member') return sourcePath;

  const meta = await sharp(sourcePath).metadata();
  const sx = meta.width / 1080;
  const sy = meta.height / 2340;
  const overlay = Buffer.from(`<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .member { font-family: Arial, Helvetica, sans-serif; font-size: ${Math.round(34 * sx)}px; font-weight: 700; fill: white; }
      .meta { font-family: Arial, Helvetica, sans-serif; font-size: ${Math.round(27 * sx)}px; fill: #A9A9A9; }
    </style>
    <rect x="${Math.round(105 * sx)}" y="${Math.round(250 * sy)}" width="${Math.round(620 * sx)}" height="${Math.round(145 * sy)}" fill="#151515"/>
    <text x="${Math.round(145 * sx)}" y="${Math.round(310 * sy)}" class="member">Balance member</text>
    <text x="${Math.round(145 * sx)}" y="${Math.round(360 * sy)}" class="meta">23h ago  •  4 views</text>
    <rect x="0" y="${Math.round(2000 * sy)}" width="${meta.width}" height="${Math.round(200 * sy)}" fill="#111111"/>
  </svg>`);
  return sharp(sourcePath).composite([{ input: overlay }]).jpeg({ quality: 96 }).toBuffer();
}

async function roundedScreen(sourceInput, width, radius) {
  const source = await sharp(sourceInput).resize({ width }).jpeg({ quality: 94 }).toBuffer();
  const meta = await sharp(source).metadata();
  const mask = Buffer.from(`<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="${radius}" fill="white"/></svg>`);
  return {
    buffer: await sharp(source).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(),
    width: meta.width,
    height: meta.height,
  };
}

async function renderSlide(slide, index, spec) {
  const screen = await roundedScreen(await prepareSource(slide), spec.phoneWidth, spec.radius);
  const screenLeft = Math.round((spec.width - screen.width) / 2);
  const screenTop = spec.screenTop;
  const border = Buffer.from(`<svg width="${spec.width}" height="${spec.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${screenLeft - spec.border}" y="${screenTop - spec.border}" width="${screen.width + spec.border * 2}" height="${screen.height + spec.border * 2}" rx="${spec.radius + spec.border}" fill="none" stroke="${palette.ink}" stroke-width="${spec.border * 2}"/>
  </svg>`);
  const shadow = Buffer.from(`<svg width="${spec.width}" height="${spec.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${screenLeft - 18}" y="${screenTop + 20}" width="${screen.width + 36}" height="${screen.height + 36}" rx="${spec.radius + 18}" fill="${palette.gold}" opacity="0.28"/>
  </svg>`);
  const copy = await sharp(copySvg({ width: spec.width, ...spec.copy, eyebrow: slide.eyebrow, title: slide.title }))
    .png()
    .toBuffer();

  const image = sharp(backgroundSvg(spec.width, spec.height))
    .composite([
      { input: copy, top: 0, left: 0 },
      { input: shadow, top: 0, left: 0 },
      { input: screen.buffer, top: screenTop, left: screenLeft },
      { input: border, top: 0, left: 0 },
    ]);

  const fileName = `${String(index + 1).padStart(2, '0')}-${path.basename(slide.file, '.jpg')}.png`;
  const destination = path.join(outputRoot, spec.directory, fileName);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await image.png({ compressionLevel: 9 }).toFile(destination);
  return destination;
}

async function renderFeatureGraphic() {
  const width = 1024;
  const height = 500;
  const nutrition = await roundedScreen(path.join(sourceDir, '02-vegan-meals.jpg'), 180, 20);
  const feed = await roundedScreen(await prepareSource(slides[5]), 180, 20);
  const logo = await sharp(logoPath).resize(84, 84, { fit: 'contain' }).png().toBuffer();
  const copy = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .brand { font-family: Arial, Helvetica, sans-serif; font-size: 34px; font-weight: 800; fill: ${palette.ink}; }
      .title { font-family: Arial, Helvetica, sans-serif; font-size: 58px; font-weight: 800; letter-spacing: -2px; fill: ${palette.ink}; }
      .tag { font-family: Arial, Helvetica, sans-serif; font-size: 21px; font-weight: 700; letter-spacing: 2px; fill: ${palette.gold}; }
    </style>
    <text x="132" y="75" class="brand">Balance</text>
    <text x="60" y="180" class="tag">PLANT-BASED FITNESS</text>
    <text x="60" y="250" class="title">Training. Meals.</text>
    <text x="60" y="315" class="title">Your community.</text>
    <text x="60" y="380" class="brand" font-size="25">All in one place.</text>
  </svg>`);
  const mask = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="0" fill="white"/></svg>`);

  const output = path.join(root, 'store-listing', 'google-play', 'en-AU', 'images', 'featureGraphic.png');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(backgroundSvg(width, height))
    .composite([
      { input: copy, top: 0, left: 0 },
      { input: logo, top: 18, left: 40 },
      { input: feed.buffer, top: 38, left: 790 },
      { input: nutrition.buffer, top: 88, left: 660 },
      { input: mask, blend: 'dest-in' },
    ])
    .png({ compressionLevel: 9 })
    .toFile(output);
  return output;
}

const specs = [
  {
    directory: path.join('app-store-screenshots', 'en-AU'), width: 1290, height: 2796, phoneWidth: 920,
    screenTop: 660, radius: 64, border: 8,
    copy: { eyebrowY: 155, titleY: 285, eyebrowSize: 30, titleSize: 82, lineHeight: 92 },
  },
  {
    directory: path.join('google-play', 'en-AU', 'images', 'phoneScreenshots'), width: 1080, height: 1920, phoneWidth: 700,
    screenTop: 370, radius: 48, border: 7,
    copy: { eyebrowY: 90, titleY: 190, eyebrowSize: 24, titleSize: 66, lineHeight: 72 },
  },
];

const outputs = [];
for (const spec of specs) {
  for (const [index, slide] of slides.entries()) outputs.push(await renderSlide(slide, index, spec));
}
outputs.push(await renderFeatureGraphic());
console.log(`Generated ${outputs.length} store-listing assets:`);
outputs.forEach((file) => console.log(path.relative(root, file)));
