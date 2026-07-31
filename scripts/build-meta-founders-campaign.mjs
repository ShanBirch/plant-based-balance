import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'output', 'meta-founders-pass-campaign-2026-07-22');

const colours = {
  ink: '#241A12',
  paper: '#F7F2E8',
  cream: '#FFF9ED',
  gold: '#D8A43A',
  deepGold: '#A96F00',
  white: '#FFFFFF',
  sage: '#72806A',
  terracotta: '#B76D47',
};

const campaigns = [
  {
    id: '01-coach-in-your-corner',
    boardId: 'coach-in-corner',
    source: 'photos/shannon-portrait.jpg',
    eyebrow: 'BALANCE: PLANT-BASED FITNESS',
    title: ['YOU HAVE NOT FAILED.', 'THE PLAN WAS WRONG.'],
    body: ['Coaching built around your brain,', 'your experiences and real life'],
    price: 'AU$99 ONCE',
    cta: 'SEND MESSAGE',
    accent: colours.deepGold,
    composition: 'portrait',
    primaryText: 'You have not failed. The plan was wrong. It was not built around your brain, what you have been through, or what you are dealing with now. Inside Balance, I coach plant-based people with small, clear steps that fit their current starting point. The Founders Pass is AU$99 once. Message “BALANCE” and I will show you what is included.',
    headline: 'You have not failed. The plan was wrong.',
    description: 'Plant-based coaching built around real life',
  },
  {
    id: '02-stop-restarting',
    boardId: 'stop-restarting',
    source: 'photos/what-i-offer-portrait.jpg',
    eyebrow: 'YOUR BRAIN LEARNS THROUGH REPETITION',
    title: ['SMALL STEPS.', 'A RHYTHM THAT LASTS.'],
    body: ['Make the next helpful action', 'easier to repeat'],
    price: 'FOUNDERS PASS  •  AU$99 ONCE',
    cta: 'MESSAGE “BALANCE”',
    accent: colours.sage,
    composition: 'portrait',
    primaryText: 'Real change is not about finding more motivation or forcing more effort. Your brain learns through repetition, and your environment shapes what gets repeated. Balance gives plant-based people small, clear steps and six weeks of support to build a rhythm that fits real life. Message “BALANCE” for the Founders Pass details.',
    headline: 'Small steps. A rhythm that lasts.',
    description: 'Change made clearer for plant-based people',
  },
  {
    id: '03-six-weeks-lifetime-access',
    boardId: 'offer-stack',
    sources: [
      { source: 'assets/campaigns/founders-pass-meta-2026-07-22/source/balance-home-screen.png', fit: 'cover' },
      { source: 'assets/campaigns/founders-pass-meta-2026-07-22/source/balance-logo-screen.png', fit: 'contain' },
      { source: 'assets/campaigns/founders-pass-meta-2026-07-22/source/balance-nutrition-screen.png', fit: 'cover' },
    ],
    eyebrow: 'ONE SIMPLE FOUNDING MEMBER OFFER',
    title: ['6 WEEKS WITH SHANNON.', 'LIFETIME CORE ACCESS.'],
    body: ['Coaching support', 'Core app + plant-based community'],
    price: 'AU$99 ONCE',
    cta: 'GET THE DETAILS IN DMS',
    accent: colours.gold,
    composition: 'gallery',
    primaryText: 'The Balance: Plant-Based Fitness Founders Pass is simple. Pay AU$99 once, get six weeks of one-to-one in-app coaching support from me, then keep lifetime access to the core Balance app and plant-based community. Message “BALANCE” and I will show you what is included.',
    headline: 'Six weeks with Shannon. Lifetime core access.',
    description: 'The Balance: Plant-Based Fitness Founders Pass',
  },
  {
    id: '04-plant-based-clarity',
    boardId: 'nutrition-clarity',
    source: 'assets/campaigns/founders-pass-meta-2026-07-22/source/balance-nutrition-screen.png',
    eyebrow: 'PLANT-BASED FITNESS, MADE CLEARER',
    title: ['TRAIN WITH PURPOSE.', 'EAT WITH CLARITY.'],
    body: ['Plant-based nutrition and progress tools', 'with Shannon there for direction'],
    price: 'FOUNDERS PASS  •  AU$99 ONCE',
    cta: 'SEND MESSAGE',
    accent: colours.terracotta,
    frameAccent: colours.gold,
    priceSize: 27,
    composition: 'gold-frame',
    proofFit: 'contain',
    primaryText: 'Plant-based fitness does not need more noise. Balance puts training, nutrition and progress tools together, with small, clear steps and six weeks of coaching support from me when you need direction. The Founders Pass is AU$99 once and includes lifetime core app and community access. Message “BALANCE” for details.',
    headline: 'Plant-based fitness, made clearer',
    description: 'Training, nutrition, progress and support',
  },
  {
    id: '05-not-doing-it-alone',
    boardId: 'community',
    source: 'assets/campaigns/founders-pass-meta-2026-07-22/source/shane-strength-day.png',
    eyebrow: 'BUILT FOR THE PLANT-BASED COMMUNITY',
    title: ['PROGRESS IS EASIER', 'WHEN IT IS SHARED.'],
    body: ['Train, learn and keep moving', 'A community that gets it'],
    price: 'AU$99 ONCE',
    cta: 'MESSAGE “BALANCE”',
    accent: colours.gold,
    composition: 'proof',
    communitySections: {
      photo: { top: 205, height: 1375 },
      comments: { top: 1550, height: 510 },
    },
    primaryText: 'Your environment shapes what gets repeated. Balance gives you a plant-based community where training, progress and support live together. The Founders Pass includes six weeks with me in your corner, then lifetime access to the core app and community. AU$99 once. Message “BALANCE” to see what is included.',
    headline: 'Plant-based fitness is better together',
    description: 'Join the Balance founding members',
  },
  {
    id: '06-built-by-shannon',
    boardId: 'founder',
    source: 'photos/shannon-portrait.jpg',
    eyebrow: 'BUILT BY SHANNON BIRCH',
    title: ['PLANT-BASED.', 'BRAIN-AWARE.', 'BUILT FOR REAL LIFE.'],
    body: ['Coaching from an exercise scientist', 'inside a community that gets it'],
    price: 'FOUNDERS PASS  •  AU$99 ONCE',
    cta: 'START THE CONVERSATION',
    accent: colours.sage,
    composition: 'founder',
    primaryText: 'I built Balance because plant-based fitness should feel less lonely and less complicated. I am an exercise scientist and former gym owner, and I coach change through small, clear steps that fit real life. The Founders Pass gives you six weeks of coaching support with me, plus lifetime core app and plant-based community access for AU$99 once. Message “BALANCE” and I will talk you through it.',
    headline: 'Plant-based fitness, built for real life',
    description: 'Meet Shannon and the Balance Founders Pass',
  },
];

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function linesSvg(lines, x, y, size, gap, fill = colours.ink, weight = 900, anchor = 'start') {
  return lines.map((line, i) => `<text x="${x}" y="${y + i * gap}" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="-1.5">${esc(line)}</text>`).join('');
}

