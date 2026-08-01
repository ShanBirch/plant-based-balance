const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'exercise_videos.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.__exerciseVideos = EXERCISE_VIDEOS;`, context);

const expected = {
  'Supine Hip Axial Rotations': 'supine-hip-axial-rotations.mp4',
  Clamshell: 'clamshell.mp4',
  'Glute Bridge': 'glute-bridge.mp4',
  'Lying Hip Abductions': 'lying-hip-abductions.mp4'
};

test('Easy Hip Reset uses same-origin Android-compatible videos', () => {
  for (const [exercise, fileName] of Object.entries(expected)) {
    const expectedUrl = `/assets/exercise-videos/compat/${fileName}`;
    assert.equal(context.__exerciseVideos[exercise], expectedUrl);

    const filePath = path.join(root, expectedUrl.slice(1));
    const bytes = fs.readFileSync(filePath);
    assert.ok(bytes.length > 100_000, `${exercise} video should contain real media`);
    assert.equal(bytes.subarray(4, 8).toString('ascii'), 'ftyp');
  }
});

test('dashboard and service worker request the refreshed exercise catalog', () => {
  const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const versionedCatalog = 'exercise_videos.js?v=20260801-android-video-compat';

  assert.ok(dashboard.includes(versionedCatalog));
  assert.ok(serviceWorker.includes(versionedCatalog));
});
