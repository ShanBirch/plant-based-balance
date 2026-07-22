const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const formcheckSource = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'pbb-deferred-formcheck.js'),
    'utf8'
);
const storiesSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'stories.js'),
    'utf8'
);
const uploadSource = fs.readFileSync(
    path.join(__dirname, '..', 'netlify', 'edge-functions', 'upload-story-media.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(
    path.join(__dirname, '..', 'dashboard.html'),
    'utf8'
);
const androidSource = fs.readFileSync(
    path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'fitgotchi', 'app', 'MainActivity.java'),
    'utf8'
);
const iosSource = fs.readFileSync(
    path.join(__dirname, '..', 'ios', 'App', 'App', 'BalanceVideoCapturePlugin.swift'),
    'utf8'
);

assert.ok(
    formcheckSource.includes('assertWorkoutFeedShareVideoFile') &&
    formcheckSource.includes('hasWorkoutFeedShareImageSignature') &&
    formcheckSource.includes('photo instead of a video') &&
    formcheckSource.includes('await assertWorkoutFeedShareVideoFile(preparedFile)'),
    'Share a Set should inspect recorded/selected files and reject image bytes before posting'
);

assert.ok(
    storiesSource.includes('assertFeedUploadMatchesMediaType') &&
    storiesSource.includes('isFeedUploadImageContentType(uploadContentType)') &&
    storiesSource.includes('assertFeedUploadMatchesMediaType(mediaType, fileToUpload, uploadData)'),
    'feed post creation should reject video posts whose upload response is an image'
);

assert.ok(
    uploadSource.includes('validateWorkoutVideoUpload') &&
    uploadSource.includes('requiresWorkoutVideo(source)') &&
    uploadSource.includes("cleanSource.includes('thumbnail')") &&
    uploadSource.includes("contentType.startsWith('image/')") &&
    uploadSource.includes('hasSupportedVideoSignature(headerBytes)'),
    'upload-story-media should reject Share a Set image uploads at the edge before B2 storage while allowing generated video thumbnails'
);

assert.ok(
    formcheckSource.includes('WORKOUT_FEED_SHARE_VIDEO_TARGET_BYTES = 100 * 1024 * 1024') &&
    formcheckSource.includes('WORKOUT_FEED_SHARE_DIRECT_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024') &&
    !formcheckSource.includes('WORKOUT_FEED_SHARE_QUEUE_VIDEO_TARGET_BYTES') &&
    formcheckSource.includes('WORKOUT_FEED_SHARE_CAMERA_VIDEO_BITS_PER_SECOND = 16000000') &&
    formcheckSource.includes('WORKOUT_FEED_SHARE_UPLOAD_TIMEOUT_MS = 300000'),
    'Share a Set should keep HD quality while allowing enough upload time'
);

const nativeCameraFunctionStart = formcheckSource.indexOf('async function openNativeWorkoutFeedShareCamera()');
const nativeCameraFunctionEnd = formcheckSource.indexOf('    function clearWorkoutFeedSharePendingInput()', nativeCameraFunctionStart);
const nativeCameraFunction = formcheckSource.slice(nativeCameraFunctionStart, nativeCameraFunctionEnd);
assert.ok(
    !nativeCameraFunction.includes('openWorkoutFeedShareInAppCamera') &&
    nativeCameraFunction.includes('captureAndroidWorkoutVideo()') &&
    nativeCameraFunction.includes('captureIosWorkoutVideo()') &&
    nativeCameraFunction.includes('openWorkoutFeedShareCameraFallback()'),
    'Share a Set should prefer the native phone camera before falling back to the temporary in-app recorder'
);

assert.ok(
    formcheckSource.includes('async function openWorkoutFeedShareCameraFallback()') &&
    formcheckSource.includes('if (isIosNativeWorkoutFeedShare())') &&
    formcheckSource.includes("fallbackReason: 'native_camera_plugin_failed'") &&
    formcheckSource.includes('openWorkoutFeedShareInAppCamera({ silentFallback: true })') &&
    formcheckSource.includes('Could not open the camera. Check app permissions or use Photos.') &&
    formcheckSource.includes("input.capture = 'camcorder';") &&
    formcheckSource.includes("video/*;capture=camcorder") &&
    formcheckSource.includes('openWorkoutFeedShareCameraPicker();'),
    'Share a Set should use the phone camera picker on iPhone when its native camera plugin is unavailable'
);

