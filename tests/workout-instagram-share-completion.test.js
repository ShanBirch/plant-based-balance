const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);

assert.match(source, /let workoutInstagramShareCompleted = \{ story: false \}/);
assert.match(source, /pbb_workout_instagram_share:\$\{window\.currentUser\.id\}:\$\{getCompletedWorkoutSocialShareReferenceId\(\)\}/);
assert.match(source, /onSharePrepared:\s*\(\) => markWorkoutInstagramShareCompleted\(\)/);
assert.match(source, /if \(btn && !workoutInstagramShareCompleted\.story\)/);
assert.match(source, /loadWorkoutInstagramShareCompleted\(\)[\s\S]*renderWorkoutInstagramShareButton\(\)/);
assert.match(source, /shareBalanceCardToInstagram\(cardPayload, 'story'/);
assert.match(source, /Workout shared to Instagram Story! \+15 XP/);
assert.match(source, /IG Story shared/);
assert.doesNotMatch(source, /share-workout-ig-feed-btn/);

console.log('Workout Instagram share completion state contract ok');