function baseSvg(width, height, item) {
  const tall = height > 1500;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colours.cream}"/><stop offset="0.62" stop-color="${colours.paper}"/><stop offset="1" stop-color="#EADCC2"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="${item.accent}" stop-opacity=".18"/><stop offset="1" stop-color="${item.accent}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="${width * 0.86}" cy="${height * 0.1}" r="${width * 0.55}" fill="url(#glow)"/>
    <circle cx="${width * 0.06}" cy="${height * 0.92}" r="${width * 0.45}" fill="url(#glow)" opacity=".55"/>
    <rect x="0" y="0" width="${width}" height="12" fill="${item.accent}"/>
    <text x="${tall ? 70 : 64}" y="${tall ? 100 : 82}" fill="${colours.deepGold}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 27 : 24}" font-weight="800" letter-spacing="2.8">${esc(item.eyebrow)}</text>
  </svg>`);
}

async function coverBuffer(source, width, height, position = 'centre') {
  return sharp(path.join(ROOT, source)).resize(width, height, { fit: 'cover', position }).toBuffer();
}

async function phoneBuffer(source, width, height, position = 'top', cropTop = 0) {
  let image = sharp(path.join(ROOT, source));
  if (cropTop > 0) {
    const metadata = await image.metadata();
    image = image.extract({ left: 0, top: Math.min(cropTop, metadata.height - 1), width: metadata.width, height: metadata.height - Math.min(cropTop, metadata.height - 1) });
  }
  const bezel = Math.max(22, Math.round(width * 0.055));
  const screen = await image.resize(width - bezel * 2, height - bezel * 2, { fit: 'cover', position }).png().toBuffer();
  const chrome = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="58" fill="none" stroke="#302A35" stroke-width="4"/>
    <rect x="${Math.round(width / 2 - 54)}" y="${Math.round(bezel * 0.42)}" width="108" height="20" rx="10" fill="#08060A"/>
    <circle cx="${Math.round(width / 2 + 35)}" cy="${Math.round(bezel * 0.42 + 10)}" r="4" fill="#463D4D"/>
    <rect x="0" y="${Math.round(height * 0.22)}" width="7" height="86" rx="3" fill="#413A46"/>
    <rect x="${width - 7}" y="${Math.round(height * 0.29)}" width="7" height="120" rx="3" fill="#413A46"/>
  </svg>`);
  const mask = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${width}" height="${height}" rx="58" fill="#fff"/></svg>`);
  return sharp({ create: { width, height, channels: 4, background: '#0B0710' } })
    .composite([{ input: screen, left: bezel, top: bezel }, { input: chrome }, { input: mask, blend: 'dest-in' }])
    .png().toBuffer();
}

