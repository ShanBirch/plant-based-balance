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
assert.strictEqual(validateWorkoutVideoUpload({ type: 'image/jpeg' }, jpegBuffer, 'feed_workout_share_thumbnail'), null);
assert.match(
    validateWorkoutVideoUpload({ type: 'image/jpeg' }, jpegBuffer, 'feed_workout_share'),
    /photo instead of a video/
);
assert.strictEqual(validateWorkoutVideoUpload({ type: 'video/mp4' }, mp4Buffer, 'feed_workout_share'), null);

assert.ok(
    dashboardSource.includes('lib/stories.js?v=33') &&
    dashboardSource.includes('pbb-deferred-formcheck.js?v=16'),
    'dashboard should bump feed script versions so patched video validation is fetched'
);

console.log('workout feed share video validation tests passed');
