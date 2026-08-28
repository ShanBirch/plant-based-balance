import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'output', 'meta-broad-pain-test-2026-07-26');

const C = {
  ink: '#241A12',
  brown: '#5B4A3A',
  cream: '#FFF9ED',
  paper: '#F7F2E8',
  gold: '#D8A43A',
  deepGold: '#A96F00',
  paleGold: '#EADCC2',
};

const ads = [
  {
    id: 'b1-stop-starting-over',
    angle: 'All-or-nothing / restarting',
    source: 'photos/what-i-offer-portrait.jpg',
    position: 'centre',
    eyebrow: 'IF YOU KEEP HAVING TO START AGAIN',
    title: ['YOU DO NOT NEED', 'A HARDER PLAN.'],
    body: ['You need one that still works', 'when real life shows up.'],
    primaryText: "If your routine only works when life is quiet, it is not the right routine yet. Balance helps you build training around the week you actually have, with clear steps and Shannon in your corner. Balance Foundations is one AUD $149 payment for the full six weeks and does not auto-renew. Message 'BALANCE' and I will show you what is included.",
    headline: 'Stop starting over',
    description: 'A fitness plan built for real life',
  },
  {
    id: 'b2-knowing-isnt-doing',
    angle: 'Knowing what to do / follow-through',
    source: 'photos/shannon-portrait.jpg',
    position: 'centre',
    eyebrow: 'KNOWING WHAT TO DO IS NOT THE PROBLEM',
    title: ['THE HARD PART IS', 'FOLLOWING', 'THROUGH.'],
    body: ['Clear next steps.', 'A coach in your corner.'],
    primaryText: "You probably do not need another list of exercises or another perfect meal plan. You need a clear next step, support when the week changes, and a way back without guilt. That is what we build inside Balance Foundations. It includes training, nutrition tools and six weeks with Shannon for one AUD $149 payment for the full six weeks, with no auto-renewal. Message 'BALANCE' for the details.",
    headline: 'Turn knowing into doing',
    description: 'Clear steps and personal support',
  },
  {
    id: 'b3-built-around-your-week',
    angle: 'Busy life / competing priorities',
    source: 'assets/campaigns/founders-pass-meta-2026-07-22/source/balance-home-screen.png',
    position: 'top',
    fit: 'contain',
    eyebrow: 'WORK. KIDS. SHIFTS. LIFE.',
    title: ['YOUR PLAN SHOULD FIT', 'THE WEEK YOU HAVE.'],
    body: ['Choose the rhythm.', 'Keep control of the decision.'],
    primaryText: "Work, kids, shifts and low-energy days are not failures. They are part of the plan. Balance Foundations gives you a realistic six-week training rhythm plus one weekly check-in and plan review with Shannon for one AUD $149 payment for the full six weeks, with no auto-renewal. Message 'BALANCE' to take a look.",
    headline: 'Built around your actual week',
    description: 'Fitness support that adapts with you',
  },
];

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textLines(lines, x, y, size, gap, fill, weight = 800) {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * gap}" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="-1.4">${esc(line)}</text>`).join('');
}

