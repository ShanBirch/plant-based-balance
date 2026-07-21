const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const stories = fs.readFileSync(path.join(root, 'lib/stories.js'), 'utf8');
const pointsConfig = fs.readFileSync(path.join(root, 'lib/points-config.js'), 'utf8');
const awardPoints = fs.readFileSync(path.join(root, 'netlify/edge-functions/award-points.ts'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260711095137_workout_feed_share_daily_xp_source_independent.sql'), 'utf8');

assert.match(pointsConfig, /POINTS_PER_WORKOUT_FEED_SHARE:\s*15\b/);
assert.match(awardPoints, /POINTS_PER_WORKOUT_FEED_SHARE:\s*15\b/);
assert.match(dashboard, /First share each day earns \+15 XP/);
assert.match(dashboard, /openFeedComposerShareSource\('set'\)/);
assert.match(stories, /source:\s*'feed'/);
assert.match(stories, /The archive trigger is the server-side source of truth/);
assert.match(migration, /COALESCE\(NEW\.source, ''\) <> 'feed_workout_share'/);
assert.match(migration, /increment_user_points\(NEW\.user_id, 15\)/);
assert.match(migration, /award_workout_feed_share_xp_on_insert/);
assert.match(
  awardPoints,
  /if \(type === 'social_share' \|\| type === 'workout_feed_share'\)/,
  'legacy Share a Set awards must use the atomic social-share RPC'
);
assert.match(
  awardPoints,
  /const shareKind = type === 'workout_feed_share' \? 'workout' : body\.shareKind;[\s\S]*const shareDestination = type === 'workout_feed_share' \? 'balance_feed' : body\.shareDestination;/,
  'legacy workout Feed awards must resolve to the same daily workout Balance Feed key'
);
assert.match(
  migration,
  /CREATE UNIQUE INDEX[\s\S]*ON public\.point_transactions \(user_id, transaction_type, reference_type\)[\s\S]*reference_type LIKE 'workout_feed_share:%'/,
  'the shared daily workout Feed key must remain database-unique'
);

console.log('Share a Set Feed XP contract ok');
