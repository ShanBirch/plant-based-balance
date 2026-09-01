const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const script = fs.readFileSync(
  path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
  'utf8'
);
const androidBuild = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const mainActivity = fs.readFileSync(
  path.join(root, 'android/app/src/main/java/com/fitgotchi/app/MainActivity.java'),
  'utf8'
);
const uploadWorker = fs.readFileSync(
  path.join(root, 'android/app/src/main/java/com/fitgotchi/app/ExerciseVideoUploadWorker.java'),
  'utf8'
);

test('native exercise videos avoid WebView decoding and release playback resources', () => {
  assert.match(dashboard, /id="custom-exercise-video-native-placeholder"/);
  assert.match(
    script,
    /function setCustomExercisePreviewUrl\(source\)[\s\S]*source\._balanceNativePreviewUrl[\s\S]*videoPlayback\.style\.display = 'none'[\s\S]*placeholder\.style\.display = 'flex'[\s\S]*return;/
  );
  assert.match(
    script,
    /function clearCustomExercisePreviewPlayback\(\)[\s\S]*videoPlayback\.pause\(\)[\s\S]*videoPlayback\.removeAttribute\('src'\)[\s\S]*videoPlayback\.load\(\)/
  );
});

test('new and retried native videos are durably handed off before modal close', () => {
  assert.match(
    script,
    /const videoTarget = _customExerciseVideoTarget[\s\S]*videoFile\._balanceNativeVideoPath[\s\S]*await uploadCustomExerciseVideoInBackground\(user, videoTarget, videoFile, targetName\)[\s\S]*closeCreateCustomExerciseModal\(\)/
  );
  assert.match(
    script,
    /const saved = await dbHelpers\.customExercises\.create\(user\.id, exerciseData\)[\s\S]*pendingVideoFile\._balanceNativeVideoPath[\s\S]*await uploadCustomExerciseVideoInBackground\(user, saved, pendingVideoFile, name\)[\s\S]*window\._customExercisesCache\.unshift\(saved\)/
  );
});

test('dashboard requests the version-gated native bridge revision', () => {
  assert.match(
    dashboard,
    /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=225-calendar-home-coins&video_health=2/
  );
  assert.match(
    script,
    /getExerciseVideoUploadBridgeVersion[\s\S]*bridgeVersion < 2[\s\S]*Update Balance before retrying this video[\s\S]*enqueueExerciseVideoUpload/
  );
});

test('Android bridge uses the current WorkManager runtime and explicit data-sync type', () => {
  assert.match(androidBuild, /versionCode = \(System\.getenv\("ANDROID_VERSION_CODE"\) \?: "9"\)/);
  assert.match(androidBuild, /androidx\.work:work-runtime:2\.11\.2/);
  assert.match(mainActivity, /getExerciseVideoUploadBridgeVersion\(\)[\s\S]*return 2;/);
  assert.match(uploadWorker, /ServiceInfo\.FOREGROUND_SERVICE_TYPE_DATA_SYNC/);
});