async function framedImage(ad, width, height) {
  const inset = 16;
  const photo = await sharp(path.join(ROOT, ad.source))
    .resize(width - inset * 2, height - inset * 2, {
      fit: ad.fit || 'cover',
      position: ad.position,
      background: C.cream,
    })
    .png()
    .toBuffer();
  const frame = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="16" stdDeviation="15" flood-color="#5B3C10" flood-opacity=".22"/></filter></defs>
    <rect x="7" y="7" width="${width - 14}" height="${height - 14}" rx="32" fill="${C.cream}" stroke="${C.gold}" stroke-width="7" filter="url(#s)"/>
  </svg>`);
  const mask = Buffer.from(`<svg width="${width - inset * 2}" height="${height - inset * 2}" xmlns="http://www.w3.org/2000/svg"><rect width="${width - inset * 2}" height="${height - inset * 2}" rx="20" fill="#fff"/></svg>`);
  const clipped = await sharp(photo).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: '#00000000' } })
    .composite([{ input: frame }, { input: clipped, left: inset, top: inset }])
    .png()
    .toBuffer();
}

async function render(ad, width, height) {
  const story = height > 1500;
  const margin = story ? 70 : 64;
  const cardX = story ? 70 : 600;
  const cardY = story ? 800 : 410;
  const cardW = story ? 940 : 420;
  const cardH = story ? 820 : 850;
  const titleY = story ? 260 : 218;
  const titleSize = story ? 67 : 56;
  const titleGap = story ? 74 : 62;
  const bodyY = titleY + ad.title.length * titleGap + 32;
  const frame = await framedImage(ad, cardW, cardH);
  const copyWidth = story ? 940 : 500;
  const ctaY = story ? 1710 : 1132;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.cream}"/><stop offset=".66" stop-color="${C.paper}"/><stop offset="1" stop-color="${C.paleGold}"/></linearGradient>
      <radialGradient id="g"><stop stop-color="${C.gold}" stop-opacity=".2"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="940" cy="140" r="520" fill="url(#g)"/>
    <rect width="${width}" height="12" fill="${C.gold}"/>
    <text x="${margin}" y="${story ? 120 : 88}" fill="${C.deepGold}" font-family="Arial, Helvetica, sans-serif" font-size="${story ? 28 : 22}" font-weight="800" letter-spacing="2.5">${esc(ad.eyebrow)}</text>
    ${textLines(ad.title, margin, titleY, titleSize, titleGap, C.ink, 900)}
    ${textLines(ad.body, margin, bodyY, story ? 31 : 25, story ? 43 : 36, C.brown, 500)}
    ${story ? '' : `<rect x="${margin}" y="${ctaY - 8}" width="470" height="72" rx="36" fill="${C.gold}"/><text x="${margin + 235}" y="${ctaY + 38}" fill="${C.ink}" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="900" text-anchor="middle" letter-spacing="1">MESSAGE 'BALANCE'</text>`}
    <text x="${margin}" y="${story ? 1840 : 1300}" fill="${C.deepGold}" font-family="Arial, Helvetica, sans-serif" font-size="${story ? 31 : 25}" font-weight="900">FOUNDATIONS  ·  AUD $149  ·  SIX WEEKS  ·  NO AUTO-RENEWAL</text>
    <text x="${story ? 650 : margin}" y="${story ? 1886 : 1330}" fill="${C.ink}" fill-opacity=".7" font-family="Arial, Helvetica, sans-serif" font-size="${story ? 22 : 18}" font-weight="700">BALANCE FITNESS COACHING</text>
    ${story ? `<rect x="70" y="1680" width="470" height="76" rx="38" fill="${C.gold}"/><text x="305" y="1729" fill="${C.ink}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" text-anchor="middle" letter-spacing="1">MESSAGE 'BALANCE'</text>` : ''}
    <rect x="${story ? margin : 580}" y="${story ? 780 : 390}" width="${story ? 980 : 460}" height="${story ? 860 : 890}" rx="46" fill="${C.gold}" opacity=".06"/>
    <rect x="${margin}" y="${story ? 1768 : 1220}" width="${copyWidth}" height="2" fill="${C.gold}" opacity=".5"/>
  </svg>`);
  return sharp(svg).composite([{ input: frame, left: cardX, top: cardY }]).png().toBuffer();
}

await fs.mkdir(OUT, { recursive: true });
const exportsList = [];
for (const ad of ads) {
  const feed = `${ad.id}-feed-1080x1350.png`;
  const story = `${ad.id}-story-1080x1920.png`;
  await fs.writeFile(path.join(OUT, feed), await render(ad, 1080, 1350));
  await fs.writeFile(path.join(OUT, story), await render(ad, 1080, 1920));
  exportsList.push({ ...ad, feed, story });
}

