#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SOURCE = path.join(ROOT, 'exercise_videos.js');
const DEFAULT_MANIFEST = path.join(ROOT, 'content-lab', 'data', 'shannon-exercise-library.json');

function parseArgs(argv) {
  const args = {
    query: '',
    limit: 20,
    json: false,
    source: DEFAULT_SOURCE,
    manifest: DEFAULT_MANIFEST,
    shannonOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') args.json = true;
    else if (value === '--shannon-only') args.shannonOnly = true;
    else if (value === '--query' || value === '--search') args.query = argv[++index] || '';
    else if (value.startsWith('--query=')) args.query = value.slice('--query='.length);
    else if (value.startsWith('--search=')) args.query = value.slice('--search='.length);
    else if (value === '--limit') args.limit = Number(argv[++index] || 20);
    else if (value.startsWith('--limit=')) args.limit = Number(value.slice('--limit='.length));
    else if (value === '--source') args.source = path.resolve(argv[++index] || DEFAULT_SOURCE);
    else if (value.startsWith('--source=')) args.source = path.resolve(value.slice('--source='.length));
    else if (value === '--manifest') args.manifest = path.resolve(argv[++index] || DEFAULT_MANIFEST);
    else if (value.startsWith('--manifest=')) args.manifest = path.resolve(value.slice('--manifest='.length));
    else if (!value.startsWith('-') && !args.query) args.query = value;
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = 20;
  args.limit = Math.min(Math.floor(args.limit), 200);
  return args;
}

function identityForCollection(collection) {
  if (collection === 'app_exercise_videos' || collection === 'reels_ready_videos') {
    return {
      performer: 'shannon',
      identityBasis: 'shannon_confirmed_collection',
      safeForShanFeed: true,
    };
  }
  if (collection === 'shannonsvideos_root') {
    return {
      performer: 'generic_or_other',
      identityBasis: 'generic_demonstration_collection',
      safeForShanFeed: false,
    };
  }
  return {
    performer: 'unknown',
    identityBasis: 'unclassified',
    safeForShanFeed: false,
  };
}

function loadShannonManifest(manifestPath = DEFAULT_MANIFEST) {
  if (!manifestPath || !fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return (manifest.entries || []).map((entry) => ({
    exercise: entry.exercise,
    url: entry.url,
    provider: 'backblaze',
    collection: entry.collection,
    performer: entry.performer,
    identityBasis: entry.identityBasis,
    safeForShanFeed: entry.safeForShanFeed === true,
    fileName: entry.fileName,
    alternates: entry.alternates || [],
  }));
}

function loadCatalog(sourcePath, manifestPath = DEFAULT_MANIFEST) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const assignment = source.indexOf('const EXERCISE_VIDEOS');
  const objectStart = source.indexOf('{', assignment);
  const objectEnd = source.indexOf('\n};', objectStart);

  if (assignment < 0 || objectStart < 0 || objectEnd < 0) {
    throw new Error(`Could not locate EXERCISE_VIDEOS object in ${sourcePath}`);
  }

  const objectText = source.slice(objectStart, objectEnd + 2);
  // The catalogue is a JavaScript object literal and contains section comments,
  // so evaluate only the isolated literal rather than requiring the app file.
  const catalog = vm.runInNewContext(`(${objectText})`, Object.create(null), {
    timeout: 1000,
  });
  const legacyEntries = Object.entries(catalog).map(([exercise, url]) => {
    const collection = collectionForUrl(url);
    return {
      exercise,
      url,
      provider: url.includes('backblazeb2.com')
        ? 'backblaze'
        : url.includes('drive.google.com')
          ? 'google_drive'
          : 'other',
      collection,
      ...identityForCollection(collection),
    };
  });
  return [...legacyEntries, ...loadShannonManifest(manifestPath)];
}

function collectionForUrl(url) {
  if (url.includes('/file/shannonsvideos/')) return 'shannonsvideos_root';
  if (url.includes('/file/plantbasedbalancestories/balance-social/app-exercise-videos/')) {
    return 'app_exercise_videos';
  }
  if (url.includes('drive.google.com')) return 'google_drive_legacy';
  return 'other';
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreMatch(exercise, query) {
  if (!query) return 1;
  const name = normalize(exercise);
  const wanted = normalize(query);
  if (!wanted) return 1;
  if (name === wanted) return 1000;
  if (name.startsWith(wanted)) return 800;
  if (name.includes(wanted)) return 600;

  const tokens = wanted.split(' ').filter(Boolean);
  const matched = tokens.filter((token) => name.includes(token)).length;
  if (matched === 0) return 0;
  const allTokens = matched === tokens.length;
  return (allTokens ? 400 : 100) + matched * 20 - Math.abs(name.length - wanted.length) / 10;
}

function dedupeByUrl(items) {
  const seen = new Map();
  for (const item of items) {
    const existing = seen.get(item.url);
    if (!existing || item.score > existing.score) seen.set(item.url, item);
  }
  return [...seen.values()];
}

function buildResult(entries, args) {
  const eligibleEntries = args.shannonOnly
    ? entries.filter((entry) => entry.performer === 'shannon' && entry.safeForShanFeed === true)
    : entries;
  const providers = eligibleEntries.reduce((counts, entry) => {
    counts[entry.provider] = (counts[entry.provider] || 0) + 1;
    return counts;
  }, {});
  const collections = eligibleEntries.reduce((counts, entry) => {
    counts[entry.collection] = (counts[entry.collection] || 0) + 1;
    return counts;
  }, {});
  const performers = eligibleEntries.reduce((counts, entry) => {
    counts[entry.performer] = (counts[entry.performer] || 0) + 1;
    return counts;
  }, {});
  const uniqueUrls = new Set(eligibleEntries.map((entry) => entry.url)).size;

  const matches = dedupeByUrl(
    eligibleEntries
      .map((entry) => ({ ...entry, score: scoreMatch(entry.exercise, args.query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.exercise.localeCompare(b.exercise)),
  ).slice(0, args.limit);

  return {
    source: args.source,
    manifest: args.manifest,
    query: args.query,
    shannonOnly: args.shannonOnly === true,
    summary: {
      namedEntries: eligibleEntries.length,
      uniqueUrls,
      providers,
      collections,
      performers,
    },
    matches: matches.map(({ score, ...entry }) => entry),
  };
}

function printHuman(result) {
  const { summary } = result;
  console.log(`Catalog: ${summary.namedEntries} names, ${summary.uniqueUrls} unique videos`);
  console.log(`Providers: ${Object.entries(summary.providers).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  console.log(`Collections: ${Object.entries(summary.collections).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  if (result.shannonOnly) console.log('Identity filter: Shannon-only (feed-safe collections)');
  if (!result.query) {
    console.log('Use --query="exercise name" to search the archive.');
    return;
  }
  console.log(`Search: ${result.query}`);
  if (result.matches.length === 0) {
    console.log('No matching indexed exercise clips.');
    return;
  }
  result.matches.forEach((match, index) => {
    console.log(`${index + 1}. ${match.exercise}`);
    console.log(`   ${match.provider}: ${match.url}`);
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const entries = loadCatalog(args.source, args.manifest);
  const result = buildResult(entries, args);
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else printHuman(result);
}

if (require.main === module) main();

module.exports = {
  buildResult,
  collectionForUrl,
  dedupeByUrl,
  identityForCollection,
  loadCatalog,
  loadShannonManifest,
  normalize,
  parseArgs,
  scoreMatch,
};
