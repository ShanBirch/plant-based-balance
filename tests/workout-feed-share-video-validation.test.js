const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
    uploadSource.includes("contentType.startsWith('image/')") &&
    uploadSource.includes('hasSupportedVideoSignature(headerBytes)'),
    'upload-story-media should reject Share a Set image uploads at the edge before B2 storage'
);

assert.ok(
    dashboardSource.includes('lib/stories.js?v=29') &&
    dashboardSource.includes('pbb-deferred-formcheck.js?v=15'),
    'dashboard should bump feed script versions so patched video validation is fetched'
);

console.log('workout feed share video validation tests passed');
