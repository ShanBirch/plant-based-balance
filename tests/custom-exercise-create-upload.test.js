const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboardHtml = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const workoutScript = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const savedWorkoutsScript = fs.readFileSync(path.join(root, 'js/dashboard/pbb-deferred-savedworkouts.js'), 'utf8');
const workoutBuilderScript = fs.readFileSync(path.join(root, 'js/dashboard/pbb-deferred-workoutbuilder.js'), 'utf8');
const supabaseHelpers = fs.readFileSync(path.join(root, 'lib/supabase.js'), 'utf8');
const awardPoints = fs.readFileSync(path.join(root, 'netlify/edge-functions/award-points.ts'), 'utf8');
const pointsConfig = fs.readFileSync(path.join(root, 'lib/points-config.js'), 'utf8');
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
  /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=126/,
  'dashboard should bump script 5 so phones fetch the custom exercise camera fix'
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
  /Video upload failed[\s\S]*The exercise was not saved yet[\s\S]*return;/,
  'saving should stop when a selected video fails to upload'
);
assert.match(
  workoutScript,
  /Please stop recording before saving the exercise/,
  'saving should be blocked while a recording is still active'
);
assert.match(
  workoutScript,
  /awardCustomExerciseContributionXp\(user\.id,\s*saved\.id\)/,
  'saving a video-backed custom exercise should award contribution XP'
);
assert.match(
  workoutScript,
  /isPublic:\s*!!videoUrl/,
  'video-backed exercises should be saved for the shared library'
);

assert.match(
  supabaseHelpers,
  /contentType:\s*mimeType/,
  'exercise video uploads should send an explicit content type to Supabase storage'
);
assert.match(
  supabaseHelpers,
  /safeExerciseId/,
  'exercise video upload paths should sanitize the exercise ID'
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
