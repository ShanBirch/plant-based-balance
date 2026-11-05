const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const window = { location: new URL('https://plantbased-balance.org/dashboard.html') };
const context = { window, URL, document: { baseURI: window.location.href } };
vm.createContext(context);
vm.runInContext(read('exercise_videos.js') + '\nthis.catalog=EXERCISE_VIDEOS;', context);
vm.runInContext(read('workout_library_extended.js') + '\nthis.yoga=WORKOUT_LIBRARY_EXTENDED.yoga;', context);
vm.runInContext(read('js/dashboard/pbb-exercise-video-backups.js'), context);

test('every yoga library demo with a catalog video uses an existing same-site MP4', () => {
  const exercises = Object.values(context.yoga.subcategories).flatMap(s => s.workouts.flatMap(w => w.exercises));
  let checked = 0;
  for (const exercise of exercises) {
    const url = context.catalog[exercise.name];
    if (!url) continue; // Existing library gaps are separate from the host regression.
    assert.ok(url.startsWith('/assets/exercise-videos/compat/'), exercise.name);
    const bytes = fs.readFileSync(path.join(root, url));
    assert.equal(bytes.subarray(4, 8).toString(), 'ftyp', exercise.name);
    checked++;
  }
  assert.ok(checked > 100);
});

test('the exact stalled phone URL and every new yoga copy resolve old saved links to the same site', () => {
  const stalled = 'https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/15edb4df2d317a2fe4095193.mp4';
  assert.match(window.resolveExerciseVideoSource(stalled), /plantbased-balance.org\/assets\/exercise-videos\/compat\/yoga-/);
  let checked = 0;
  for (const [primary, backup] of Object.entries(window.PBB_EXERCISE_VIDEO_BACKUPS)) {
    if (!backup.startsWith('/assets/exercise-videos/compat/yoga-')) continue;
    const preferred = window.resolveExerciseVideoSource(primary + '#t=0.1');
    assert.equal(new URL(preferred).origin, window.location.origin);
    assert.equal(new URL(preferred).pathname, backup);
    assert.equal(window.PBB_EXERCISE_VIDEO_BACKUPS[preferred], primary);
    checked++;
  }
  assert.equal(checked, 44);
});

test('new catalog and old-link resolver versions reach both phone loading paths and offline shell', () => {
  const dashboard = read('dashboard.html');
  const shell = read('offline-shell.js');
  assert.equal(dashboard.split('exercise_videos.js?v=20261105-yoga-same-site').length - 1, 2);
  for (const asset of ['exercise_videos.js?v=20261105-yoga-same-site', 'pbb-exercise-video-backups.js?v=4-yoga-same-site']) {
    assert.ok(shell.includes(asset));
  }
});
