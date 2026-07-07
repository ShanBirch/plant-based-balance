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
    progressSource.indexOf('openProgressPhotoFilePicker(photoInput, index, restoreCurrentGuide)') <
        progressSource.indexOf("typeof openWorkoutCamera === 'function'"),
    'progress photos should try the file-input camera before the generic workout camera fallback'
);

assert.ok(
    progressSource.includes('input.onchange = handleProgressPhotoSelect') &&
        progressSource.includes('continueProgressPhotoShotFlow(index, file)'),
    'progress photo file input should restore the legacy handler and continue the guided three-shot flow'
);

console.log('progress photo capture tests passed');