async function framedCanvasBuffer(entry, width, height, angle = 0) {
  const frame = 18;
  const matte = 18;
  const imageWidth = width - (frame + matte) * 2;
  const imageHeight = height - (frame + matte) * 2;
  const photo = await sharp(path.join(ROOT, entry.source))
    .resize(imageWidth, imageHeight, { fit: entry.fit || 'cover', position: 'centre', background: '#0B0710' })
    .png().toBuffer();
  const shell = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="16" stdDeviation="15" flood-color="#000" flood-opacity=".48"/></filter><linearGradient id="wood" x1="0" x2="1"><stop stop-color="#7D5523"/><stop offset=".45" stop-color="#E3B85B"/><stop offset="1" stop-color="#6A431B"/></linearGradient></defs>
    <rect x="14" y="14" width="${width - 28}" height="${height - 28}" rx="24" fill="#000" opacity=".7" filter="url(#shadow)"/>
    <rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="22" fill="url(#wood)"/>
    <rect x="${frame}" y="${frame}" width="${width - frame * 2}" height="${height - frame * 2}" rx="14" fill="#FFF8E9"/>
  </svg>`);
  const card = await sharp({ create: { width, height, channels: 4, background: '#00000000' } })
    .composite([{ input: shell }, { input: photo, left: frame + matte, top: frame + matte }])
    .png().toBuffer();
  return angle ? sharp(card).rotate(angle, { background: '#00000000' }).png().toBuffer() : card;
}

async function proofPhotoBuffer(item, width, height) {
  let source = sharp(path.join(ROOT, item.source));
  if (item.photoCrop) {
    const metadata = await source.metadata();
    const top = Math.min(item.photoCrop.top || 0, metadata.height - 1);
    const cropHeight = Math.min(item.photoCrop.height || metadata.height - top, metadata.height - top);
    source = source.extract({ left: 0, top, width: metadata.width, height: cropHeight });
  }
  const photo = await source.resize(width - 28, height - 28, {
    fit: item.proofFit || 'cover',
    position: 'centre',
    background: '#F8F4EA',
  }).png().toBuffer();
  const frameAccent = item.frameAccent || item.accent;
  const mask = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="34" fill="#fff"/></svg>`);
  return sharp({ create: { width, height, channels: 4, background: colours.cream } })
    .composite([{ input: photo, left: 14, top: 14 }, { input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="${width - 10}" height="${height - 10}" rx="30" fill="none" stroke="${frameAccent}" stroke-width="6"/></svg>`) }, { input: mask, blend: 'dest-in' }])
    .png().toBuffer();
}

async function communityProofBuffer(item, width, height) {
  const sourcePath = path.join(ROOT, item.source);
  const metadata = await sharp(sourcePath).metadata();
  const inset = 14;
  const innerW = width - inset * 2;
  const innerH = height - inset * 2;
  const commentsH = Math.round(innerH * 0.25);
  const photoH = innerH - commentsH;
  const photoCrop = item.communitySections.photo;
  const commentsCrop = item.communitySections.comments;
  const photo = await sharp(sourcePath)
    .extract({ left: 0, top: photoCrop.top, width: metadata.width, height: photoCrop.height })
    .resize(innerW, photoH, { fit: 'cover', position: 'top' })
    .png().toBuffer();
  const comments = await sharp(sourcePath)
    .extract({ left: 0, top: commentsCrop.top, width: metadata.width, height: commentsCrop.height })
    .resize(innerW, commentsH, { fit: 'contain', position: 'top', background: '#FFFFFF' })
    .png().toBuffer();
  const mask = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="34" fill="#fff"/></svg>`);
  const frame = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="${width - 10}" height="${height - 10}" rx="30" fill="none" stroke="${item.accent}" stroke-width="6"/></svg>`);
  return sharp({ create: { width, height, channels: 4, background: '#FFFFFF' } })
    .composite([
      { input: photo, left: inset, top: inset },
      { input: comments, left: inset, top: inset + photoH },
      { input: frame },
      { input: mask, blend: 'dest-in' },
    ])
    .png().toBuffer();
}

function copyPanelSvg(width, height, item, layout) {
  const tall = height > 1500;
  const x = tall ? 70 : 64;
  const ctaX = Number.isFinite(layout.ctaX) ? layout.ctaX : x;
  const ctaWidth = tall ? 440 : 410;
  const panelY = layout.panelY;
  const titleSize = tall ? 66 : 58;
  const titleGap = tall ? 72 : 64;
  const bodyY = panelY + item.title.length * titleGap + 36;
  const priceY = bodyY + 130;
  const ctaY = priceY + 68;
  const footerX = Number.isFinite(layout.footerX) ? layout.footerX : width - x - 360;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${linesSvg(item.title, x, panelY, titleSize, titleGap, colours.ink, 900)}
    ${linesSvg(item.body, x, bodyY, tall ? 31 : 27, tall ? 43 : 38, '#5B4A3A', 500)}
    <text x="${x}" y="${priceY}" fill="${item.accent}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 34 : (item.priceSize || 31)}" font-weight="900" letter-spacing="1">${esc(item.price)}</text>
    <rect x="${ctaX}" y="${ctaY}" width="${ctaWidth}" height="${tall ? 74 : 68}" rx="${tall ? 37 : 34}" fill="${item.accent}"/>
    <text x="${ctaX + ctaWidth / 2}" y="${ctaY + (tall ? 49 : 45)}" fill="${colours.ink}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 25 : 23}" font-weight="900" text-anchor="middle" letter-spacing="1">${esc(item.cta)}</text>
    <text x="${footerX}" y="${height - (tall ? 60 : 44)}" fill="${colours.ink}" fill-opacity=".68" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 24 : 20}" font-weight="700">BALANCE: PLANT-BASED FITNESS</text>
  </svg>`);
}