assert.ok(
    formcheckSource.includes('WORKOUT_FEED_SHARE_RECORDING_WIDTH = 1080') &&
    formcheckSource.includes('WORKOUT_FEED_SHARE_RECORDING_HEIGHT = 1920') &&
    formcheckSource.includes('workout-feed-share-camera-canvas') &&
    formcheckSource.includes('canvas.captureStream(WORKOUT_FEED_SHARE_CAMERA_FRAME_RATE)') &&
    formcheckSource.includes('Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight)') &&
    formcheckSource.includes('new MediaRecorder(recordingStream, options)') &&
    !formcheckSource.includes('new MediaRecorder(workoutFeedShareCameraStream, options)') &&
    !formcheckSource.includes('width: { ideal: 1280 }') &&
    !formcheckSource.includes('height: { ideal: 720 }'),
    'Share a Set in-app recording should save a vertical 1080x1920 no-crop canvas stream instead of raw horizontal camera output'
);

assert.ok(
    storiesSource.includes('FEED_VIDEO_UPLOAD_TARGET_BYTES = 100 * 1024 * 1024') &&
    storiesSource.includes('PHONE_VIDEO_PRIMARY_MAX_DIMENSION = 1920') &&
    storiesSource.includes('PHONE_VIDEO_PRIMARY_BITRATE = 16000000') &&
    storiesSource.includes('options.primaryFrameRate || options.frameRate || 30') &&
    storiesSource.includes('frameRate: primaryFrameRate'),
    'feed video preparation should target 1080p/1920px, 30fps, 16Mbps quality before fallback passes'
);

assert.ok(
    androidSource.includes('MediaStore.EXTRA_VIDEO_QUALITY, 1') &&
    iosSource.includes('picker.videoQuality = .typeHigh'),
    'native Share a Set camera capture should request high quality source video'
);

assert.ok(
    !formcheckSource.includes('prepareWorkoutFeedShareQueuedClip') &&
    formcheckSource.includes("showWorkoutFeedShareUploadBanner('Saved for retry', 'queued', { retry: true })"),
    'Share a Set queued uploads should keep the prepared HD clip and avoid blaming reception only'
);

const uploadHelpersSource = uploadSource.slice(0, uploadSource.indexOf('export default'));
const uploadSandbox = { module: { exports: {} } };
vm.runInNewContext(
    `${uploadHelpersSource}\nmodule.exports = { requiresWorkoutVideo, validateWorkoutVideoUpload };`,
    uploadSandbox
);

const { requiresWorkoutVideo, validateWorkoutVideoUpload } = uploadSandbox.module.exports;
const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).buffer;
const mp4Buffer = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]).buffer;

assert.strictEqual(requiresWorkoutVideo('feed_workout_share'), true);
assert.strictEqual(requiresWorkoutVideo('feed_workout_share_thumbnail'), false);
assert.strictEqual(requiresWorkoutVideo('workout_share_photo_overlay'), false);
assert.strictEqual(validateWorkoutVideoUpload({ type: 'image/jpeg' }, jpegBuffer, 'feed_workout_share_thumbnail'), null);
assert.strictEqual(validateWorkoutVideoUpload({ type: 'image/jpeg' }, jpegBuffer, 'workout_share_photo_overlay'), null);
assert.match(
    validateWorkoutVideoUpload({ type: 'image/jpeg' }, jpegBuffer, 'feed_workout_share'),
    /photo instead of a video/
);
assert.strictEqual(validateWorkoutVideoUpload({ type: 'video/mp4' }, mp4Buffer, 'feed_workout_share'), null);

assert.ok(
    dashboardSource.includes('lib/stories.js?v=70') &&
    dashboardSource.includes('pbb-deferred-formcheck.js?v=56'),
    'dashboard should bump feed script versions so patched video validation is fetched'
);

console.log('workout feed share video validation tests passed');
