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
  'Dumbbell Goblet Squat': 'goblet-squat.mp4',
  'Glute Bridge': 'glute-bridge.mp4',
  'Dead Bug (Iso Hold)': 'dead-bug-iso-hold.mp4',
  'Bodyweight Hip Hinge': 'bodyweight-squat-to-hinge.mp4',
  'Mini Band Side Steps': 'mini-band-side-steps.mp4',
  'Cat Cow': 'cat-cow.mp4',
  "Child's Pose": 'childs-pose.mp4',
  'Yoga - Seated Side Stretch': 'yoga-seated-side-stretch.mp4',
  'Dumbbell Floor Press': 'dumbbell-floor-press.mp4',
  'Dumbbell Single Arm Row': 'dumbbell-single-arm-row.mp4',
  'High Plank': 'high-plank.mp4',
  'Band Pull Apart Slow': 'mini-band-pull-aparts.mp4',
  'Bird Dog': 'bird-dog.mp4',
  'High Side Plank from Knees': 'high-side-plank-from-knees.mp4',
  'Farmer Walk': 'farmer-walk.mp4',
  'Yoga - Butterfly Pose': 'yoga-butterfly-pose.mp4',
  'Yoga - Supine Twist': 'yoga-supine-twist.mp4'
};

test('Arunima workout exercises use same-origin Android-compatible videos', () => {
  for (const [exercise, fileName] of Object.entries(expected)) {
    const expectedUrl = `/assets/exercise-videos/compat/${fileName}`;
    assert.equal(context.__exerciseVideos[exercise], expectedUrl);

    const filePath = path.join(root, expectedUrl.slice(1));
    const bytes = fs.readFileSync(filePath);
    assert.ok(bytes.length > 50_000, `${exercise} video should contain real media`);
    assert.equal(bytes.subarray(4, 8).toString('ascii'), 'ftyp');
  }
});

test('dashboard and service worker request the refreshed Android video catalog', () => {
  const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const versionedCatalog = 'exercise_videos.js?v=20260813-global-phone-video-v1';

  assert.ok(dashboard.includes(versionedCatalog));
  assert.ok(serviceWorker.includes(versionedCatalog));
});