async function renderPortrait(item, width, height) {
  const tall = height > 1500;
  const photoW = tall ? width : Math.round(width * 0.52);
  const photoH = tall ? Math.round(height * 0.56) : height;
  const photo = await coverBuffer(item.source, photoW, photoH, 'centre');
  const shade = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="s" x1="0" x2="1"><stop stop-color="#FFF9ED"/><stop offset=".47" stop-color="#FFF9ED" stop-opacity=".97"/><stop offset=".73" stop-color="#FFF9ED" stop-opacity=".18"/><stop offset="1" stop-color="#FFF9ED" stop-opacity="0"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#FFF9ED" stop-opacity="0"/><stop offset="1" stop-color="#F7F2E8"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#s)"/><rect width="${width}" height="${height}" fill="url(#b)"/></svg>`);
  const panelY = tall ? 1120 : 245;
  const eyebrow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${tall ? 70 : 64}" y="${tall ? 100 : 82}" fill="${colours.deepGold}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 27 : 24}" font-weight="800" letter-spacing="2.8">${esc(item.eyebrow)}</text></svg>`);
  return sharp(baseSvg(width, height, item)).composite([
    { input: photo, left: tall ? 0 : width - photoW, top: tall ? 110 : 0 },
    { input: shade },
    { input: eyebrow },
    { input: copyPanelSvg(width, height, item, { panelY }) },
  ]).png().toBuffer();
}

