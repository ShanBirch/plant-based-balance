const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pb = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'pb-celebration-draft.js'), 'utf8');
const badge = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'badge-earned-alert.js'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');

assert.ok(
    pb.includes('const PB_IMMEDIATE_COACH_ALERTS_ENABLED = false;'),
    'immediate PB coach alerts should stay hard-disabled'
);

assert.ok(
    !admin.includes("'win_to_celebrate', 'badge_earned'];"),
    'PB and badge alerts should not be routed into Needs You'
);

assert.ok(
    !badge.includes("'workout_5'")
        && !badge.includes("'workout_25'")
        && !badge.includes("'workout_100'")
        && !badge.includes("'workout_365'")
        && !badge.includes("'pb_10'")
        && !badge.includes("'pb_25'")
        && !badge.includes("'pb_50'"),
    'workout/PB badge milestones should not create coach badge alerts'
);

assert.ok(
    !badge.includes('workout_adjacent_badge')
        && !badge.includes("needs_you_reasons: ['post_workout', 'badge_earned']"),
    'workout/PB badges should not be held for coach approval'
);

console.log('post-workout PB/badge suppression tests passed');
