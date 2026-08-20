const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const captureScript = fs.readFileSync(
  path.join(root, 'js/dashboard/pbb-deferred-formcheck.js'),
  'utf8'
);
const exerciseScript = fs.readFileSync(
  path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
  'utf8'
);
const iosPlugin = fs.readFileSync(
  path.join(root, 'ios/App/App/BalanceVideoCapturePlugin.swift'),
  'utf8'
);
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('iPhone custom exercise capture and gallery preserve a native file path', () => {
  assert.match(
    captureScript,
    /includeDataBase64:\s*workoutFeedShareCaptureTarget !== 'custom-exercise'/
  );
  assert.match(
    captureScript,
    /iosVideoPlugin[\s\S]*pickWorkoutVideo[\s\S]*openNativeWorkoutFeedShareGallery/
  );
  assert.match(iosPlugin, /CAPPluginMethod\(name: "pickWorkoutVideo"/);
  assert.match(iosPlugin, /"nativePath": destination\.path/);
  assert.match(iosPlugin, /UIDocumentPickerViewController\(forOpeningContentTypes: \[\.movie\], asCopy: true\)/);
});

test('iPhone custom exercise videos upload from disk outside the WebView', () => {
  assert.match(
    exerciseScript,
    /getIosCustomExerciseVideoUploadPlugin[\s\S]*enqueueExerciseVideoUpload[\s\S]*sourcePath: videoFile\._balanceNativeVideoPath/
  );
  assert.match(
    exerciseScript,
    /getExerciseVideoUploadStatus\(\{ exerciseId \}\)/
  );
  assert.match(iosPlugin, /URLSession\.shared\.upload\(for: request, fromFile: payload\.sourceURL\)/);
  assert.match(iosPlugin, /\/api\/create-exercise-video-upload/);
  assert.match(iosPlugin, /\/api\/finalize-exercise-video-upload/);
  assert.match(iosPlugin, /\/api\/custom-exercise-review/);
});

test('iPhone upload bridge is requested through a fresh production asset revision', () => {
  assert.match(dashboard, /pbb-deferred-formcheck\.js\?v=58-ios-exercise-video-upload/);
  assert.match(serviceWorker, /pbb-deferred-formcheck\.js\?v=58-ios-exercise-video-upload/);
});
