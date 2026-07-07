const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboardHtml = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const workoutScript = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const formCheckScript = fs.readFileSync(path.join(root, 'js/dashboard/pbb-deferred-formcheck.js'), 'utf8');
const savedWorkoutsScript = fs.readFileSync(path.join(root, 'js/dashboard/pbb-deferred-savedworkouts.js'), 'utf8');
const workoutBuilderScript = fs.readFileSync(path.join(root, 'js/dashboard/pbb-deferred-workoutbuilder.js'), 'utf8');
const supabaseHelpers = fs.readFileSync(path.join(root, 'lib/supabase.js'), 'utf8');
const awardPoints = fs.readFileSync(path.join(root, 'netlify/edge-functions/award-points.ts'), 'utf8');
const pointsConfig = fs.readFileSync(path.join(root, 'lib/points-config.js'), 'utf8');
const exerciseVideoUpload = fs.readFileSync(path.join(root, 'netlify/edge-functions/upload-exercise-video.js'), 'utf8');
const netlifyConfig = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const publicExerciseMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20260707013000_public_custom_exercise_videos.sql'), 'utf8');

assert.match(
  dashboardHtml,
  /id="create-custom-exercise-modal"[^>]*z-index:\s*200200/,
  'create exercise modal should sit above workout, install, and guest banners'
);
assert.match(
  dashboardHtml,
  /id="create-custom-exercise-modal"[^>]*height:\s*100dvh/,
  'create exercise modal should be viewport-bounded on mobile'
);
assert.match(
  dashboardHtml,
  /padding-top:\s*calc\(15px \+ env\(safe-area-inset-top,\s*0px\)\)/,
  'create exercise sticky header should respect the mobile safe area'
);
assert.match(
  dashboardHtml,
  /id="custom-exercise-file-input"[^>]*accept="video\/\*,\.mp4,\.mov,\.m4v,\.webm,\.3gp,\.3gpp"/,
  'custom exercise upload input should accept common mobile video file extensions'
);
assert.match(
  dashboardHtml,
  /id="custom-exercise-camera-input"[^>]*accept="video\/\*,\.mp4,\.mov,\.m4v,\.webm,\.3gp,\.3gpp"[^>]*capture="environment"/,
  'custom exercise camera input should open the phone video camera'
);
assert.match(
  dashboardHtml,
  /id="custom-exercise-record-btn"[\s\S]*>\s*Camera\s*<\/button>/,
  'custom exercise primary video action should be labelled Camera'
);
assert.match(
  dashboardHtml,
  /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=131/,
  'dashboard should bump script 5 so phones fetch the custom exercise feed autopost fix'
);
assert.match(
  dashboardHtml,
  /id:\s*'custom-exercise-feed-autopost-v1'[\s\S]*title:\s*'New exercises to Feed'/,
  'custom exercise feed autopost should have a returning-user Feature Drop'
);
assert.match(
  dashboardHtml,
  /title:'New exercises to Feed'[\s\S]*Balance posts it to Feed with the exercise name and simple technique tips/,
  'custom exercise feed autopost should be in the guided feature tour'
);
assert.match(
  dashboardHtml,
  /id="workout-add-exercise-video-btn"[\s\S]*earn \+15 XP/,
  'workout screen should surface the exercise-video contribution action'
);
assert.match(
  dashboardHtml,
  /id="workout-share-set-btn"[\s\S]*First share each day earns \+20 XP/,
  'share a set should keep its existing 20 XP reward copy'
);

