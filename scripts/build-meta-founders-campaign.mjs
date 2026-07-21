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
    primaryText: "Getting fit should not mean figuring everything out alone. The Balance Founders Pass gives you six weeks of one-to-one in-app support from me for questions, direction and accountability, plus lifetime access to the core app and vegan fitness community. AU$99 once. Send me “BALANCE” and I’ll help you work out if it fits.",
    headline: 'Six weeks with Shannon, AU$99 once',
    description: 'Lifetime core Balance app + vegan community access',
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
    sources: ['photos/balance-character-shot.jpg', 'photos/balance-nutrition-shot.jpg', 'photos/balance-feed-shot.jpg'],
    eyebrow: 'ONE SIMPLE FOUNDING MEMBER OFFER',
    title: ['6 WEEKS WITH SHANNON.', 'LIFETIME CORE ACCESS.'],
    body: ['Coaching support', 'Core app + vegan community'],
    price: 'AU$99 ONCE',
    cta: 'GET THE DETAILS IN DMS',
    accent: colours.violet,
    composition: 'stack',
    primaryText: "The Balance Vegan Fitness Founders Pass is simple: pay AU$99 once, get six weeks of one-to-one in-app coaching support from me, then keep lifetime access to the core Balance app and vegan fitness community. No sales call needed. Message me for the details.",
    headline: 'Six weeks with Shannon. Balance for life.',
    description: 'The Vegan Fitness Founders Pass',
  },
  {
    id: '04-plant-based-clarity',
    boardId: 'nutrition-clarity',
    source: 'photos/balance-nutrition-shot.jpg',
    eyebrow: 'PLANT-BASED FITNESS, MADE CLEARER',
    title: ['TRAIN WITH PURPOSE.', 'EAT WITH CLARITY.'],
    body: ['Vegan nutrition and progress tools', 'with Shannon there for direction'],
    price: 'FOUNDERS PASS  •  AU$99 ONCE',
    cta: 'SEND MESSAGE',
    accent: colours.coral,
    composition: 'phone-light',
    primaryText: "Plant-based fitness does not need more noise. Balance puts training, vegan nutrition and progress tools together, with six weeks of coaching support from me when you need direction. The Founders Pass is AU$99 once and includes lifetime core app and community access. Message “BALANCE” for details.",
    headline: 'Plant-based fitness, made clearer',
    description: 'Training, nutrition, progress and support',
  },
  {
    id: '05-not-doing-it-alone',
    boardId: 'community',
    source: 'photos/balance-feed-shot.jpg',
    eyebrow: 'BUILT FOR THE VEGAN FITNESS COMMUNITY',
    title: ['PROGRESS IS EASIER', 'WHEN IT IS SHARED.'],
    body: ['Train, learn and keep moving', 'A community that gets it'],
    price: 'AU$99 ONCE  •  LIFETIME CORE ACCESS',
    cta: 'MESSAGE “BALANCE”',
    accent: colours.gold,
    composition: 'feed',
    phonePosition: 'bottom',
    phoneCropTop: 620,
    primaryText: "Balance is more than a workout tracker. It is a vegan fitness community where training, progress and support live together. The Founders Pass includes six weeks with me in your corner, then lifetime access to the core app and community. AU$99 once. Message “BALANCE” to see what is included.",
    headline: 'Vegan fitness is better together',
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
    primaryText: "I built Balance because vegan fitness should feel less lonely and less complicated. I’m an exercise scientist, former gym owner and vegan coach. The Founders Pass gives you six weeks of coaching support with me, plus lifetime core app and vegan community access for AU$99 once. Send me a message and I’ll talk you through it.",
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
  const screen = await image.resize(width - 24, height - 24, { fit: 'cover', position }).png().toBuffer();
  const mask = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${width}" height="${height}" rx="46" fill="#fff"/></svg>`);
  return sharp({ create: { width, height, channels: 4, background: '#0B0710' } })
    .composite([{ input: screen, left: 12, top: 12 }, { input: mask, blend: 'dest-in' }])
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
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${linesSvg(item.title, x, panelY, titleSize, titleGap, colours.white, 900)}
    ${linesSvg(item.body, x, bodyY, tall ? 31 : 27, tall ? 43 : 38, colours.cream, 500)}
    <text x="${x}" y="${priceY}" fill="${item.accent}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 34 : 31}" font-weight="900" letter-spacing="1">${esc(item.price)}</text>
    <rect x="${x}" y="${ctaY}" width="${tall ? 440 : 410}" height="${tall ? 74 : 68}" rx="${tall ? 37 : 34}" fill="${item.accent}"/>
    <text x="${x + (tall ? 220 : 205)}" y="${ctaY + (tall ? 49 : 45)}" fill="${colours.ink}" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 25 : 23}" font-weight="900" text-anchor="middle" letter-spacing="1">${esc(item.cta)}</text>
    <text x="${width - x - 360}" y="${height - (tall ? 60 : 44)}" fill="#FFFFFF" fill-opacity=".72" font-family="Arial, Helvetica, sans-serif" font-size="${tall ? 24 : 20}" font-weight="700">BALANCE • FITNESS GAMIFIED</text>
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
  const phoneW = tall ? 620 : 500;
  const phoneH = tall ? 930 : 790;
  const phone = await phoneBuffer(item.source, phoneW, phoneH, item.phonePosition || 'top', item.phoneCropTop || 0);
  const panelY = tall ? 245 : 215;
  const phoneTop = tall ? 780 : 470;
  return sharp(baseSvg(width, height, item)).composite([
    { input: phone, left: width - phoneW - (tall ? -20 : 40), top: phoneTop },
    { input: copyPanelSvg(width, height, item, { panelY }) },
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

async function render(item, width, height) {
  if (item.composition === 'portrait' || item.composition === 'founder') return renderPortrait(item, width, height);
  if (item.composition === 'stack') return renderStack(item, width, height);
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
