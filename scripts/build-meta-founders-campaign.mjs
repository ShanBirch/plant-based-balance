import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'output', 'meta-founders-pass-campaign-2026-07-22');

const colours = {
  ink: '#130B1B',
  plum: '#241130',
  purple: '#7C3AED',
  violet: '#A855F7',
  gold: '#FFB21A',
  cream: '#FFF7E8',
  white: '#FFFFFF',
  green: '#45D6A0',
  coral: '#FF6D74',
};

const campaigns = [
  {
    id: '01-coach-in-your-corner',
    boardId: 'coach-in-corner',
    source: 'photos/shannon-portrait.jpg',
    eyebrow: 'VEGAN FITNESS FOUNDERS PASS',
    title: ['A REAL COACH', 'IN YOUR CORNER.'],
    body: ['Six weeks of coaching support', 'Lifetime core app + community access'],
    price: 'AU$99 ONCE',
    cta: 'SEND MESSAGE',
    accent: colours.gold,
    composition: 'portrait',
    primaryText: "Getting fit should not mean figuring everything out alone. The Balance Founders Pass gives you six weeks of one-to-one in-app support from me for questions, direction and accountability, plus lifetime access to the core app and plant-based community. AU$99 once. Send me “BALANCE” and I’ll help you work out if it fits.",
    headline: 'Six weeks with Shannon, AU$99 once',
    description: 'Lifetime core Balance app + plant-based community access',
  },
  {
    id: '02-stop-restarting',
    boardId: 'stop-restarting',
    source: 'photos/what-i-offer-portrait.jpg',
    eyebrow: 'CONSISTENCY > PERFECTION',
    title: ['STOP RESTARTING.', 'BUILD A RHYTHM.'],
    body: ['Training, direction and accountability', 'that can fit around real life'],
    price: 'FOUNDERS PASS  •  AU$99 ONCE',
    cta: 'MESSAGE “BALANCE”',
    accent: colours.green,
    composition: 'portrait',
    primaryText: "Another perfect plan is not the answer if it only lasts a week. Balance brings your training, progress and support into one place, with six weeks of coaching support from me to help you build a rhythm you can actually keep. Message “BALANCE” for the Founders Pass details.",
    headline: 'Stop restarting. Build a rhythm.',
    description: 'Six weeks of support + lifetime core access',
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
    accent: colours.violet,
    composition: 'gallery',
    primaryText: "The Balance Vegan Fitness Founders Pass is simple: pay AU$99 once, get six weeks of one-to-one in-app coaching support from me, then keep lifetime access to the core Balance app and plant-based community. No sales call needed. Message me for the details.",
    headline: 'Six weeks with Shannon. Lifetime core access.',
    description: 'The Vegan Fitness Founders Pass',
  },
  {
    id: '04-plant-based-clarity',
    boardId: 'nutrition-clarity',
    source: 'assets/campaigns/founders-pass-meta-2026-07-22/source/balance-nutrition-screen.png',
    eyebrow: 'PLANT-BASED FITNESS, MADE CLEARER',
    title: ['TRAIN WITH PURPOSE.', 'EAT WITH CLARITY.'],
    body: ['Vegan nutrition and progress tools', 'with Shannon there for direction'],
    price: 'FOUNDERS PASS  •  AU$99 ONCE',
    cta: 'SEND MESSAGE',
    accent: colours.coral,
    composition: 'phone',
    primaryText: "Plant-based fitness does not need more noise. Balance puts training, vegan nutrition and progress tools together, with six weeks of coaching support from me when you need direction. The Founders Pass is AU$99 once and includes lifetime core app and community access. Message “BALANCE” for details.",
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
    photoCrop: { top: 205, height: 1350 },
    primaryText: "Balance is more than a workout tracker. It is a plant-based community where training, progress and support live together. The Founders Pass includes six weeks with me in your corner, then lifetime access to the core app and community. AU$99 once. Message “BALANCE” to see what is included.",
    headline: 'Plant-based fitness is better together',
    description: 'Join the Balance founding members',
  },
  {
    id: '06-built-by-shannon',
    boardId: 'founder',
    source: 'photos/shannon-portrait.jpg',
    eyebrow: 'BUILT BY SHANNON BIRCH',
    title: ['VEGAN.', 'EXERCISE SCIENTIST.', 'IN YOUR CORNER.'],
    body: ['Real coaching support inside', 'a fitness app built for our community'],
    price: 'FOUNDERS PASS  •  AU$99 ONCE',
    cta: 'START THE CONVERSATION',
    accent: colours.green,
    composition: 'founder',
    primaryText: "I built Balance because vegan fitness should feel less lonely and less complicated. I’m an exercise scientist, former gym owner and vegan coach. The Founders Pass gives you six weeks of coaching support with me, plus lifetime core app and plant-based community access for AU$99 once. Send me a message and I’ll talk you through it.",
    headline: 'Vegan fitness, built by someone who gets it',
    description: 'Meet Shannon and the Balance Founders Pass',
  },
];

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function linesSvg(lines, x, y, size, gap, fill = colours.white, weight = 900, anchor = 'start') {
  return lines.map((line, i) => `<text x="${x}" y="${y + i * gap}" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="-1.5">${esc(line)}</text>`).join('');
}

