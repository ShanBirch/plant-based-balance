const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const catalogSource = fs.readFileSync(path.join(root, 'exercise_videos.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(`${catalogSource}\n;globalThis.__catalog = EXERCISE_VIDEOS;`, context);

const urls = [...new Set(Object.values(context.__catalog))];
const repositoryCompat = url => String(url).startsWith('/assets/exercise-videos/compat/');
const hostedCompat = url => /^https:\/\/[^/]+\/file\/plantbasedbalancestories\/balance-social\/app-exercise-videos\/phone-v1\/[a-f0-9]{24}\.mp4$/.test(String(url));

assert.ok(urls.length >= 1900, 'canonical exercise catalogue unexpectedly shrank');
assert.deepStrictEqual(
  urls.filter(url => !repositoryCompat(url) && !hostedCompat(url)),
  [],
  'every canonical exercise video must use the validated cross-phone compatibility library'
);

const normalizer = fs.readFileSync(path.join(root, 'scripts', 'normalize-exercise-video-library.mjs'), 'utf8');
assert.match(normalizer, /-profile:v', 'baseline'/, 'normalizer must emit H.264 Baseline');
assert.match(normalizer, /-level:v', '3\.1'/, 'normalizer must cap H.264 at Level 3.1');
assert.match(normalizer, /-pix_fmt', 'yuv420p'/, 'normalizer must emit the universal 4:2:0 pixel format');
assert.match(normalizer, /-movflags', '\+faststart'/, 'normalizer must put MP4 metadata before video data');
assert.match(normalizer, /r_frame_rate[^\n]+24\/1/, 'normalizer must validate constant 24fps output');
assert.match(normalizer, /Number\(stream\.has_b_frames \|\| 0\) !== 0/, 'normalizer must reject B-frames');
assert.match(normalizer, /await verifyPublishedVideo\(publicUrl, bytes\.byteLength\)/, 'normalizer must verify each published object before checkpointing it');
assert.match(normalizer, /completed: manifest\.entries \|\| \{\}/, 'normalizer must resume from the committed manifest in a fresh checkout');
assert.match(normalizer, /!isRepositoryCompatUrl\(url\) && !isHostedCompatUrl\(url\)/, 'normalizer must skip already-compatible sources on later runs');
assert.match(normalizer, /entries: checkpoint\.completed/, 'normalizer must retain the existing manifest when adding later videos');

console.log('exercise video phone compatibility guard passed');
