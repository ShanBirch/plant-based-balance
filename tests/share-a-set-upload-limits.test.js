const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const dashboard = read('dashboard.html');
const stories = read('lib/stories.js');
const formCheck = read('js/dashboard/pbb-deferred-formcheck.js');
const uploadStart = read('netlify/edge-functions/create-story-media-upload.js');
const androidBuild = read('android/app/build.gradle');
const capacitorConfig = read('capacitor.config.ts');

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
assert.match(dashboard, /pbb-deferred-formcheck\.js\?v=41/);
assert.match(dashboard, /choose Camera to use your phone camera/);

assert.match(formCheck, /function openWorkoutFeedShareCameraPicker\(\)\s*{\s*openWorkoutFeedShareFilePicker\(\{ capture: true \}\);/);
assert.match(formCheck, /function isWorkoutFeedShareNativePlatform\(\)\s*{\s*return !!\(window\.Capacitor && typeof window\.Capacitor\.isNativePlatform === 'function' && window\.Capacitor\.isNativePlatform\(\)\);/);
assert.match(formCheck, /if \(!isWorkoutFeedShareNativePlatform\(\)\) return null;/);
assert.match(formCheck, /input\.accept = options\.capture \? 'video\/\*;capture=camcorder' : 'video\/\*';/);
assert.match(formCheck, /input\.capture = 'camcorder';[\s\S]*?input\.setAttribute\('capture', 'camcorder'\);/);
assert.match(formCheck, /function openWorkoutFeedShareCapture\(\)\s*{\s*if \(hasNativeWorkoutFeedShareVideoCamera\(\)\) {[\s\S]*?void openNativeWorkoutFeedShareCamera\(\);[\s\S]*?return;[\s\S]*?}\s*if \(isWorkoutFeedShareNativePlatform\(\)\) {[\s\S]*?void openWorkoutFeedShareInAppCamera\(\);[\s\S]*?return;[\s\S]*?}\s*openWorkoutFeedShareCameraPicker\(\);/);
assert.match(formCheck, /async function openWorkoutFeedShareCameraFallback\(\)\s*{\s*if \(isWorkoutFeedShareNativePlatform\(\)\) {[\s\S]*?const opened = await openWorkoutFeedShareInAppCamera\(\{ silentFallback: true \}\);[\s\S]*?Could not open the camera\. Check app permissions or use Photos\.[\s\S]*?return;[\s\S]*?}\s*openWorkoutFeedShareCameraPicker\(\);/);
assert.match(formCheck, /#workout-feed-share-camera-video[\s\S]*?object-fit: contain;/);

assert.match(androidBuild, /versionCode = \(System\.getenv\("ANDROID_VERSION_CODE"\) \?: "8"\)\.toInteger\(\)/);
assert.match(androidBuild, /versionName = System\.getenv\("ANDROID_VERSION_NAME"\) \?: "1\.6"/);
assert.match(capacitorConfig, /native_rev=share_set_video_bridge_v1/);

console.log('Share a Set upload limits ok');
