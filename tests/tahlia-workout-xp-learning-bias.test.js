const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const seedSql = fs.readFileSync(path.join(root, 'database', 'tahlia_brooks_xp_autopilot.sql'), 'utf8');
const migrationSql = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260704084144_tahlia_workout_xp_learning_bias.sql'),
    'utf8'
);

for (const source of [seedSql, migrationSql]) {
    assert.ok(
        source.includes('CREATE OR REPLACE FUNCTION private.seed_xp_category_for_award'),
        'Tahlia seeded XP should route awards through a shared category function'
    );
    assert.ok(
        source.includes("WHEN 4 THEN 'workout'"),
        'Tahlia seeded workout XP should appear only once in the eight-slot award cycle'
    );
    assert.ok(
        source.includes("ELSE 'learning'"),
        'Tahlia seeded XP should bias spare slots toward learning'
    );
    assert.ok(
        source.includes('v_workout_xp := LEAST(v_award_xp, 3);'),
        'Tahlia seeded workout awards should cap visible workout XP'
    );
    assert.ok(
        source.includes("'tahlia_brooks_xp_autopilot_learning_overflow'"),
        'Workout overflow should be reclassified as learning XP'
    );
}

assert.ok(
    !/CASE \(\(v_award\.award_index - 1\) % 4\)[\s\S]*WHEN 0 THEN 'earn_workout'/.test(seedSql),
    'Tahlia seed worker should not use the old four-way workout rotation'
);

console.log('tahlia workout xp learning bias tests passed');