async function renderPhone(item, width, height) {
  const tall = height > 1500;
  const phoneW = tall ? 520 : 430;
  const phoneH = tall ? 1040 : 860;
  const phone = await phoneBuffer(item.source, phoneW, phoneH, item.phonePosition || 'top', item.phoneCropTop || 0);
  const panelY = tall ? 245 : 215;
  const phoneTop = tall ? 760 : 450;
  return sharp(baseSvg(width, height, item)).composite([
    { input: phone, left: width - phoneW - (tall ? 30 : 26), top: phoneTop },
    { input: copyPanelSvg(width, height, item, { panelY, footerX: tall ? 70 : 64 }) },
  ]).png().toBuffer();
}

async function renderGoldFrame(item, width, height) {
  const tall = height > 1500;
  const frameW = tall ? 520 : 430;
  const frameH = tall ? 1040 : 860;
  const framed = await proofPhotoBuffer(item, frameW, frameH);
  return sharp(baseSvg(width, height, item)).composite([
    { input: framed, left: width - frameW - (tall ? 30 : 26), top: tall ? 760 : 450 },
    { input: copyPanelSvg(width, height, item, { panelY: tall ? 245 : 215, footerX: tall ? 70 : 64 }) },
  ]).png().toBuffer();
}

async function renderStack(item, width, height) {
  const tall = height > 1500;
  const dims = tall ? [440, 820] : [330, 640];
  const phones = await Promise.all(item.sources.map(s => phoneBuffer(s, dims[0], dims[1])));
  const positions = tall
    ? [{ left: -60, top: 980 }, { left: 320, top: 870 }, { left: 700, top: 1010 }]
    : [{ left: -30, top: 690 }, { left: 280, top: 610 }, { left: 600, top: 710 }];
  return sharp(baseSvg(width, height, item)).composite([
    ...phones.map((input, i) => ({ input, ...positions[i] })),
    { input: copyPanelSvg(width, height, item, { panelY: tall ? 250 : 190 }) },
  ]).png().toBuffer();
}

async function renderGallery(item, width, height) {
  const tall = height > 1500;
  const sideSize = tall ? [330, 560] : [292, 500];
  const centreSize = tall ? [390, 650] : [342, 570];
  const left = await framedCanvasBuffer(item.sources[0], sideSize[0], sideSize[1], -7);
  const centre = await framedCanvasBuffer(item.sources[1], centreSize[0], centreSize[1], 0);
  const right = await framedCanvasBuffer(item.sources[2], sideSize[0], sideSize[1], 7);
  const positions = tall
    ? [{ left: 30, top: 1120 }, { left: 345, top: 990 }, { left: 654, top: 1120 }]
    : [{ left: 6, top: 775 }, { left: 364, top: 680 }, { left: 723, top: 775 }];
  return sharp(baseSvg(width, height, item)).composite([
    { input: left, ...positions[0] },
    { input: right, ...positions[2] },
    { input: centre, ...positions[1] },
    { input: copyPanelSvg(width, height, item, { panelY: tall ? 250 : 190 }) },
  ]).png().toBuffer();
}

async function renderProof(item, width, height) {
  const tall = height > 1500;
  const proofW = tall ? 700 : 560;
  const proofH = tall ? 1050 : 780;
  const proof = await communityProofBuffer(item, proofW, proofH);
  return sharp(baseSvg(width, height, item)).composite([
    { input: proof, left: tall ? 190 : width - proofW - 25, top: tall ? 125 : 500 },
    { input: copyPanelSvg(width, height, item, { panelY: tall ? 1240 : 190, footerX: tall ? 70 : 64, ctaX: tall ? 70 : 40 }) },
  ]).png().toBuffer();
}

