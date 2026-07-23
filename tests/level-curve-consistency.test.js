const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pointsWidget = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const feedScript = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-6-ai_coach_draft_mode_logic_auth.js'),
    'utf8'
);
const characterScript = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-13.js'),
    'utf8'
);
const userProfileScript = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'pbb-deferred-userprofile.js'),
    'utf8'
);
const pointsConfig = fs.readFileSync(path.join(root, 'lib', 'points-config.js'), 'utf8');
const levelMigration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260723090000_remove_level_99_cap.sql'),
    'utf8'
);

function pointsForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(0.07 * Math.pow(level, 2.4) + 0.7 * level);
}

function calculateLevel(lifetimePoints) {
    let level = 1;
    while (lifetimePoints >= pointsForLevel(level + 1)) level++;
    return level;
}

assert.strictEqual(calculateLevel(1912), 69, '1,912 XP should calculate as level 69');
assert.strictEqual(pointsForLevel(69), 1861, 'level 69 threshold should match the DB curve');
assert.strictEqual(pointsForLevel(70), 1925, 'level 70 threshold should match the DB curve');
assert.strictEqual(calculateLevel(pointsForLevel(100)), 100, 'level progression should continue beyond 99');
assert.strictEqual(calculateLevel(pointsForLevel(445)), 445, 'every level-gated character should remain reachable');
assert.ok(
    pointsForLevel(446) - pointsForLevel(445) > pointsForLevel(100) - pointsForLevel(99),
    'later levels should require progressively more XP'
);

assert.ok(pointsWidget.includes('const LEVEL_CURVE_MULTIPLIER = 0.07;'), 'points widget should use DB multiplier');
assert.ok(pointsWidget.includes('const LEVEL_CURVE_EXPONENT = 2.4;'), 'points widget should use DB exponent');
assert.ok(pointsWidget.includes('const LEVEL_LINEAR_BONUS = 0.7;'), 'points widget should use DB linear bonus');
assert.ok(!pointsWidget.includes('const MAX_LEVEL = 99;'), 'points widget should not cap progression at level 99');
assert.ok(!characterScript.includes('while (level < 99)'), 'character display should continue beyond level 99');
assert.ok(!userProfileScript.includes('const MAX_LEVEL = 99;'), 'profile display should continue beyond level 99');
assert.ok(!feedScript.includes('const maxLevel = 99;'), 'Feed leaderboard should continue beyond level 99');
assert.ok(!levelMigration.includes('v_max_level'), 'database calculation should not cap progression');

assert.ok(feedScript.includes('const multiplier = 0.07;'), 'Feed fallback should use DB multiplier');
assert.ok(feedScript.includes('const exponent = 2.4;'), 'Feed fallback should use DB exponent');
assert.ok(feedScript.includes('const linearBonus = 0.7;'), 'Feed fallback should use DB linear bonus');

assert.ok(pointsConfig.includes('CURVE_MULTIPLIER: 0.07'), 'shared config should use DB multiplier');
assert.ok(pointsConfig.includes('CURVE_EXPONENT: 2.4'), 'shared config should use DB exponent');
assert.ok(pointsConfig.includes('LINEAR_BONUS: 0.7'), 'shared config should use DB linear bonus');

console.log('level curve consistency tests passed');
