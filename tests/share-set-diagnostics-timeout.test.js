const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const formCheck = fs.readFileSync(path.join(root, 'js', 'dashboard', 'pbb-deferred-formcheck.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

assert.match(formCheck, /WORKOUT_FEED_SHARE_NATIVE_UPLOAD_TIMEOUT_MAX_MS\s*=\s*900000/);
assert.match(formCheck, /WORKOUT_FEED_SHARE_NATIVE_UPLOAD_TIMEOUT_MS_PER_MB\s*=\s*10000/);
assert.match(formCheck, /function getWorkoutFeedShareUploadTimeoutMs\(file\)/);
assert.match(formCheck, /Math\.min\(\s*WORKOUT_FEED_SHARE_NATIVE_UPLOAD_TIMEOUT_MAX_MS/);
assert.match(formCheck, /uploadTimeoutMs = getWorkoutFeedShareUploadTimeoutMs\(uploadFile\)/);
assert.match(formCheck, /const retryUploadTimeoutMs = getWorkoutFeedShareUploadTimeoutMs\(preparedQueuedFile\)/);

[
    'share_set_capture_open',
    'share_set_gallery_open',
    'share_set_file_received',
    'share_set_file_rejected',
    'share_set_file_ready_for_upload',
    'share_set_queue_staged',
    'share_set_queue_stage_failed',
    'share_set_post_attempt',
    'share_set_retry_attempt',
    'share_set_submit_success',
    'share_set_retry_discarded',
    'share_set_native_camera_ios_start',
    'share_set_native_camera_ios_result',
    'share_set_native_file_ready',
    'share_set_file_materialized',
    'share_set_file_materialize_failed'
].forEach(eventName => {
    assert.ok(formCheck.includes(eventName), `missing diagnostic event ${eventName}`);
});

assert.match(formCheck, /async function materializeWorkoutFeedShareFile\(file, stage\)/);
assert.match(formCheck, /await materializeWorkoutFeedShareFile\(rawFile, 'gallery_picker'\)/);
assert.match(formCheck, /await materializeWorkoutFeedShareFile\(queuedFile, 'retry_queue'\)/);
assert.match(dashboard, /lib\/stories\.js\?v=63/);
assert.match(dashboard, /pbb-deferred-formcheck\.js\?v=50/);

console.log('Share a Set diagnostics and timeout contract ok');
