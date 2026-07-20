const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const pointsConfig = fs.readFileSync(path.join(root, 'lib', 'points-config.js'), 'utf8');
const supabaseClient = fs.readFileSync(path.join(root, 'lib', 'supabase.js'), 'utf8');
const awardPoints = fs.readFileSync(path.join(root, 'netlify', 'edge-functions', 'award-points.ts'), 'utf8');
const shareUi = fs.readFileSync(path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'), 'utf8');
const mealUi = fs.readFileSync(path.join(root, 'js', 'dashboard', 'dashboard-script-11-calorie_tracker_functions.js'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260716005226_independent_balance_instagram_share_xp.sql'),
  'utf8'
);
const dailyMigration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260718003000_daily_social_share_xp_caps.sql'),
  'utf8'
);
const coachContext = fs.readFileSync(path.join(root, 'netlify', 'functions', '_lib', 'client-context.js'), 'utf8');

assert.match(pointsConfig, /POINTS_PER_ACTIVITY_FEED_SHARE:\s*15\b/);
assert.match(pointsConfig, /POINTS_PER_SOCIAL_SHARE:\s*15\b/);
assert.match(awardPoints, /type:[^;]*'social_share'/);
assert.match(awardPoints, /supabase\.rpc\('award_social_share_xp'/);
assert.match(supabaseClient, /shareKind:\s*options\.shareKind/);
assert.match(supabaseClient, /shareDestination:\s*options\.shareDestination/);

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.award_social_share_xp/);
assert.match(migration, /v_points CONSTANT INTEGER := 15/);
assert.match(migration, /p_destination NOT IN \('balance_feed', 'instagram_feed'\)/);
assert.match(migration, /ON CONFLICT DO NOTHING[\s\S]*increment_user_points\(p_user_id, v_points\)/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.award_social_share_xp[\s\S]*GRANT EXECUTE[\s\S]*service_role/);
assert.match(dailyMigration, /one 15 XP social-share bonus per category, destination, and Brisbane day/i);
assert.match(dailyMigration, /v_reference_type := p_share_kind[\s\S]*v_award_date::TEXT/);
assert.match(dailyMigration, /dailyLimitReached', TRUE/);

assert.match(shareUi, /awardBalanceSocialShareXP\('workout', 'balance_feed'/);
assert.match(shareUi, /'workout',[\s\S]*'instagram_feed'/);
assert.match(shareUi, /sharePBCardToFeed[\s\S]*awardBalanceSocialShareXP\('workout', 'balance_feed', story\.id\)/);
assert.match(shareUi, /pendingPBShareData[\s\S]*'workout',[\s\S]*'instagram_feed'/);
assert.match(shareUi, /'activity',[\s\S]*'balance_feed'/);
assert.match(shareUi, /'activity',[\s\S]*'instagram_feed'/);
assert.match(shareUi, /'meal',[\s\S]*'balance_feed'/);
assert.match(shareUi, /'meal',[\s\S]*'instagram_feed'/);
assert.match(mealUi, /awardBalanceSocialShareXP\('meal', 'instagram_feed', receipt\.mealId\)/);
assert.match(mealUi, /sharePendingMealToInstagram[\s\S]*shareMealRecordToInstagram\(meal, btn, 'feed'\)/);

assert.match(dashboard, /id="activity-share-btn"[\s\S]*Balance Feed \(\+15 XP\)/);
assert.match(dashboard, /id="activity-share-instagram-btn"[\s\S]*IG Feed \(\+15 XP\)/);
assert.match(dashboard, /id="share-workout-card-btn"[\s\S]*Balance Feed \(\+15 XP\)/);
assert.match(dashboard, /id="share-workout-ig-feed-btn"[\s\S]*Feed \(\+15 XP\)/);
assert.match(dashboard, /id:\s*'independent-balance-instagram-share-xp-v1'/);
assert.match(dashboard, /title:'Two shares, two rewards'/);
assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=31/);
assert.match(shareUi, /onSharePrepared:\s*\(\)\s*=>\s*markWorkoutInstagramShareCompleted\(safeTarget\)/);
assert.match(shareUi, /if \(!opened\) clearWorkoutInstagramShareCompleted\(safeTarget\)/);
assert.match(dashboard, /dashboard-script-11-calorie_tracker_functions\.js\?v=27/);
assert.match(coachContext, /food and workout shares earn \+15 XP[\s\S]*another independent \+15 XP in Instagram Feed/);
assert.match(dashboard, /id:\s*'daily-workout-pb-share-xp-v1'/);
assert.match(dashboard, /title:'One daily workout share reward'/);

console.log('Independent Balance and Instagram share XP contract ok');
