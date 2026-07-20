const assert = require('assert');
const fs = require('fs');
const path = require('path');

const progressSource = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'pbb-deferred-progressphoto.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(
    path.join(__dirname, '..', 'dashboard.html'),
    'utf8'
);

assert.ok(
    dashboardSource.includes('id="progress-photo-input" accept="image/*" capture="environment"'),
    'progress photos should have a dedicated camera file input'
);

assert.ok(
    progressSource.includes('function openProgressPhotoFilePicker(input, index, restoreCurrentGuide)'),
    'progress photo capture should use its dedicated file input helper'
);

assert.ok(
    progressSource.includes("typeof openWorkoutCamera === 'function' && navigator.mediaDevices?.getUserMedia") &&
        progressSource.includes('forceWebCamera: true') &&
        progressSource.includes('defaultTimerSeconds: 10'),
    'progress photos should use the in-WebView timed camera without handing off to the native workout camera'
);

assert.ok(
    progressSource.indexOf("typeof openWorkoutCamera === 'function' && navigator.mediaDevices?.getUserMedia") <
        progressSource.indexOf('openProgressPhotoFilePicker(photoInput, index, restoreCurrentGuide)'),
    'progress photos should keep the dedicated file input as the fallback when the timed WebView camera is unavailable'
);

assert.ok(
    progressSource.includes('input.onchange = handleProgressPhotoSelect') &&
        progressSource.includes('renderProgressPhotoShotReview(index, file)'),
    'progress photo file input should restore the legacy handler and open the review step'
);

assert.ok(
    progressSource.includes('function renderProgressPhotoShotReview(index, file)') &&
        progressSource.includes('id="progress-photo-review-retake"') &&
        progressSource.includes('id="progress-photo-review-accept"'),
    'each captured progress photo should show preview controls to retake or accept it'
);

assert.ok(
    /revokeProgressPhotoReviewUrl\(\);\s+captureProgressPhotoShot\(index\);/.test(progressSource) &&
        /revokeProgressPhotoReviewUrl\(\);\s+continueProgressPhotoShotFlow\(index, file\);/.test(progressSource),
    'retake should reopen the current angle while accept should continue the three-shot flow'
);

assert.ok(
    dashboardSource.includes("id: 'weekly-progress-photo-review-v1'") &&
        dashboardSource.includes('choose Use photo or Retake before moving to the next angle'),
    'the photo review change should be announced in the feature reveal'
);

console.log('progress photo capture tests passed');
