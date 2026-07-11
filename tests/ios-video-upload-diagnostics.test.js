const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const dashboard = read('dashboard.html');
const stories = read('lib/stories.js');
const formCheck = read('js/dashboard/pbb-deferred-formcheck.js');
const customExercise = read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
const supabase = read('lib/supabase.js');

assert.match(stories, /pageSessionId: FEED_UPLOAD_DIAGNOSTIC_PAGE_SESSION_ID/);
assert.match(stories, /capacitorPlatform,[\s\S]*nativeRevision:/);
assert.match(stories, /raw\.includes\('form_check'\)[\s\S]*raw\.includes\('custom_exercise'\)/);
assert.match(stories, /window\.logBalanceVideoUploadDiagnostic = logFeedUploadDiagnostic/);
assert.match(stories, /skipIosQuickTimeThumbnail/);

for (const eventName of [
    'video_upload_attempt_start',
    'video_native_file_read_start',
    'video_native_file_read_response',
    'video_native_file_read_fetch_failed',
    'video_native_file_read_xhr_start',
    'video_native_file_read_xhr_success',
    'video_native_file_read_xhr_error',
    'video_native_file_inline_data_start',
    'video_native_file_inline_data_ready',
    'video_native_file_validation_bypassed',
    'share_set_native_file_validation_reused',
    'video_native_file_blob_ready',
    'video_ios_system_camera_picker',
    'video_file_materialize_skipped',
    'form_check_upload_request_start',
    'form_check_upload_response',
    'form_check_submit_success',
    'form_check_submit_failed'
]) {
    assert.ok(formCheck.includes(eventName), `missing iPhone video diagnostic event ${eventName}`);
}

assert.match(formCheck, /function openFormCheckGallery\(\)\s*{\s*openWorkoutFeedShareGalleryForFile\(\{ target: 'form-check' \}\);/);
assert.match(formCheck, /await materializeWorkoutFeedShareFile\(rawFile, 'form_check_gallery'\)/);
assert.match(formCheck, /window\.openWorkoutFeedShareGalleryForFile = openWorkoutFeedShareGalleryForFile/);
assert.match(formCheck, /window\.prepareBalanceVideoUploadFile = function \(file, stage, target\)/);
assert.match(formCheck, /async function readWorkoutFeedShareNativeVideoBlob\(source\)/);
assert.match(formCheck, /request\.responseType = 'blob';[\s\S]*request\.status === 0/);
assert.match(formCheck, /function nativeWorkoutVideoBase64ToBlob\(dataBase64, mimeType\)/);
assert.match(formCheck, /includeDataBase64: true/);
assert.match(formCheck, /const hasInlineNativeVideoData = !!result\.dataBase64;/);
assert.match(formCheck, /if \(!hasInlineNativeVideoData\)\s*{\s*await assertWorkoutFeedShareVideoFile\(file\);/);
assert.match(formCheck, /const workoutFeedShareNativeValidatedFiles = typeof WeakSet/);
assert.match(formCheck, /workoutFeedShareNativeValidatedFiles\.has\(file\)/);
assert.match(formCheck, /workoutFeedShareNativeValidatedFiles\.add\(file\)/);
assert.match(read('ios/App/App/BalanceVideoCapturePlugin.swift'), /result\["dataBase64"\] = videoData\.base64EncodedString\(\)/);

for (const eventName of [
    'custom_exercise_gallery_open',
    'custom_exercise_file_picker_result',
    'custom_exercise_file_ready',
    'custom_exercise_background_upload_start',
    'custom_exercise_media_upload_success',
    'custom_exercise_upload_failed'
]) {
    assert.ok(customExercise.includes(eventName), `missing custom exercise video diagnostic event ${eventName}`);
}

assert.match(customExercise, /prepareBalanceVideoUploadFile\(rawFile, 'custom_exercise_picker', 'custom-exercise'\)/);
assert.match(supabase, /custom_exercise_upload_request_start/);
assert.match(supabase, /custom_exercise_upload_network_error/);
assert.match(supabase, /custom_exercise_upload_response/);
assert.match(dashboard, /onclick="openCustomExerciseVideoGallery\(event\)"/);
assert.match(dashboard, /lib\/stories\.js\?v=64/);
assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=138/);
assert.match(dashboard, /pbb-deferred-formcheck\.js\?v=55/);

console.log('iPhone video upload diagnostics contract ok');
