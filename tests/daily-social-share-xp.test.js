const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const edge = fs.readFileSync(path.join(root, 'netlify', 'edge-functions', 'award-points.ts'), 'utf8');
const shareUi = fs.readFileSync(path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

assert.match(edge, /timeZone: 'Australia\/Brisbane'/);
assert.match(edge, /dailyShareSeed = `\$\{shareKind\}:\$\{shareDestination\}:\$\{brisbaneDate\}`/);
assert.match(edge, /crypto\.subtle\.digest\([\s\S]*dailyShareReferenceId/);
assert.match(edge, /p_reference_id: dailyShareReferenceId/);
assert.match(edge, /dailyLimitReached: true/);

assert.match(shareUi, /PB shared to Balance Feed! \+15 XP/);
assert.match(shareUi, /PB shared to Instagram Feed! \+15 XP/);
assert.match(shareUi, /Today\\'s workout Feed XP is already claimed/);
assert.match(shareUi, /Today\\'s workout IG Feed XP is already claimed/);
assert.match(shareUi, /pbbWorkoutSharedToFeedDay_/);
assert.match(shareUi, /timeZone: 'Australia\/Brisbane'/);
assert.match(shareUi, /isWorkoutFeedShareUsedToday\(\) \? 'Balance Feed' : 'Balance Feed \(\+15 XP\)'/);
assert.match(shareUi, /Daily workout share XP is already used/);
assert.match(shareUi, /markWorkoutFeedShareUsedToday\(\)/);
assert.match(shareUi, /getTransactions\(window\.currentUser\.id, 100\)/);
assert.match(shareUi, /transaction\?\.transaction_type === 'earn_workout_feed_share'/);
assert.doesNotMatch(shareUi, /Photo \+ PB to Feed \(\+1 XP\)/);

assert.match(dashboard, /The first activity share each day earns \+15 XP in Balance Feed/);
assert.match(dashboard, /id: 'daily-workout-pb-share-xp-v1'/);
assert.match(dashboard, /One daily workout share reward/);

console.log('Daily social-share XP contracts passed');
