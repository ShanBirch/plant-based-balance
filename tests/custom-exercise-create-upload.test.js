const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboardHtml = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const workoutScript = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const supabaseHelpers = fs.readFileSync(path.join(root, 'lib/supabase.js'), 'utf8');

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
  workoutScript,
  /modal\.style\.display\s*=\s*'flex'/,
  'openCreateCustomExerciseModal should use the bounded flex overlay'
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
  supabaseHelpers,
  /contentType:\s*mimeType/,
  'exercise video uploads should send an explicit content type to Supabase storage'
);
assert.match(
  supabaseHelpers,
  /safeExerciseId/,
  'exercise video upload paths should sanitize the exercise ID'
);

console.log('custom exercise create/upload tests passed');