assert.match(
  workoutScript,
  /modal\.style\.display\s*=\s*'flex'/,
  'openCreateCustomExerciseModal should use the bounded flex overlay'
);
assert.match(
  workoutScript,
  /function openCustomExerciseVideoCapture\(\)[\s\S]*openWorkoutFeedShareCameraForFile\(\{ target: 'custom-exercise' \}\)/,
  'record video should use the same shared camera path as Share a Set'
);
assert.match(
  workoutScript,
  /window\.handleCustomExerciseCapturedVideoFile = handleCustomExerciseCapturedVideoFile/,
  'shared camera captures should be routable back into the custom exercise flow'
);
assert.match(
  workoutScript,
  /function suspendCustomExerciseCameraModal\(\)[\s\S]*modal\.style\.display = 'none'/,
  'custom exercise modal should hide while the shared camera is open'
);
assert.match(
  workoutScript,
  /function restoreCustomExerciseCameraModal\(state\)[\s\S]*modal\.style\.display = state\.display \|\| 'flex'/,
  'custom exercise modal should restore after shared camera capture or cancel'
);
assert.match(
  workoutScript,
  /function restorePendingCustomExerciseCameraInputModal\(\)[\s\S]*restoreCustomExerciseCameraModal\(state\)/,
  'custom exercise fallback camera input should restore the modal after capture or cancel'
);
assert.match(
  workoutScript,
  /function openCustomExerciseVideoCapture\(\)[\s\S]*suspendCustomExerciseCameraModal\(\)[\s\S]*cameraInput\.click\(\)/,
  'custom exercise fallback camera input should hide the modal before opening the camera'
);
assert.match(
  workoutScript,
  /function handleCustomExerciseFileSelect\(event\)[\s\S]*restorePendingCustomExerciseCameraInputModal\(\)[\s\S]*applyCustomExerciseVideoFile\(file, event\.target\)/,
  'custom exercise camera input should pop the modal back up before applying the captured video'
);
assert.match(
  formCheckScript,
  /function handleWorkoutFeedShareInAppRecorderStop\(\)[\s\S]*closeWorkoutFeedShareInAppCamera\(false\);\s*routeWorkoutFeedShareCapturedFile\(file\);/,
  'shared in-app recorder should route custom exercise captures back to Add Exercise instead of posting to Feed'
);
assert.match(
  workoutScript,
  /document\.getElementById\('custom-exercise-record-btn'\)\.innerHTML = `[\s\S]*Camera[\s\S]*`;/,
  'custom exercise record button resets should keep the Camera label'
);
assert.match(
  workoutScript,
  /function ensureWorkoutAddExerciseVideoButton\(\)[\s\S]*workout-share-set-btn[\s\S]*createWorkoutAddExerciseVideoButton/,
  'active workout routes should be able to insert the contribution button under Share a Set'
);
assert.match(
  savedWorkoutsScript,
  /ensureWorkoutAddExerciseVideoButton\(\)/,
  'saved workout starts should insert the contribution button under Share a Set'
);
assert.match(
  workoutBuilderScript,
  /ensureWorkoutAddExerciseVideoButton\(\)/,
  'custom builder workout starts should insert the contribution button under Share a Set'
);
assert.match(
  workoutScript,
  /allowedVideoExts\s*=\s*\['mp4',\s*'mov',\s*'m4v',\s*'webm',\s*'3gp',\s*'3gpp'\]/,
  'file selection should allow common video extensions when MIME type is missing'
);
assert.match(
  workoutScript,
  /const pendingVideoFile = _customExerciseVideoFile[\s\S]*const saved = await dbHelpers\.customExercises\.create\(user\.id, exerciseData\)[\s\S]*queuePendingVideoUpload = \(\) =>/,
  'saving should create the exercise first and queue the video upload separately'
);
assert.match(
  workoutScript,
  /function queueCustomExerciseVideoBackgroundUpload\(user, savedExercise, videoFile, exerciseName\)[\s\S]*setTimeout\(\(\) =>[\s\S]*uploadCustomExerciseVideoInBackground\(user, savedExercise, videoFile, exerciseName\)/,
  'video upload should start after native prompts close so mobile webviews do not pause the request'
);
assert.match(
  workoutScript,
  /Video is uploading\.[\s\S]*Add it to your current workout now\?/,
  'workout context should let users add the exercise while the video uploads'
);
assert.match(
  workoutScript,
  /createExerciseVideoUploadPlaceholderHtml\(\)[\s\S]*Uploading video\.\.\.[\s\S]*You can keep logging your workout\./,
  'new workout exercise cards should show a black uploading placeholder while B2 finishes'
);
assert.match(
  workoutScript,
  /const videoUploading = !!exercise\.videoUploading[\s\S]*const videoUrl = videoUploading \? '' : findVideoMatch\(exercise\.name\)/,
  'pending custom exercise uploads should show the placeholder instead of fuzzy-matching an older exercise video'
);
assert.match(
  workoutScript,
  /Please stop recording before saving the exercise/,
  'saving should be blocked while a recording is still active'
);
assert.match(
  workoutScript,
  /const updated = await dbHelpers\.customExercises\.update\(user\.id, savedExercise\.id,[\s\S]*is_public:\s*true/,
  'background upload should patch the exercise public after B2 returns a URL'
);
assert.match(
  workoutScript,
  /await awardCustomExerciseContributionXp\(user\.id, savedExercise\.id\)/,
  'video-backed custom exercise should award contribution XP after the background upload completes'
);
assert.match(
  workoutScript,
  /function buildCustomExerciseFeedCaption\(exerciseName, savedExercise\)[\s\S]*New exercise added - \$\{safeName\}/,
  'custom exercise uploads should build a Feed caption with the exercise name'
);
assert.match(
  workoutScript,
  /function hasSpecificExerciseTechniqueData\(exerciseName\)[\s\S]*technique\.family !== 'Whole-body lift'/,
  'custom exercise Feed captions should only add technique tips for recognised exercise families'
);
assert.match(
  workoutScript,
  /const feedStory = await createCustomExerciseFeedPost\(user, updated \|\| savedExercise, videoUrl\)/,
  'background exercise video uploads should create a Feed post after the public video URL is saved'
);
assert.match(
  workoutScript,
  /\.from\('stories'\)[\s\S]*\.eq\('media_url', videoUrl\)[\s\S]*\.maybeSingle\(\)/,
  'custom exercise Feed autopost should avoid duplicates by checking the uploaded video URL'
);
assert.match(
  workoutScript,
  /dbHelpers\.stories\.create\(user\.id, \{[\s\S]*media_type:\s*'video'[\s\S]*media_url:\s*videoUrl[\s\S]*thumbnail_url:\s*null[\s\S]*caption/,
  'custom exercise Feed autopost should use the uploaded video as a normal video feed item without a fake thumbnail'
);
assert.match(
  workoutScript,
  /loadPhotoFeed\('friends-photo-feed', 'friends-feed-empty'\)/,
  'custom exercise Feed autopost should refresh the Feed when available'
);

assert.match(
  supabaseHelpers,
  /fetch\('\/api\/upload-exercise-video'[\s\S]*body:\s*formData/,
  'exercise video uploads should go through the exercise upload API, not Feed'
);
assert.match(
  supabaseHelpers,
  /safeExerciseId/,
  'exercise video upload paths should sanitize the exercise ID'
);
assert.match(
  exerciseVideoUpload,
  /const fileName = `exercises\/\$\{userId\}\/\$\{exerciseId\}\.\$\{getVideoExtension\(file\)\}`/,
  'exercise videos should be stored under the shared B2 exercises prefix'
);
assert.match(
  exerciseVideoUpload,
  /publicUrl = `\$\{authData\.downloadUrl\}\/file\/\$\{B2_BUCKET_NAME\}\/\$\{fileName\}`/,
  'exercise video upload setup should return a public Backblaze URL'
);
assert.match(
  netlifyConfig,
  /function = "upload-exercise-video"[\s\S]*path = "\/api\/upload-exercise-video"/,
  'exercise video B2 upload endpoint should be mapped in Netlify'
);
assert.match(
  supabaseHelpers,
  /\.or\(`user_id\.eq\.\$\{userId\},is_public\.eq\.true`\)/,
  'custom exercise lookups should include public shared exercises'
);
assert.match(
  supabaseHelpers,
  /async getMine\(userId\)/,
  'custom exercise helpers should still support loading only the current user creations'
);
assert.match(
  pointsConfig,
  /POINTS_PER_EXERCISE_CONTRIBUTION:\s*15\b/,
  'points config should define 15 XP for exercise contributions'
);
assert.match(
  awardPoints,
  /POINTS_PER_EXERCISE_CONTRIBUTION:\s*15\b/,
  'award-points should define 15 XP for exercise contributions'
);
assert.match(
  awardPoints,
  /exercise_contribution/,
  'award-points should accept the exercise_contribution event'
);
assert.match(
  awardPoints,
  /earn_exercise_contribution/,
  'exercise contribution XP should use its own transaction type'
);
assert.match(
  publicExerciseMigration,
  /add column if not exists is_public boolean not null default false/,
  'migration should add public sharing flag to custom exercises'
);
assert.match(
  publicExerciseMigration,
  /create policy "Users can view public custom exercises"/,
  'migration should allow authenticated users to read public custom exercises'
);

console.log('custom exercise create/upload tests passed');
