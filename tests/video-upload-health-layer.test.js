const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const dashboard = read('dashboard.html');
const stories = read('lib/stories.js');
const formCheck = read('js/dashboard/pbb-deferred-formcheck.js');
const customExercise = read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
const iosPlugin = read('ios/App/App/BalanceVideoCapturePlugin.swift');

assert.match(dashboard, /openFeedComposerMediaSource\('library-video'\)[\s\S]*Video library/);
assert.match(dashboard, /id="feed-composer-video-input"[^>]*accept="video\/\*,\.mp4,\.mov,\.m4v,\.webm,\.3gp,\.3gpp"/);
assert.match(dashboard, /lib\/stories\.js\?v=76-feed-composer-profile-photo&video_health=2/);
assert.match(dashboard, /pbb-deferred-formcheck\.js\?v=58-ios-exercise-video-upload&video_health=2/);

assert.match(stories, /FEED_UPLOAD_DIAGNOSTIC_SCHEMA_VERSION = 2/);
assert.match(stories, /window\.getBalanceVideoUploadSupportCode = getFeedUploadSupportCode/);
assert.match(stories, /window\.uploadBalanceVideoToBackblaze = function/);
assert.match(stories, /raw\.includes\('feed_composer'\)/);
assert.match(stories, /normalizedSource\.includes\('form_check'\)[\s\S]*normalizedSource\.includes\('feed_composer'\)/);
assert.match(stories, /preserveOriginalVideo = options\.skipVideoPreparation === true \|\| isNativeVideo/);
assert.match(stories, /skipIosQuickTimeThumbnail = mediaType === 'video' && isIosNativeFeedUpload\(\)/);
assert.match(stories, /feed_composer_submit_failed[\s\S]*supportCode/);
assert.match(stories, /handleFeedComposerNativeVideoFile/);

assert.match(formCheck, /openWorkoutFeedShareGalleryForFile[\s\S]*iosVideoPlugin[\s\S]*pickWorkoutVideo/);
assert.match(formCheck, /workoutFeedShareCaptureTarget === 'feed-composer'[\s\S]*handleFeedComposerNativeVideoFile/);
assert.match(formCheck, /uploadBalanceVideoToBackblaze\(file,[\s\S]*source: 'feed_form_check'/);
assert.match(formCheck, /function logWorkoutFeedShareDiagnostic[\s\S]*supportCode/);
assert.match(formCheck, /window\.getBalanceVideoUploadAttemptContext/);

assert.match(customExercise, /getBalanceVideoUploadAttemptContext/);
assert.match(customExercise, /custom_exercise_native_upload_complete/);
assert.match(customExercise, /custom_exercise_native_upload_failed/);
assert.match(customExercise, /video upload failed\.\$\{supportCode \? ` Code \$\{supportCode\}\.\` : ''\}/i);

assert.match(iosPlugin, /maxInlineVideoBytes: Int64 = 24 \* 1024 \* 1024/);
assert.match(iosPlugin, /deliveryMode"\] = "native_file"/);

console.log('video upload health layer tests passed');
