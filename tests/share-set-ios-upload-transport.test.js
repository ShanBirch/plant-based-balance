const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const stories = fs.readFileSync(path.join(root, 'lib', 'stories.js'), 'utf8');

assert.match(stories, /function shouldUseXhrForDirectFeedUpload\(\)/);
assert.match(stories, /function uploadB2FileViaXhr\(uploadUrl, headers, file, options = \{\}\)/);
assert.match(stories, /FitGotchi-Native/i);
assert.match(stories, /\(iPhone\|iPad\|iPod\)/);
assert.match(stories, /return isAndroidWebView \|\| isIosNativeApp/);
assert.match(stories, /share_set_direct_upload_xhr_start/);
assert.match(stories, /share_set_direct_upload_fetch_error/);
assert.match(stories, /function isIosNativeFeedUpload\(\)/);
assert.match(stories, /function shouldUseMultipartFeedUpload\(file, source\)/);
assert.match(stories, /\/api\/story-media-multipart/);
assert.match(stories, /'X-Bz-Part-Number': partNumber/);
assert.match(stories, /share_set_multipart_success/);

const multipartDispatch = stories.indexOf('if (shouldUseMultipartFeedUpload(file, source))');
const directDispatch = stories.indexOf('if (file.size > FEED_MEDIA_UPLOAD_REQUEST_SAFE_BYTES)', multipartDispatch);
assert.ok(multipartDispatch >= 0 && directDispatch > multipartDispatch, 'iPhone multipart upload should take priority');

const helperStart = stories.indexOf('function shouldUseXhrForDirectFeedUpload()');
const helperEnd = stories.indexOf('function createFeedUploadAbortError()', helperStart);
const helperBlock = stories.slice(helperStart, helperEnd);
assert.match(helperBlock, /const isNativeApp = \/FitGotchi-Native\/i\.test\(ua\)/);
assert.match(helperBlock, /const isIosNativeApp = \/\(iPhone\|iPad\|iPod\)\/i\.test\(ua\) && isNativeApp/);

console.log('Share a Set iOS upload transport contract ok');