const plan = {
  name: 'BAL | Balance Foundations | General Fitness | IG DM | AU | 2026-08-28',
  status: 'PAUSED_FOR_REVIEW',
  objective: 'Instagram Direct conversations',
  offer: 'Balance Foundations, one AUD $149 payment for the full six weeks, no auto-renewal',
  budget: { dailyAud: 20, instruction: 'Do not increase total budget for this test.' },
  structure: {
    campaign: 'Use the existing Instagram Direct conversations campaign.',
    adSet: 'Use one broad Australia ad set. Do not create separate interest or plant-based ad sets.',
    testAds: ads.map((ad) => ad.id),
  },
  destinations: {
    paidMeta: 'https://future-balance.netlify.app/fitness-coaching.html?utm_source=instagram&utm_medium=paid_social&utm_campaign=balance_foundations_general_20260828&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}',
    dmRule: 'Every verified paid-Meta lead uses the one neutral general-fitness flow. Preserve attribution parameters on the canonical thread and use the clean public URL in DMs.',
  },
  fate: {
    focus: 'Adults who keep restarting, struggle to follow through, or cannot fit rigid plans around real life.',
    authority: 'Shannon as the coach, supported by real Balance app and training imagery.',
    tribe: 'Busy people who want structure, support and a realistic way to keep going.',
    emotion: 'Relief from self-blame, then confidence that the next step can be manageable.',
  },
  measurement: {
    primary: ['Qualified Instagram conversations', 'Purchases'],
    secondary: ['Cost per conversation', 'Checkout links sent'],
    warning: 'Do not choose a winner from cheap DMs alone.',
  },
  decisionRules: [
    'Run only the approved general-fitness ads in the same broad ad set.',
    'Make no creative edits during the first 72 hours unless delivery is broken.',
    'Assess after seven days or when each ad has meaningful spend, whichever is later.',
    'Keep the ads that produce qualified conversations and purchases, not simply the lowest cost per message.',
    'Rotate one new creative in at a time after the first review. Do not create a new ad set for every angle.',
  ],
  ads: exportsList.map((ad) => ({
    name: ad.id,
    angle: ad.angle,
    creative: { feed: ad.feed, story: ad.story },
    primaryText: ad.primaryText,
    headline: ad.headline,
    description: ad.description,
    cta: 'Send message',
  })),
};
await fs.writeFile(path.join(OUT, 'campaign-plan.json'), `${JSON.stringify(plan, null, 2)}\n`);

const cards = exportsList.map((ad, index) => `<article><img src="${ad.feed}" alt="${esc(ad.headline)}"><div><span>CREATIVE ${index + 1}</span><h2>${esc(ad.headline)}</h2><p class="angle">${esc(ad.angle)}</p><p>${esc(ad.primaryText)}</p><p><strong>Headline:</strong> ${esc(ad.headline)}</p><p><strong>Description:</strong> ${esc(ad.description)}</p></div></article>`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Balance General Fitness Ads</title><style>body{margin:0;background:#f7f2e8;color:#241a12;font:16px/1.55 Arial,sans-serif}header{padding:48px max(24px,5vw);background:linear-gradient(135deg,#fff9ed,#eadcc2);border-bottom:8px solid #d8a43a}h1{font-size:clamp(38px,6vw,76px);line-height:.96;margin:14px 0}header p{max-width:850px;color:#5b4a3a;font-size:18px}main{padding:36px max(20px,4vw);display:grid;gap:36px}article{display:grid;grid-template-columns:minmax(280px,520px) 1fr;gap:36px;align-items:start;background:#fff9ed;border:1px solid #d8a43a;border-radius:24px;padding:20px;box-shadow:0 18px 44px #6b4d241c}img{width:100%;border-radius:14px;background:#fff}.angle{color:#a96f00;font-weight:800}span{color:#a96f00;font-weight:900;letter-spacing:2px}h2{font-size:34px;line-height:1.05}p{color:#5b4a3a}@media(max-width:800px){article{grid-template-columns:1fr}header{padding-top:30px}}</style></head><body><header><span>PAUSED FOR YOUR REVIEW</span><h1>Broad audience.<br>Specific pain points.</h1><p>These creatives all use the single general-audience Balance route. The ads, landing page and DM handoff stay focused on restarting, follow-through and fitting training around real life. Nothing here is approved to run until you choose it.</p></header><main>${cards}</main></body></html>`;
await fs.writeFile(path.join(OUT, 'review.html'), html);

console.log(JSON.stringify({ outDir: OUT, review: path.join(OUT, 'review.html'), ads: exportsList.map(({ id, feed, story }) => ({ id, feed, story })) }, null, 2));