async function render(item, width, height) {
  if (item.composition === 'portrait' || item.composition === 'founder') return renderPortrait(item, width, height);
  if (item.composition === 'stack') return renderStack(item, width, height);
  if (item.composition === 'gallery') return renderGallery(item, width, height);
  if (item.composition === 'gold-frame') return renderGoldFrame(item, width, height);
  if (item.composition === 'proof') return renderProof(item, width, height);
  return renderPhone(item, width, height);
}

await fs.mkdir(OUT, { recursive: true });
const exportsList = [];
for (const item of campaigns) {
  const feedPath = path.join(OUT, `${item.id}-feed-1080x1350.png`);
  const storyPath = path.join(OUT, `${item.id}-story-1080x1920.png`);
  await fs.writeFile(feedPath, await render(item, 1080, 1350));
  await fs.writeFile(storyPath, await render(item, 1080, 1920));
  exportsList.push({ ...item, feedPath, storyPath });
}

const campaignPlan = {
  name: 'BAL | Plant-Based Founders Pass | Brain Angle | IG DM | AU | 2026-07-24',
  status: 'PAUSED',
  objective: 'Instagram Direct conversations',
  offer: 'Balance: Plant-Based Fitness Founders Pass, AU$99 once',
  conversionLocation: 'Instagram Direct',
  optimization: 'Conversations',
  audience: {
    location: 'Australia',
    age: '24-54',
    gender: 'All',
    targeting: 'Broad, Advantage audience expansion on',
    exclusions: ['Existing purchasers', 'Current coaching clients'],
  },
  placements: ['Instagram Feed', 'Instagram Stories', 'Instagram Reels', 'Instagram Explore', 'Instagram profile feed'],
  budget: { type: 'daily', amountAud: 20, testLengthDays: 7, estimatedTestSpendAud: 140 },
  adSet: 'Broad Australia | 24-54 | IG Direct',
  ads: exportsList.map((x, index) => ({
    name: `A${index + 1} | ${x.headline}`,
    rollout: [0, 3, 4].includes(index) ? 'phase_1_launch' : 'phase_2_reserve',
    creative: { feed: path.basename(x.feedPath), story: path.basename(x.storyPath) },
    primaryText: x.primaryText,
    headline: x.headline,
    description: x.description,
    callToAction: 'Send message',
  })).concat({
    name: 'V1 | You have not failed. The plan was wrong.',
    rollout: 'phase_1_launch',
    creative: { reels: 'balance-founders-pass-brain-ad-cream-gold-final.mp4' },
    primaryText: 'You have not failed. The plan was wrong. It was not built around your brain, what you have been through, or what you are dealing with now. Your brain learns through repetition, and your environment shapes what gets repeated. Inside Balance, I coach plant-based people with small, clear steps built around their current starting point. The Founders Pass is a one-off payment of AU$99. Message “BALANCE” and I will show you what is included.',
    headline: 'Change built around your real life',
    description: 'Balance: Plant-Based Fitness Founders Pass',
    callToAction: 'Send message',
  }),
  dmWelcome: {
    greeting: "Hey, glad you messaged. Here is a quick look inside Balance so you can actually see what I mean.",
    appPreview: "https://plantbased-balance.org/assets/balance-founders-pass-dm-preview.mp4",
    offerMessage: "Balance brings your weekly plan, plant-based nutrition, progress, learning and community into one place. The Founders Pass is AU$99 once. You get six weeks of one-to-one in-app support with me, then lifetime access to the core app and plant-based community.",
    quickReplies: [],
    checkoutUrl: "https://plantbased-balance.org/plant-based-fitness.html",
    followUpExpectation: "Shannon will reply here and help you work out the best next step.",
    rule: "Do not configure visible quick-reply buttons in the Meta messaging template. Let the lead type naturally, answer their actual sentence directly, and use one statement-led follow-up only when it changes the next move. Use the app preview on the first ad-attributed enquiry and send the checkout URL immediately when the person asks for the link or says they are ready.",
  },
  rollout: {
    phase1: ['A1 | You have not failed. The plan was wrong.', 'A4 | Plant-based fitness, made clearer', 'A5 | Plant-based fitness is better together', 'V1 | You have not failed. The plan was wrong.'],
    phase1Days: 7,
    phase2: 'Introduce one reserve ad at a time to replace the weakest launch route. Do not run every creative at once on an AU$20 daily budget.',
  },
  decisionRules: [
    'Do not edit during the first 72 hours unless delivery or tracking is broken.',
    'After 72 hours, pause an ad only when it has spent at least 1.5 times the account median cost per conversation without a conversation.',
    'Keep the two best ads by qualified conversation rate, not cheapest clicks.',
    'Scale the winning ad set by no more than 20 percent every 48 hours.',
  ],
};

