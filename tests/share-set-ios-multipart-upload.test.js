const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const stories = read('lib/stories.js');
const edge = read('netlify/edge-functions/story-media-multipart.js');
const netlify = read('netlify.toml');
const dashboard = read('dashboard.html');

assert.match(stories, /function shouldUseMultipartFeedUpload\(file, source\)[\s\S]*?isIosNativeFeedUpload\(\)[\s\S]*?size > 5 \* 1024 \* 1024/);
assert.match(stories, /for \(let attempt = 1; attempt <= 3 && !uploaded; attempt \+= 1\)/);
assert.match(stories, /crypto\.subtle\.digest\('SHA-1'/);
assert.match(stories, /'X-Bz-Part-Number': partNumber/);
assert.match(stories, /'X-Bz-Content-Sha1': partSha1/);
assert.match(stories, /partSha1Array/);
assert.match(stories, /multipartUpload: true/);
assert.match(stories, /\? 'multipart_b2'/);

assert.match(edge, /MULTIPART_PART_BYTES = 8 \* 1024 \* 1024/);
assert.match(edge, /crypto\.subtle\.sign\('HMAC'/);
assert.match(edge, /crypto\.subtle\.verify\(/);
assert.match(edge, /b2_start_large_file/);
assert.match(edge, /b2_get_upload_part_url/);
assert.match(edge, /b2_finish_large_file/);
assert.match(edge, /b2_cancel_large_file/);
assert.match(edge, /action === 'start'/);
assert.match(edge, /action === 'refresh'/);
assert.match(edge, /action === 'finish'/);
assert.match(edge, /action === 'cancel'/);
assert.match(edge, /session\.userId !== userId/);

assert.match(netlify, /function = "story-media-multipart"[\s\S]*?path = "\/api\/story-media-multipart"/);
assert.match(dashboard, /lib\/stories\.js\?v=56/);

console.log('Share a Set iOS multipart upload contract ok');
