import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'store-listing', 'source');
const outputRoot = path.join(root, 'store-listing');
const logoPath = path.join(root, 'balance_logo_transparent.png');

const palette = {
  cream: '#F7F1E7',
  creamDeep: '#E6D4AE',
  ink: '#18202F',
  gold: '#D7A62D',
  goldLight: '#F2D77B',
  green: '#4F8A63',
  purple: '#351453',
  purpleDark: '#120B1E',
  black: '#090A0D',
  white: '#FFFDF8',
};

const slides = [
  { slug: 'coach', layout: 'coach' },
  { slug: 'challenges', layout: 'challenges' },
  { slug: 'vegan-meals', layout: 'meals' },
  { slug: 'training', layout: 'training' },
  { slug: 'community', layout: 'community' },
  { slug: 'progress', layout: 'progress' },
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function svg(width, height, body) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
}

function backgroundSvg(width, height, variant = 'cream') {
  const gradients = {
    cream: [palette.cream, palette.creamDeep],
    purple: [palette.purpleDark, palette.purple],
    gold: ['#F6C746', '#B96B0D'],
    green: ['#102C21', '#244C35'],
  };
  const [start, end] = gradients[variant];
  const light = variant === 'cream' ? palette.gold : palette.goldLight;
  return svg(width, height, `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${start}"/>
        <stop offset="1" stop-color="${end}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <circle cx="${width * 0.9}" cy="${height * 0.08}" r="${width * 0.34}" fill="${light}" opacity="0.14"/>
    <circle cx="${width * 0.04}" cy="${height * 0.75}" r="${width * 0.28}" fill="${variant === 'cream' ? palette.green : palette.white}" opacity="0.07"/>
  `);
}

