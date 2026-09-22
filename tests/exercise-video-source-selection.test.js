const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
test('monitored demos prefer same-site playback and retain an independent fallback', () => {
  const window = { location: new URL('https://plantbased-balance.org/dashboard.html') };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/dashboard/pbb-exercise-video-backups.js'), 'utf8'), { window, URL });
  for (const demo of JSON.parse(fs.readFileSync(path.join(root, 'data/exercise-video-backups.json')))) {
    const preferred = window.resolveExerciseVideoSource(demo.primary);
    assert.equal(new URL(preferred).origin, window.location.origin, demo.name);
    assert.equal(window.resolveExerciseVideoSource(preferred), preferred);
    const fallback = window.PBB_EXERCISE_VIDEO_BACKUPS[preferred];
    assert.ok(fallback);
    assert.notEqual(new URL(fallback, window.location).origin, window.location.origin);
    assert.equal(new URL(window.resolveExerciseVideoSource(demo.primary + '#t=0.1')).pathname, new URL(preferred).pathname);
  }
  const unrelated = 'https://example.org/custom.mp4?token=preserve';
  assert.equal(window.resolveExerciseVideoSource(unrelated), unrelated);
});
