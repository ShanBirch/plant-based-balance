const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const dashboard = read('dashboard.html');
const stories = read('lib/stories.js');
const formCheck = read('js/dashboard/pbb-deferred-formcheck.js');
const uploadStart = read('netlify/edge-functions/create-story-media-upload.js');

assert.match(uploadStart, /MAX_DIRECT_UPLOAD_BYTES\s*=\s*1024\s*\*\s*1024\s*\*\s*1024/);
assert.match(uploadStart, /Keep Share a Set clips under 1 GB/);

assert.match(formCheck, /WORKOUT_FEED_SHARE_DIRECT_UPLOAD_MAX_BYTES\s*=\s*1024\s*\*\s*1024\s*\*\s*1024/);
assert.match(formCheck, /WORKOUT_FEED_SHARE_VIDEO_TARGET_BYTES\s*=\s*100\s*\*\s*1024\s*\*\s*1024/);

assert.match(stories, /options\.primaryMaxDimension/);
assert.match(stories, /options\.fallbackMaxDimension/);
assert.match(stories, /options\.finalMaxDimension/);
assert.match(stories, /options\.primaryVideoBitsPerSecond/);
assert.match(stories, /options\.fallbackVideoBitsPerSecond/);
assert.match(stories, /options\.finalVideoBitsPerSecond/);
assert.match(stories, /options\.primaryLabel/);

assert.match(dashboard, /lib\/stories\.js\?v=52/);
assert.match(dashboard, /pbb-deferred-formcheck\.js\?v=30/);

console.log('Share a Set upload limits ok');