await fs.writeFile(path.join(OUT, 'campaign-plan.json'), `${JSON.stringify(campaignPlan, null, 2)}\n`);

const cards = exportsList.map((x, i) => `<article><img src="${path.basename(x.feedPath)}" alt="${esc(x.headline)}"><div><span>AD ${i + 1}</span><h2>${esc(x.headline)}</h2><p>${esc(x.primaryText)}</p><p><strong>Headline:</strong> ${esc(x.headline)}</p><p><strong>Description:</strong> ${esc(x.description)}</p></div></article>`).join('');
const dmReplyMode = campaignPlan.dmWelcome.quickReplies.length
  ? campaignPlan.dmWelcome.quickReplies.map(esc).join(' · ')
  : 'Free text only - no visible reply buttons';
const dmReview = `<article><video controls playsinline src="../../assets/balance-founders-pass-dm-preview.mp4"></video><div><span>DM FOLLOW-UP</span><h2>Show the app, then make the offer clear.</h2><p><strong>FOUNDERS PASS<br>AU$99 ONCE<br>6 WEEKS WITH SHANNON<br>LIFETIME CORE ACCESS</strong></p><p>${esc(campaignPlan.dmWelcome.greeting)}</p><p>${esc(campaignPlan.dmWelcome.offerMessage)}</p><p><strong>Reply mode:</strong> ${dmReplyMode}</p><p><strong>Checkout:</strong> ${esc(campaignPlan.dmWelcome.checkoutUrl)}</p></div></article>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Balance Founders Pass Meta Campaign</title><style>body{margin:0;background:#f7f2e8;color:#241a12;font:16px/1.55 Arial,sans-serif}header{padding:48px max(24px,5vw);background:linear-gradient(135deg,#fff9ed,#eadcc2);border-bottom:8px solid #d8a43a}h1{font-size:clamp(36px,6vw,76px);line-height:.95;margin:12px 0}header p{max-width:760px;color:#5b4a3a}main{padding:36px max(20px,4vw);display:grid;gap:36px}article{display:grid;grid-template-columns:minmax(280px,520px) 1fr;gap:36px;align-items:start;background:#fff9ed;border:1px solid #d8a43a;border-radius:24px;padding:20px;box-shadow:0 18px 44px #6b4d241c}img,video{width:100%;border-radius:14px;background:#160d20}span{color:#a96f00;font-weight:900;letter-spacing:2px}h2{font-size:34px;line-height:1.05}p{color:#5b4a3a}@media(max-width:800px){article{grid-template-columns:1fr}header{padding-top:30px}}</style></head><body><header><span>READY FOR REVIEW</span><h1>Balance: Plant-Based Fitness<br>Founders Pass</h1><p>Brain-aware change, small clear steps, and plant-based community support. Campaign defaults to PAUSED, AU$20 per day, Australia broad 24–54, Instagram Direct conversations.</p></header><main>${cards}${dmReview}</main></body></html>`;
await fs.writeFile(path.join(OUT, 'review.html'), html);

console.log(JSON.stringify({ outDir: OUT, exports: exportsList.map(x => ({ id: x.id, boardId: x.boardId, feedPath: x.feedPath, storyPath: x.storyPath })) }, null, 2));
