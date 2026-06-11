const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const LAB_ROOT = path.resolve(__dirname, "..");
const PROJECT_ROOT = path.resolve(LAB_ROOT, "..");
const CONFIG_PATH = path.join(LAB_ROOT, "config", "gold-coast-ai-solutions-week-1.json");
const OUTPUT_ROOT = path.join(LAB_ROOT, "output", "gold-coast-ai", "week-one");
const SITE_ASSET_DIR = path.join(PROJECT_ROOT, "assets", "gold-coast-ai");

const FEED = { width: 1080, height: 1350 };
const STORY = { width: 1080, height: 1920 };

const palette = {
  charcoal: "#102027",
  ink: "#17212a",
  muted: "#64748b",
  blue: "#2563eb",
  eucalyptus: "#2f7d5c",
  sand: "#f4efe6",
  yellow: "#f5b642",
  coral: "#ef6f61",
  white: "#ffffff",
  line: "#d9e2df"
};

function esc(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "post";
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function wrapWords(text, maxChars) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textBlock(text, x, y, options = {}) {
  const {
    maxChars = 24,
    size = 76,
    lineHeight = Math.round(size * 1.04),
    weight = 900,
    fill = palette.ink,
    maxLines = 5,
    anchor = "start",
    family = "Arial, Segoe UI, sans-serif"
  } = options;
  const lines = wrapWords(text, maxChars).slice(0, maxLines);
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="0" fill="${fill}">${esc(line)}</text>`
  )).join("\n");
}

function pill(x, y, width, label, fill, textFill = palette.white) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="46" rx="8" fill="${fill}" />
    <text x="${x + 22}" y="${y + 31}" font-family="Arial, Segoe UI, sans-serif" font-size="20" font-weight="900" letter-spacing="0" fill="${textFill}">${esc(label.toUpperCase())}</text>
  `;
}

function smallChecklist(items, x, y, width, accent) {
  const max = items.slice(0, 4);
  return max.map((item, index) => {
    const top = y + index * 28;
    const lines = wrapWords(item, 54).slice(0, 1);
    return `
      <g>
        <circle cx="${x + 17}" cy="${top + 17}" r="10" fill="${accent}" />
        <path d="M${x + 12} ${top + 17} L${x + 16} ${top + 21} L${x + 23} ${top + 12}" fill="none" stroke="${palette.white}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        ${lines.map((line, lineIndex) => `<text x="${x + 40}" y="${top + 23 + lineIndex * 22}" font-family="Arial, Segoe UI, sans-serif" font-size="20" font-weight="800" fill="${palette.ink}">${esc(line)}</text>`).join("")}
      </g>
    `;
  }).join("\n");
}

function feedSvg(post, index, brand) {
  const isMorning = post.slot === "morning";
  const accent = isMorning ? palette.blue : (post.lane === "offer" || post.lane === "cta" ? palette.coral : palette.eucalyptus);
  const secondary = isMorning ? palette.yellow : palette.blue;
  const labelWidth = Math.min(500, Math.max(250, post.label.length * 15 + 60));
  const postNo = String(index + 1).padStart(2, "0");
  const hookLines = wrapWords(post.hook, 24);
  const hookSize = hookLines.length > 4 ? 64 : 72;

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${FEED.width}" height="${FEED.height}" viewBox="0 0 ${FEED.width} ${FEED.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${palette.sand}" />
        <stop offset="0.52" stop-color="#ffffff" />
        <stop offset="1" stop-color="#e8f3ef" />
      </linearGradient>
      <pattern id="grid" width="58" height="58" patternUnits="userSpaceOnUse">
        <path d="M 58 0 L 0 0 0 58" fill="none" stroke="#b8c7c2" stroke-width="1" opacity="0.34"/>
      </pattern>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#102027" flood-opacity="0.16"/>
      </filter>
    </defs>
    <rect width="1080" height="1350" fill="url(#bg)" />
    <rect width="1080" height="1350" fill="url(#grid)" opacity="0.42" />
    <circle cx="940" cy="138" r="150" fill="${secondary}" opacity="0.20" />
    <circle cx="112" cy="1190" r="180" fill="${accent}" opacity="0.16" />
    <rect x="58" y="58" width="964" height="1234" rx="8" fill="#ffffff" opacity="0.58" stroke="#d8e1de" stroke-width="2" />

    <text x="82" y="108" font-family="Arial, Segoe UI, sans-serif" font-size="24" font-weight="900" fill="${palette.charcoal}" letter-spacing="0">${esc(brand.toUpperCase())}</text>
    <text x="998" y="108" text-anchor="end" font-family="Arial, Segoe UI, sans-serif" font-size="24" font-weight="900" fill="${palette.muted}" letter-spacing="0">${postNo}</text>
    ${pill(82, 146, labelWidth, post.label, accent)}

    ${textBlock(post.hook, 82, 302, {
      maxChars: 22,
      size: hookSize,
      lineHeight: Math.round(hookSize * 1.03),
      weight: 900,
      fill: palette.charcoal,
      maxLines: 5
    })}

    <rect x="82" y="740" width="916" height="180" rx="8" fill="${palette.charcoal}" filter="url(#shadow)" />
    ${textBlock(post.subhead, 120, 802, {
      maxChars: 42,
      size: 33,
      lineHeight: 40,
      weight: 800,
      fill: palette.white,
      maxLines: 3
    })}

    <g transform="translate(82 970)">
      <rect x="0" y="0" width="916" height="200" rx="8" fill="#ffffff" stroke="${palette.line}" stroke-width="2" />
      <rect x="0" y="0" width="12" height="200" rx="6" fill="${secondary}" />
      <text x="36" y="50" font-family="Arial, Segoe UI, sans-serif" font-size="25" font-weight="900" fill="${accent}">WHAT THIS POST DOES</text>
      ${smallChecklist(post.slides || [], 36, 78, 820, accent)}
    </g>

    <rect x="82" y="1210" width="300" height="62" rx="8" fill="${accent}" />
    <text x="232" y="1250" text-anchor="middle" font-family="Arial, Segoe UI, sans-serif" font-size="28" font-weight="900" fill="#ffffff">${esc(post.cta)}</text>
    <text x="998" y="1248" text-anchor="end" font-family="Arial, Segoe UI, sans-serif" font-size="25" font-weight="900" fill="${palette.charcoal}">${esc(post.day)} ${esc(post.slot.toUpperCase())}</text>
  </svg>`;
}

function storySvg(story, index, brand) {
  const frames = story.frames || [];
  const frameBlocks = frames.slice(0, 4).map((frame, frameIndex) => {
    const y = 730 + frameIndex * 190;
    const lines = wrapWords(frame, 34).slice(0, 2);
    return `
      <g>
        <rect x="78" y="${y}" width="924" height="146" rx="8" fill="#ffffff" opacity="0.96" />
        <rect x="78" y="${y}" width="14" height="146" rx="7" fill="${frameIndex % 2 ? palette.blue : palette.yellow}" />
        <text x="124" y="${y + 47}" font-family="Arial, Segoe UI, sans-serif" font-size="26" font-weight="900" fill="${palette.eucalyptus}">FRAME ${frameIndex + 1}</text>
        ${lines.map((line, lineIndex) => `<text x="124" y="${y + 92 + lineIndex * 34}" font-family="Arial, Segoe UI, sans-serif" font-size="31" font-weight="850" fill="${palette.charcoal}">${esc(line)}</text>`).join("")}
      </g>
    `;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${STORY.width}" height="${STORY.height}" viewBox="0 0 ${STORY.width} ${STORY.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="storyBg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${palette.charcoal}" />
        <stop offset="0.55" stop-color="#173f3a" />
        <stop offset="1" stop-color="#0d1721" />
      </linearGradient>
      <pattern id="storyGrid" width="70" height="70" patternUnits="userSpaceOnUse">
        <path d="M 70 0 L 0 0 0 70" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.14"/>
      </pattern>
    </defs>
    <rect width="1080" height="1920" fill="url(#storyBg)" />
    <rect width="1080" height="1920" fill="url(#storyGrid)" />
    <circle cx="926" cy="220" r="180" fill="${palette.yellow}" opacity="0.20" />
    <circle cx="120" cy="1650" r="230" fill="${palette.coral}" opacity="0.16" />
    <text x="78" y="132" font-family="Arial, Segoe UI, sans-serif" font-size="28" font-weight="900" fill="#ffffff">${esc(brand.toUpperCase())}</text>
    <text x="1002" y="132" text-anchor="end" font-family="Arial, Segoe UI, sans-serif" font-size="28" font-weight="900" fill="${palette.yellow}">${String(index + 1).padStart(2, "0")}</text>
    ${pill(78, 188, 260, "Story plan", palette.yellow, palette.charcoal)}
    ${textBlock(story.hook, 78, 378, {
      maxChars: 21,
      size: 78,
      lineHeight: 82,
      weight: 900,
      fill: palette.white,
      maxLines: 4
    })}
    ${frameBlocks}
    <rect x="78" y="1698" width="924" height="112" rx="8" fill="${palette.coral}" />
    <text x="540" y="1768" text-anchor="middle" font-family="Arial, Segoe UI, sans-serif" font-size="37" font-weight="900" fill="#ffffff">Daily stories: poll, proof, lesson, CTA</text>
  </svg>`;
}

function heroSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1800" height="1100" viewBox="0 0 1800 1100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#f4efe6" />
        <stop offset="0.42" stop-color="#d9eee8" />
        <stop offset="1" stop-color="#102027" />
      </linearGradient>
      <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#102027" flood-opacity="0.28"/>
      </filter>
    </defs>
    <rect width="1800" height="1100" fill="url(#sky)" />
    <circle cx="1490" cy="185" r="138" fill="${palette.yellow}" opacity="0.86" />
    <path d="M0 770 C280 690 390 810 630 745 C870 680 1010 570 1260 640 C1480 702 1610 650 1800 580 L1800 1100 L0 1100 Z" fill="#1c6a65" opacity="0.86"/>
    <path d="M0 835 C230 790 420 900 650 840 C900 775 1110 792 1300 850 C1510 915 1620 845 1800 810 L1800 1100 L0 1100 Z" fill="#102027" opacity="0.96"/>
    <g transform="translate(620 190)" filter="url(#softShadow)">
      <rect x="0" y="0" width="820" height="560" rx="18" fill="#ffffff"/>
      <rect x="0" y="0" width="820" height="64" rx="18" fill="#102027"/>
      <circle cx="36" cy="32" r="8" fill="#ef6f61"/>
      <circle cx="66" cy="32" r="8" fill="#f5b642"/>
      <circle cx="96" cy="32" r="8" fill="#2f7d5c"/>
      <text x="132" y="40" font-family="Arial, Segoe UI, sans-serif" font-size="22" font-weight="900" fill="#ffffff">Local AI operating board</text>
      <rect x="44" y="104" width="220" height="132" rx="8" fill="#f4efe6"/>
      <text x="70" y="148" font-family="Arial, Segoe UI, sans-serif" font-size="24" font-weight="900" fill="#102027">Leads</text>
      <text x="70" y="194" font-family="Arial, Segoe UI, sans-serif" font-size="42" font-weight="900" fill="#2563eb">18</text>
      <rect x="300" y="104" width="220" height="132" rx="8" fill="#e7f4ef"/>
      <text x="326" y="148" font-family="Arial, Segoe UI, sans-serif" font-size="24" font-weight="900" fill="#102027">Follow-ups</text>
      <text x="326" y="194" font-family="Arial, Segoe UI, sans-serif" font-size="42" font-weight="900" fill="#2f7d5c">7</text>
      <rect x="556" y="104" width="220" height="132" rx="8" fill="#fff4d9"/>
      <text x="582" y="148" font-family="Arial, Segoe UI, sans-serif" font-size="24" font-weight="900" fill="#102027">Quotes</text>
      <text x="582" y="194" font-family="Arial, Segoe UI, sans-serif" font-size="42" font-weight="900" fill="#b7791f">5</text>
      <rect x="44" y="286" width="732" height="46" rx="8" fill="#edf2f7"/>
      <rect x="44" y="356" width="610" height="46" rx="8" fill="#edf2f7"/>
      <rect x="44" y="426" width="694" height="46" rx="8" fill="#edf2f7"/>
      <circle cx="70" cy="309" r="12" fill="#2563eb"/>
      <circle cx="70" cy="379" r="12" fill="#2f7d5c"/>
      <circle cx="70" cy="449" r="12" fill="#ef6f61"/>
      <text x="104" y="318" font-family="Arial, Segoe UI, sans-serif" font-size="24" font-weight="800" fill="#102027">Draft quote reply for new website enquiry</text>
      <text x="104" y="388" font-family="Arial, Segoe UI, sans-serif" font-size="24" font-weight="800" fill="#102027">Remind owner before lead goes cold</text>
      <text x="104" y="458" font-family="Arial, Segoe UI, sans-serif" font-size="24" font-weight="800" fill="#102027">Turn customer questions into next FAQ post</text>
    </g>
    <g transform="translate(314 418)" filter="url(#softShadow)">
      <rect x="0" y="0" width="260" height="455" rx="28" fill="#111827"/>
      <rect x="18" y="42" width="224" height="360" rx="18" fill="#ffffff"/>
      <text x="42" y="92" font-family="Arial, Segoe UI, sans-serif" font-size="22" font-weight="900" fill="#102027">IG enquiry</text>
      <rect x="42" y="126" width="158" height="56" rx="8" fill="#e7f4ef"/>
      <rect x="72" y="204" width="130" height="56" rx="8" fill="#f4efe6"/>
      <rect x="42" y="282" width="178" height="72" rx="8" fill="#dbeafe"/>
      <circle cx="130" cy="424" r="12" fill="#ffffff"/>
    </g>
  </svg>`;
}

async function writePng(svg, outPath, width) {
  ensureDir(path.dirname(outPath));
  await sharp(Buffer.from(svg)).resize({ width }).png().toFile(outPath);
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const feedDir = path.join(OUTPUT_ROOT, "feed");
  const storyDir = path.join(OUTPUT_ROOT, "stories");
  ensureDir(feedDir);
  ensureDir(storyDir);
  ensureDir(SITE_ASSET_DIR);

  const manifest = {
    brand: config.brand,
    handle: config.handle,
    weekStart: config.weekStart,
    createdAt: new Date().toISOString(),
    feed: [],
    stories: [],
    siteAssets: []
  };

  for (const [index, post] of config.posts.entries()) {
    const fileName = `${String(index + 1).padStart(2, "0")}-${slug(post.day)}-${post.slot}-${slug(post.lane)}.png`;
    const outPath = path.join(feedDir, fileName);
    await writePng(feedSvg(post, index, config.brand), outPath, FEED.width);
    manifest.feed.push({ ...post, assetPath: path.relative(PROJECT_ROOT, outPath).replace(/\\/g, "/") });
  }

  for (const [index, story] of config.stories.entries()) {
    const fileName = `${String(index + 1).padStart(2, "0")}-${slug(story.day)}-story-plan.png`;
    const outPath = path.join(storyDir, fileName);
    await writePng(storySvg(story, index, config.brand), outPath, STORY.width);
    manifest.stories.push({ ...story, assetPath: path.relative(PROJECT_ROOT, outPath).replace(/\\/g, "/") });
  }

  const heroPath = path.join(SITE_ASSET_DIR, "hero-local-ai-systems.png");
  await writePng(heroSvg(), heroPath, 1800);
  manifest.siteAssets.push(path.relative(PROJECT_ROOT, heroPath).replace(/\\/g, "/"));

  const manifestPath = path.join(OUTPUT_ROOT, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Generated ${manifest.feed.length} feed examples`);
  console.log(`Generated ${manifest.stories.length} story cards`);
  console.log(path.relative(PROJECT_ROOT, manifestPath));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