function baseSvg(width, height, item) {
  const tall = height > 1500;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colours.ink}"/><stop offset="0.6" stop-color="${colours.plum}"/><stop offset="1" stop-color="#34124D"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="${item.accent}" stop-opacity=".34"/><stop offset="1" stop-color="${item.accent}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="${width * 0.86}" cy="${height * 0.1}" r="${width * 0.55}" fill="url(#glow)"/>
    <circle cx="${width * 0.06}" cy="${height * 0.92}" r="${width * 0.45}" fill="url(#glow)" opacity=".35"/>
    <rect x="0" y="0" width="${width}" height="12" fill="${item.accent}"/>
    <text x="${tall ? 70 : 64}" y="${tall ? 100 : 82}" fill="${item.accent}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 27 : 24}" font-weight="800" letter-spacing="2.8">${esc(item.eyebrow)}</text>
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
  const photo = await source.resize(width - 28, height - 28, { fit: 'cover', position: 'centre' }).png().toBuffer();
  const mask = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" rx="34" fill="#fff"/></svg>`);
  return sharp({ create: { width, height, channels: 4, background: '#1A101F' } })
    .composite([{ input: photo, left: 14, top: 14 }, { input: Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="${width - 10}" height="${height - 10}" rx="30" fill="none" stroke="${item.accent}" stroke-width="6"/></svg>`) }, { input: mask, blend: 'dest-in' }])
    .png().toBuffer();
}

function copyPanelSvg(width, height, item, layout) {
  const tall = height > 1500;
  const x = tall ? 70 : 64;
  const panelY = layout.panelY;
  const titleSize = tall ? 66 : 58;
  const titleGap = tall ? 72 : 64;
  const bodyY = panelY + item.title.length * titleGap + 36;
  const priceY = bodyY + 130;
  const ctaY = priceY + 68;
  const footerX = Number.isFinite(layout.footerX) ? layout.footerX : width - x - 360;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${linesSvg(item.title, x, panelY, titleSize, titleGap, colours.white, 900)}
    ${linesSvg(item.body, x, bodyY, tall ? 31 : 27, tall ? 43 : 38, colours.cream, 500)}
    <text x="${x}" y="${priceY}" fill="${item.accent}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 34 : 31}" font-weight="900" letter-spacing="1">${esc(item.price)}</text>
    <rect x="${x}" y="${ctaY}" width="${tall ? 440 : 410}" height="${tall ? 74 : 68}" rx="${tall ? 37 : 34}" fill="${item.accent}"/>
    <text x="${x + (tall ? 220 : 205)}" y="${ctaY + (tall ? 49 : 45)}" fill="${colours.ink}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 25 : 23}" font-weight="900" text-anchor="middle" letter-spacing="1">${esc(item.cta)}</text>
    <text x="${footerX}" y="${height - (tall ? 60 : 44)}" fill="#FFFFFF" fill-opacity=".72" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 24 : 20}" font-weight="700">BALANCE • FITNESS GAMIFIED</text>
  </svg>`);
}

async function renderPortrait(item, width, height) {
  const tall = height > 1500;
  const photoW = tall ? width : Math.round(width * 0.52);
  const photoH = tall ? Math.round(height * 0.56) : height;
  const photo = await coverBuffer(item.source, photoW, photoH, 'centre');
  const shade = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="s" x1="0" x2="1"><stop stop-color="#130B1B"/><stop offset=".47" stop-color="#130B1B" stop-opacity=".96"/><stop offset=".73" stop-color="#130B1B" stop-opacity=".16"/><stop offset="1" stop-color="#130B1B" stop-opacity="0"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#130B1B" stop-opacity="0"/><stop offset="1" stop-color="#130B1B"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#s)"/><rect width="${width}" height="${height}" fill="url(#b)"/></svg>`);
  const panelY = tall ? 1120 : 245;
  const eyebrow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="${tall ? 70 : 64}" y="${tall ? 100 : 82}" fill="${item.accent}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 27 : 24}" font-weight="800" letter-spacing="2.8">${esc(item.eyebrow)}</text></svg>`);
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
    ? [{ left: 30, top: 1120 }, { left: 345, top: 990 }, { left: 722, top: 1120 }]
    : [{ left: 6, top: 775 }, { left: 364, top: 680 }, { left: 772, top: 775 }];
  return sharp(baseSvg(width, height, item)).composite([
    { input: left, ...positions[0] },
    { input: right, ...positions[2] },
    { input: centre, ...positions[1] },
    { input: copyPanelSvg(width, height, item, { panelY: tall ? 250 : 190 }) },
  ]).png().toBuffer();
}

async function renderProof(item, width, height) {
  const tall = height > 1500;
  const proofW = tall ? 880 : 560;
  const proofH = tall ? 940 : 700;
  const proof = await proofPhotoBuffer(item, proofW, proofH);
  return sharp(baseSvg(width, height, item)).composite([
    { input: proof, left: tall ? 100 : width - proofW - 25, top: tall ? 105 : 620 },
    { input: copyPanelSvg(width, height, item, { panelY: tall ? 1180 : 190, footerX: tall ? 70 : 64 }) },
  ]).png().toBuffer();
}

async function render(item, width, height) {
  if (item.composition === 'portrait' || item.composition === 'founder') return renderPortrait(item, width, height);
  if (item.composition === 'stack') return renderStack(item, width, height);
  if (item.composition === 'gallery') return renderGallery(item, width, height);
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
  name: 'BAL | Founders Pass | IG DM | AU | 2026-07-22',
  status: 'PAUSED',
  objective: 'Instagram Direct conversations',
  offer: 'Balance Vegan Fitness Founders Pass, AU$99 once',
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
    rollout: index < 3 ? 'phase_1_launch' : 'phase_2_reserve',
    creative: { feed: path.basename(x.feedPath), story: path.basename(x.storyPath) },
    primaryText: x.primaryText,
    headline: x.headline,
    description: x.description,
    callToAction: 'Send message',
  })),
  dmWelcome: {
    greeting: "Hey, glad you reached out. What made the Founders Pass catch your eye?",
    quickReplies: ["What’s included?", "Is this right for me?", "I’m ready to start"],
    followUpExpectation: "Shannon will reply here and help you work out the best next step.",
  },
  rollout: {
    phase1: ['A1 | Six weeks with Shannon, AU$99 once', 'A2 | Stop restarting. Build a rhythm.', 'A3 | Six weeks with Shannon. Lifetime core access.'],
    phase1Days: 7,
    phase2: 'Introduce one reserve ad at a time to replace the weakest phase-one route. Do not split AU$20 per day across all six ads at launch.',
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
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Balance Founders Pass Meta Campaign</title><style>body{margin:0;background:#0e0714;color:#fff;font:16px/1.55 Arial,sans-serif}header{padding:48px max(24px,5vw);background:linear-gradient(135deg,#241130,#130b1b)}h1{font-size:clamp(36px,6vw,76px);line-height:.95;margin:12px 0}header p{max-width:760px;color:#e9dff0}main{padding:36px max(20px,4vw);display:grid;gap:36px}article{display:grid;grid-template-columns:minmax(280px,520px) 1fr;gap:36px;align-items:start;background:#1d1028;border:1px solid #432653;border-radius:24px;padding:20px}img{width:100%;border-radius:14px}span{color:#ffb21a;font-weight:900;letter-spacing:2px}h2{font-size:34px;line-height:1.05}p{color:#ddd0e5}@media(max-width:800px){article{grid-template-columns:1fr}header{padding-top:30px}}</style></head><body><header><span>READY FOR REVIEW</span><h1>Balance Founders Pass<br>Meta Campaign</h1><p>Six distinct message-led creative routes. Campaign defaults to PAUSED, AU$20 per day, Australia broad 24–54, Instagram Direct conversations.</p></header><main>${cards}</main></body></html>`;
await fs.writeFile(path.join(OUT, 'review.html'), html);

console.log(JSON.stringify({ outDir: OUT, exports: exportsList.map(x => ({ id: x.id, boardId: x.boardId, feedPath: x.feedPath, storyPath: x.storyPath })) }, null, 2));
