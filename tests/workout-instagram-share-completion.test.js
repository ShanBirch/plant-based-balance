const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);

assert.match(source, /let workoutInstagramShareCompleted = \{ story: false, feed: false \}/);
assert.match(source, /pbb_workout_instagram_share:\$\{window\.currentUser\.id\}:\$\{getCompletedWorkoutSocialShareReferenceId\(\)\}/);
assert.match(source, /if \(opened\) markWorkoutInstagramShareCompleted\(safeTarget\)/);
assert.match(source, /if \(btn && !workoutInstagramShareCompleted\[safeTarget\]\)/);
assert.match(source, /loadWorkoutInstagramShareCompleted\(\)[\s\S]*renderWorkoutInstagramShareButton\('story'\)[\s\S]*renderWorkoutInstagramShareButton\('feed'\)/);
assert.match(source, /Instagram shared/);

console.log('Workout Instagram share completion state contract ok');
