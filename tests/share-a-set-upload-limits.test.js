const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const dashboard = read('dashboard.html');
const stories = read('lib/stories.js');
const formCheck = read('js/dashboard/pbb-deferred-formcheck.js');
const uploadStart = read('netlify/edge-functions/create-story-media-upload.js');
const multipartUpload = read('netlify/edge-functions/story-media-multipart.js');
const androidBuild = read('android/app/build.gradle');
const capacitorConfig = read('capacitor.config.ts');

assert.match(uploadStart, /MAX_DIRECT_UPLOAD_BYTES\s*=\s*1024\s*\*\s*1024\s*\*\s*1024/);
assert.match(uploadStart, /Keep Share a Set clips under 1 GB/);
assert.match(multipartUpload, /MAX_MULTIPART_UPLOAD_BYTES\s*=\s*1024\s*\*\s*1024\s*\*\s*1024/);
assert.match(multipartUpload, /MIN_MULTIPART_UPLOAD_BYTES\s*=\s*5\s*\*\s*1024\s*\*\s*1024\s*\+\s*1/);
assert.match(multipartUpload, /size <= MULTIPART_PART_BYTES[\s\S]*?5 \* 1024 \* 1024[\s\S]*?: MULTIPART_PART_BYTES/);

assert.match(formCheck, /WORKOUT_FEED_SHARE_DIRECT_UPLOAD_MAX_BYTES\s*=\s*1024\s*\*\s*1024\s*\*\s*1024/);
assert.match(formCheck, /WORKOUT_FEED_SHARE_VIDEO_TARGET_BYTES\s*=\s*100\s*\*\s*1024\s*\*\s*1024/);

assert.match(stories, /options\.primaryMaxDimension/);
assert.match(stories, /options\.fallbackMaxDimension/);
assert.match(stories, /options\.finalMaxDimension/);
assert.match(stories, /options\.primaryVideoBitsPerSecond/);
assert.match(stories, /options\.fallbackVideoBitsPerSecond/);
assert.match(stories, /options\.finalVideoBitsPerSecond/);
assert.match(stories, /options\.primaryLabel/);

assert.match(dashboard, /lib\/stories\.js\?v=63/);
assert.match(dashboard, /pbb-deferred-formcheck\.js\?v=51/);
assert.match(dashboard, /choose Camera to use your phone camera/);

assert.match(formCheck, /function openWorkoutFeedShareCameraPicker\(\)\s*{\s*openWorkoutFeedShareFilePicker\(\{ capture: true \}\);/);
assert.match(formCheck, /function isWorkoutFeedShareNativePlatform\(\)\s*{\s*return !!\(window\.Capacitor && typeof window\.Capacitor\.isNativePlatform === 'function' && window\.Capacitor\.isNativePlatform\(\)\);/);
assert.match(formCheck, /if \(!isWorkoutFeedShareNativePlatform\(\)\) return null;/);
assert.match(formCheck, /input\.accept = options\.capture \? 'video\/\*;capture=camcorder' : 'video\/\*';/);
assert.match(formCheck, /input\.capture = 'camcorder';[\s\S]*?input\.setAttribute\('capture', 'camcorder'\);/);
assert.ok(
    formCheck.includes("if (isIosNativeWorkoutFeedShare())") &&
    formCheck.includes("fallbackReason: 'native_camera_plugin_unavailable'") &&
    formCheck.includes('openWorkoutFeedShareCameraAfterSurfaceSettles(openWorkoutFeedShareCameraPicker)') &&
    formCheck.includes('void openWorkoutFeedShareInAppCamera();'),
    'iPhone should use the system camera picker when its native camera plugin is unavailable'
);
assert.match(formCheck, /function waitForWorkoutFeedShareHiddenSurfacePaint\(\)[\s\S]*requestAnimationFrame[\s\S]*requestAnimationFrame/);
assert.match(formCheck, /function openWorkoutFeedShareCameraForFile\(options = \{\}\)[\s\S]*suspendWorkoutFeedShareCaptureSurface\(\)[\s\S]*openWorkoutFeedShareCameraAfterSurfaceSettles\(openNativeWorkoutFeedShareCamera\)/);
assert.match(formCheck, /function openFormCheckCapture\(\)\s*{\s*openWorkoutFeedShareCameraForFile\(\{ target: 'form-check' \}\);/);
assert.match(formCheck, /async function materializeWorkoutFeedShareFile\(file, stage\)/);
assert.match(formCheck, /await materializeWorkoutFeedShareFile\(rawFile, 'gallery_picker'\)/);
assert.match(formCheck, /routeWorkoutFeedShareCapturedFile\(stableFile\)/);
assert.match(formCheck, /function routeWorkoutFeedShareCapturedFile\(file\)[\s\S]*void processWorkoutFeedShareSelectedFile\(file\);/);
assert.match(formCheck, /async function openWorkoutFeedShareCameraFallback\(\)[\s\S]*?if \(isIosNativeWorkoutFeedShare\(\)\) {[\s\S]*?video_ios_system_camera_picker[\s\S]*?openWorkoutFeedShareCameraPicker\(\);[\s\S]*?return;[\s\S]*?}\s*if \(isWorkoutFeedShareNativePlatform\(\)\) {[\s\S]*?openWorkoutFeedShareInAppCamera\(\{ silentFallback: true \}\)/);
assert.match(formCheck, /#workout-feed-share-camera-video[\s\S]*?object-fit: contain;/);

assert.match(androidBuild, /versionCode = \(System\.getenv\("ANDROID_VERSION_CODE"\) \?: "8"\)\.toInteger\(\)/);
assert.match(androidBuild, /versionName = System\.getenv\("ANDROID_VERSION_NAME"\) \?: "1\.6"/);
assert.match(capacitorConfig, /native_rev=share_set_video_bridge_v1/);

console.log('Share a Set upload limits ok');