function textSvg({ width, height, eyebrow, lines, y, fill = palette.ink, align = 'middle', x, titleSize, lineHeight, body, bodyY, badge }) {
  const anchor = align === 'start' ? 'start' : 'middle';
  const textX = x ?? (anchor === 'middle' ? width / 2 : width * 0.08);
  const eyebrowSize = Math.round(titleSize * 0.28);
  const eyebrowY = y - titleSize * 1.22;
  const bodySize = Math.round(titleSize * 0.42);
  const badgeMarkup = badge ? `
    <rect x="${textX - (anchor === 'middle' ? badge.width / 2 : 0)}" y="${badge.y}" width="${badge.width}" height="${badge.height}" rx="${badge.height / 2}" fill="${badge.fill ?? palette.gold}"/>
    <text x="${textX + (anchor === 'middle' ? 0 : badge.width / 2)}" y="${badge.y + badge.height * 0.65}" text-anchor="middle" class="badge">${escapeXml(badge.text)}</text>
  ` : '';
  return svg(width, height, `
    <style>
      .eyebrow { font-family: Arial, Helvetica, sans-serif; font-size: ${eyebrowSize}px; font-weight: 800; letter-spacing: ${Math.max(3, eyebrowSize * 0.16)}px; fill: ${palette.goldLight}; }
      .title { font-family: Arial, Helvetica, sans-serif; font-size: ${titleSize}px; font-weight: 900; letter-spacing: -${Math.max(1, titleSize * 0.025)}px; fill: ${fill}; }
      .body { font-family: Arial, Helvetica, sans-serif; font-size: ${bodySize}px; font-weight: 600; fill: ${fill}; opacity: 0.88; }
      .badge { font-family: Arial, Helvetica, sans-serif; font-size: ${Math.round(titleSize * 0.26)}px; font-weight: 800; letter-spacing: 2px; fill: ${badge?.textFill ?? palette.ink}; }
    </style>
    <text x="${textX}" y="${eyebrowY}" text-anchor="${anchor}" class="eyebrow">${escapeXml(eyebrow)}</text>
    <text x="${textX}" y="${y}" text-anchor="${anchor}" class="title">
      ${lines.map((line, index) => `<tspan x="${textX}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}
    </text>
    ${body ? `<text x="${textX}" y="${bodyY}" text-anchor="${anchor}" class="body">${escapeXml(body)}</text>` : ''}
    ${badgeMarkup}
  `);
}

async function roundedImage(input, width, height, radius, options = {}) {
  const image = await sharp(input)
    .resize(width, height, { fit: options.fit ?? 'cover', position: options.position ?? 'centre' })
    .png()
    .toBuffer();
  const mask = svg(width, height, `<rect width="100%" height="100%" rx="${radius}" fill="white"/>`);
  return sharp(image).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function fullPhoto(input, width, height, position = 'centre') {
  return sharp(input).resize(width, height, { fit: 'cover', position }).jpeg({ quality: 94 }).toBuffer();
}

function frameSvg(width, height, left, top, frameWidth, frameHeight, radius, color = palette.goldLight) {
  return svg(width, height, `
    <rect x="${left - 6}" y="${top + 16}" width="${frameWidth + 12}" height="${frameHeight + 12}" rx="${radius + 6}" fill="#000" opacity="0.25"/>
    <rect x="${left - 4}" y="${top - 4}" width="${frameWidth + 8}" height="${frameHeight + 8}" rx="${radius + 4}" fill="none" stroke="${color}" stroke-width="8"/>
  `);
}

async function prepareFeedSource() {
  const sourcePath = path.join(sourceDir, '06-community-feed.jpg');
  const meta = await sharp(sourcePath).metadata();
  const sx = meta.width / 1080;
  const sy = meta.height / 2340;
  const overlay = svg(meta.width, meta.height, `
    <style>
      .member { font-family: Arial, Helvetica, sans-serif; font-size: ${Math.round(34 * sx)}px; font-weight: 700; fill: white; }
      .meta { font-family: Arial, Helvetica, sans-serif; font-size: ${Math.round(27 * sx)}px; fill: #A9A9A9; }
    </style>
    <rect x="${Math.round(100 * sx)}" y="${Math.round(250 * sy)}" width="${Math.round(650 * sx)}" height="${Math.round(145 * sy)}" fill="#151515"/>
    <text x="${Math.round(145 * sx)}" y="${Math.round(310 * sy)}" class="member">Balance member</text>
    <text x="${Math.round(145 * sx)}" y="${Math.round(360 * sy)}" class="meta">23h ago  •  4 views</text>
    <rect x="0" y="${Math.round(1990 * sy)}" width="${meta.width}" height="${Math.round(225 * sy)}" fill="#111111"/>
  `);
  return sharp(sourcePath).composite([{ input: overlay }]).jpeg({ quality: 96 }).toBuffer();
}

async function challengeCard() {
  const cropped = await sharp(path.join(sourceDir, 'challenge-home.jpg'))
    .extract({ left: 34, top: 282, width: 522, height: 214 })
    .jpeg({ quality: 96 })
    .toBuffer();
  return cropped;
}

async function renderCoach(spec) {
  const photo = await fullPhoto(path.join(sourceDir, 'shannon-coaching.jpg'), spec.width, spec.height, 'right');
  const overlay = svg(spec.width, spec.height, `
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#08090D" stop-opacity="0.22"/>
        <stop offset="0.46" stop-color="#08090D" stop-opacity="0.04"/>
        <stop offset="1" stop-color="#08090D" stop-opacity="0.94"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#shade)"/>
  `);
  const logoSize = Math.round(spec.width * 0.11);
  const logo = await sharp(logoPath).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer();
  const copy = textSvg({
    width: spec.width, height: spec.height, eyebrow: 'MEET YOUR COACH',
    lines: ['Plant-based fitness.', 'Real support.'],
    y: Math.round(spec.height * 0.72), fill: palette.white, align: 'start',
    x: Math.round(spec.width * 0.08), titleSize: Math.round(spec.width * 0.077), lineHeight: Math.round(spec.width * 0.09),
    body: 'Coach-led training with Shannon', bodyY: Math.round(spec.height * 0.84),
    badge: { text: 'TRAIN • CHECK IN • GROW', y: Math.round(spec.height * 0.885), width: Math.round(spec.width * 0.62), height: Math.round(spec.width * 0.075), fill: palette.goldLight },
  });
  return sharp(photo).composite([
    { input: overlay }, { input: logo, left: Math.round(spec.width * 0.07), top: Math.round(spec.height * 0.035) }, { input: copy },
  ]).png().toBuffer();
}

async function renderChallenges(spec) {
  const cardWidth = Math.round(spec.width * 0.84);
  const cardHeight = Math.round(cardWidth * 214 / 522);
  const card = await roundedImage(await challengeCard(), cardWidth, cardHeight, Math.round(spec.width * 0.035));
  const cardLeft = Math.round((spec.width - cardWidth) / 2);
  const cardTop = Math.round(spec.height * 0.29);
  const title = textSvg({
    width: spec.width, height: spec.height, eyebrow: 'COACH-LED CHALLENGES',
    lines: ['Show up together.', 'Finish stronger.'], y: Math.round(spec.height * 0.12),
    fill: palette.white, titleSize: Math.round(spec.width * 0.072), lineHeight: Math.round(spec.width * 0.083),
  });
  const rows = svg(spec.width, spec.height, `
    <style>
      .num { font-family: Arial, Helvetica, sans-serif; font-size: ${Math.round(spec.width * 0.035)}px; font-weight: 900; fill: ${palette.ink}; }
      .head { font-family: Arial, Helvetica, sans-serif; font-size: ${Math.round(spec.width * 0.045)}px; font-weight: 800; fill: ${palette.white}; }
      .sub { font-family: Arial, Helvetica, sans-serif; font-size: ${Math.round(spec.width * 0.028)}px; font-weight: 600; fill: ${palette.white}; opacity: 0.72; }
    </style>
    ${[
      ['01', 'Train to a shared goal', 'Structured workouts and weekly targets'],
      ['02', 'Check in with your people', 'Community support when motivation dips'],
      ['03', 'Celebrate every milestone', 'Progress, PBs and friendly competition'],
    ].map((row, index) => {
      const y = spec.height * (0.58 + index * 0.115);
      return `<circle cx="${spec.width * 0.14}" cy="${y}" r="${spec.width * 0.055}" fill="${palette.goldLight}"/>
        <text x="${spec.width * 0.14}" y="${y + spec.width * 0.012}" text-anchor="middle" class="num">${row[0]}</text>
        <text x="${spec.width * 0.23}" y="${y - spec.width * 0.005}" class="head">${row[1]}</text>
        <text x="${spec.width * 0.23}" y="${y + spec.width * 0.04}" class="sub">${row[2]}</text>`;
    }).join('')}
  `);
  return sharp(backgroundSvg(spec.width, spec.height, 'purple')).composite([
    { input: title }, { input: frameSvg(spec.width, spec.height, cardLeft, cardTop, cardWidth, cardHeight, Math.round(spec.width * 0.035)) },
    { input: card, left: cardLeft, top: cardTop }, { input: rows },
  ]).png().toBuffer();
}

async function renderMeals(spec) {
  const meal = await fullPhoto(path.join(root, 'images', 'meals', 'sweet_potato_black_bean_tacos.png'), spec.width, spec.height, 'centre');
  const shade = svg(spec.width, spec.height, `
    <defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111" stop-opacity="0.76"/><stop offset="0.43" stop-color="#111" stop-opacity="0.06"/><stop offset="1" stop-color="#111" stop-opacity="0.78"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#shade)"/>
  `);
  const title = textSvg({
    width: spec.width, height: spec.height, eyebrow: 'VEGAN NUTRITION', lines: ['Eat for strength.', 'Without guessing.'],
    y: Math.round(spec.height * 0.115), fill: palette.white, titleSize: Math.round(spec.width * 0.072), lineHeight: Math.round(spec.width * 0.083),
  });
  const phoneWidth = Math.round(spec.width * 0.5);
  const phoneHeight = Math.round(phoneWidth * 2340 / 1080);
  const phone = await roundedImage(path.join(sourceDir, '02-vegan-meals.jpg'), phoneWidth, phoneHeight, Math.round(spec.width * 0.035), { fit: 'cover' });
  const tilted = await sharp(phone).rotate(-3, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const left = Math.round(spec.width * 0.49);
  const top = Math.round(spec.height * 0.34);
  const callout = svg(spec.width, spec.height, `
    <style>.pill { font-family: Arial, Helvetica, sans-serif; font-size: ${Math.round(spec.width * 0.031)}px; font-weight: 800; fill: ${palette.ink}; }</style>
    <rect x="${spec.width * 0.04}" y="${spec.height * 0.67}" width="${spec.width * 0.42}" height="${spec.height * 0.18}" rx="${spec.width * 0.05}" fill="${palette.white}" opacity="0.96"/>
    <text x="${spec.width * 0.11}" y="${spec.height * 0.72}" class="pill">✓ Vegan meal plans</text>
    <text x="${spec.width * 0.11}" y="${spec.height * 0.765}" class="pill">✓ Nutrition tracking</text>
    <text x="${spec.width * 0.11}" y="${spec.height * 0.81}" class="pill">✓ Easy food logging</text>
  `);
  return sharp(meal).composite([
    { input: shade }, { input: title }, { input: callout }, { input: tilted, left, top },
  ]).png().toBuffer();
}

async function renderTraining(spec) {
  const photoHeight = Math.round(spec.height * 0.57);
  const photo = await fullPhoto(path.join(sourceDir, 'shannon-training.jpg'), spec.width, photoHeight, 'centre');
  const title = textSvg({
    width: spec.width, height: spec.height, eyebrow: 'TRAINING WITH DIRECTION', lines: ['Always know', 'what to train.'],
    y: Math.round(spec.height * 0.095), fill: palette.white, titleSize: Math.round(spec.width * 0.074), lineHeight: Math.round(spec.width * 0.084),
  });
  const photoShade = svg(spec.width, photoHeight, `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#120B1E" stop-opacity="0.7"/><stop offset="1" stop-color="#120B1E" stop-opacity="0.04"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`);
  const screenWidth = Math.round(spec.width * 0.77);
  const screenHeight = Math.round(screenWidth * 1.2);
  const screen = await roundedImage(path.join(sourceDir, '03-training.jpg'), screenWidth, screenHeight, Math.round(spec.width * 0.035), { fit: 'cover', position: 'top' });
  const left = Math.round((spec.width - screenWidth) / 2);
  const top = Math.round(spec.height * 0.46);
  return sharp(backgroundSvg(spec.width, spec.height, 'purple')).composite([
    { input: photo, left: 0, top: 0 }, { input: photoShade, left: 0, top: 0 }, { input: title },
    { input: frameSvg(spec.width, spec.height, left, top, screenWidth, screenHeight, Math.round(spec.width * 0.035)) },
    { input: screen, left, top },
  ]).png().toBuffer();
}

async function renderCommunity(spec) {
  const feed = await prepareFeedSource();
  const feedMeta = await sharp(feed).metadata();
  const feedCrop = await sharp(feed).extract({
    left: 0,
    top: Math.round(feedMeta.height * 0.08),
    width: feedMeta.width,
    height: Math.round(feedMeta.height * 0.84),
  }).jpeg({ quality: 96 }).toBuffer();
  const phoneWidth = Math.round(spec.width * 0.73);
  const phoneHeight = Math.round(phoneWidth * 1.45);
  const screen = await roundedImage(feedCrop, phoneWidth, phoneHeight, Math.round(spec.width * 0.04), { fit: 'cover', position: 'bottom' });
  const left = Math.round((spec.width - phoneWidth) / 2);
  const top = Math.round(spec.height * 0.31);
  const title = textSvg({
    width: spec.width, height: spec.height, eyebrow: 'PLANT-BASED COMMUNITY', lines: ['Your people', 'celebrate every win.'],
    y: Math.round(spec.height * 0.105), fill: palette.ink, titleSize: Math.round(spec.width * 0.07), lineHeight: Math.round(spec.width * 0.082),
  });
  const badge = svg(spec.width, spec.height, `
    <rect x="${spec.width * 0.16}" y="${spec.height * 0.865}" width="${spec.width * 0.68}" height="${spec.width * 0.1}" rx="${spec.width * 0.05}" fill="${palette.ink}"/>
    <text x="${spec.width * 0.5}" y="${spec.height * 0.865 + spec.width * 0.065}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${spec.width * 0.033}" font-weight="800" fill="${palette.white}" letter-spacing="1">SHARE • SUPPORT • KEEP GOING</text>
  `);
  return sharp(backgroundSvg(spec.width, spec.height, 'cream')).composite([
    { input: title }, { input: frameSvg(spec.width, spec.height, left, top, phoneWidth, phoneHeight, Math.round(spec.width * 0.04), palette.gold) },
    { input: screen, left, top }, { input: badge },
  ]).png().toBuffer();
}

async function renderProgress(spec) {
  const title = textSvg({
    width: spec.width, height: spec.height, eyebrow: 'YOUR PLAN. YOUR PROGRESS.', lines: ['See the week.', 'Feel every win.'],
    y: Math.round(spec.height * 0.11), fill: palette.white, titleSize: Math.round(spec.width * 0.072), lineHeight: Math.round(spec.width * 0.083),
  });
  const planWidth = Math.round(spec.width * 0.57);
  const planHeight = Math.round(planWidth * 1.55);
  const plan = await roundedImage(path.join(sourceDir, '05-weekly-plan.jpg'), planWidth, planHeight, Math.round(spec.width * 0.035), { fit: 'cover', position: 'top' });
  const feed = await prepareFeedSource();
  const pbWidth = Math.round(spec.width * 0.5);
  const pbHeight = Math.round(pbWidth * 1.45);
  const pb = await roundedImage(feed, pbWidth, pbHeight, Math.round(spec.width * 0.035), { fit: 'cover', position: 'top' });
  const planLeft = Math.round(spec.width * 0.07);
  const planTop = Math.round(spec.height * 0.31);
  const pbLeft = Math.round(spec.width * 0.47);
  const pbTop = Math.round(spec.height * 0.43);
  const proof = svg(spec.width, spec.height, `
    <rect x="${spec.width * 0.05}" y="${spec.height * 0.86}" width="${spec.width * 0.9}" height="${spec.height * 0.085}" rx="${spec.width * 0.045}" fill="${palette.goldLight}"/>
    <text x="${spec.width * 0.5}" y="${spec.height * 0.912}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${spec.width * 0.035}" font-weight="900" fill="${palette.ink}">PLANS • PERSONAL BESTS • MOMENTUM</text>
  `);
  return sharp(backgroundSvg(spec.width, spec.height, 'green')).composite([
    { input: title },
    { input: frameSvg(spec.width, spec.height, planLeft, planTop, planWidth, planHeight, Math.round(spec.width * 0.035)) },
    { input: plan, left: planLeft, top: planTop },
    { input: frameSvg(spec.width, spec.height, pbLeft, pbTop, pbWidth, pbHeight, Math.round(spec.width * 0.035)) },
    { input: pb, left: pbLeft, top: pbTop }, { input: proof },
  ]).png().toBuffer();
}

async function renderSlide(slide, index, spec) {
  const renderers = { coach: renderCoach, challenges: renderChallenges, meals: renderMeals, training: renderTraining, community: renderCommunity, progress: renderProgress };
  const buffer = await renderers[slide.layout](spec);
  const fileName = `${String(index + 1).padStart(2, '0')}-${slide.slug}.png`;
  const destination = path.join(outputRoot, spec.directory, fileName);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await sharp(buffer).png({ compressionLevel: 9 }).toFile(destination);
  return destination;
}

async function renderFeatureGraphic() {
  const width = 1024;
  const height = 500;
  const nutrition = await roundedImage(path.join(sourceDir, '02-vegan-meals.jpg'), 180, 390, 20, { fit: 'cover', position: 'top' });
  const feed = await roundedImage(await prepareFeedSource(), 180, 390, 20, { fit: 'cover', position: 'top' });
  const logo = await sharp(logoPath).resize(84, 84, { fit: 'contain' }).png().toBuffer();
  const copy = svg(width, height, `
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
  `);
  const output = path.join(root, 'store-listing', 'google-play', 'en-AU', 'images', 'featureGraphic.png');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await sharp(backgroundSvg(width, height, 'cream')).composite([
    { input: copy }, { input: logo, top: 18, left: 40 }, { input: feed, top: 38, left: 790 }, { input: nutrition, top: 88, left: 660 },
  ]).png({ compressionLevel: 9 }).toFile(output);
  return output;
}

const specs = [
  { directory: path.join('app-store-screenshots', 'en-AU'), width: 1290, height: 2796 },
  { directory: path.join('google-play', 'en-AU', 'images', 'phoneScreenshots'), width: 1080, height: 1920 },
];

const outputs = [];
for (const spec of specs) {
  for (const [index, slide] of slides.entries()) outputs.push(await renderSlide(slide, index, spec));
}
outputs.push(await renderFeatureGraphic());
console.log(`Generated ${outputs.length} store-listing assets:`);
outputs.forEach((file) => console.log(path.relative(root, file)));
