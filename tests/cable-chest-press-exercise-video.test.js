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

test('cable chest press is the visible canonical exercise name', () => {
  const videos = context.__exerciseVideos;
  assert.ok(Object.keys(videos).includes('Cable Chest Press'));
  assert.ok(!Object.keys(videos).includes('Cable Chest Flys'));
  assert.match(videos['Cable Chest Press'], /cable-chest-flyes\.mp4$/);
});

test('historical cable chest fly workouts keep their video lookup', () => {
  const videos = context.__exerciseVideos;
  assert.equal(videos['Cable Chest Flys'], videos['Cable Chest Press']);
  assert.equal(Object.prototype.propertyIsEnumerable.call(videos, 'Cable Chest Flys'), false);
});
