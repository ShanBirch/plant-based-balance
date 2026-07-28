const assert = require('assert');
const path = require('path');

const {
  buildResult,
  collectionForUrl,
  identityForCollection,
  loadCatalog,
  scoreMatch,
} = require('../content-lab/src/exercise-video-catalog');
const {
  buildManifest,
  normalizedFileKey,
} = require('../content-lab/src/refresh-shannon-exercise-library');

const source = path.resolve(__dirname, '..', 'exercise_videos.js');
const entries = loadCatalog(source);

assert(entries.length > 2500, 'expected the full exercise video archive');
assert(new Set(entries.map((entry) => entry.url)).size > 2100, 'expected more than 2,100 unique videos');
assert(scoreMatch('Machine Seated Leg Curl', 'leg curl') > scoreMatch('Waiter Bicep Curl', 'leg curl'));
assert.strictEqual(
  collectionForUrl('https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/pushups.mp4'),
  'app_exercise_videos',
);
assert.strictEqual(identityForCollection('app_exercise_videos').safeForShanFeed, true);
assert.strictEqual(identityForCollection('shannonsvideos_root').safeForShanFeed, false);
assert.strictEqual(normalizedFileKey('balance-social/reels-ready/videos/21-bicep-curls.mp4'), 'bicep-curls');

const result = buildResult(entries, {
  query: 'single arm chest press',
  limit: 10,
  source,
  shannonOnly: false,
});

assert(result.matches.length > 0, 'expected chest press matches');
assert(result.matches.some((match) => /single arm.*chest press/i.test(match.exercise)));
assert(result.matches.every((match, index, all) => all.findIndex((item) => item.url === match.url) === index));

const shannonOnly = buildResult(entries, {
  query: 'rear delt row',
  limit: 10,
  source,
  shannonOnly: true,
});

assert.strictEqual(shannonOnly.summary.uniqueUrls, 219);
assert(shannonOnly.matches.length > 0, 'expected Shannon rear-delt clips');
assert(shannonOnly.matches.every((match) => match.performer === 'shannon'));
assert(shannonOnly.matches.every((match) => match.safeForShanFeed === true));
assert(shannonOnly.matches.every((match) => match.collection !== 'shannonsvideos_root'));

const manifest = buildManifest([
  {
    exercise: 'Pushups',
    normalizedKey: 'pushups',
    url: 'https://example.test/app/pushups.mp4',
    fileName: 'balance-social/app-exercise-videos/pushups.mp4',
    collection: 'app_exercise_videos',
    performer: 'shannon',
    identityBasis: 'shannon_confirmed_collection',
    safeForShanFeed: true,
    bytes: 10,
    uploadedAt: '2026-06-05T00:00:00.000Z',
    priority: 1,
  },
  {
    exercise: 'Pushups',
    normalizedKey: 'pushups',
    url: 'https://example.test/ready/pushups.mp4',
    fileName: 'balance-social/reels-ready/videos/pushups.mp4',
    collection: 'reels_ready_videos',
    performer: 'shannon',
    identityBasis: 'shannon_confirmed_collection',
    safeForShanFeed: true,
    bytes: 20,
    uploadedAt: '2026-06-04T00:00:00.000Z',
    priority: 2,
  },
]);

assert.strictEqual(manifest.summary.uniqueExercises, 1);
assert.strictEqual(manifest.summary.alternateFiles, 1);
assert.strictEqual(manifest.entries[0].collection, 'app_exercise_videos');
assert.strictEqual(manifest.entries[0].alternates[0].collection, 'reels_ready_videos');

console.log('exercise-video-catalog tests passed');
