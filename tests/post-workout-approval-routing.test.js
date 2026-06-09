const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pb = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'pb-celebration-draft.js'), 'utf8');
const badge = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'badge-earned-alert.js'), 'utf8');

assert.ok(
    pb.includes('const PB_CELEBRATION_AUTO_SEND_ENABLED = false;')
        && pb.includes('if (PB_CELEBRATION_AUTO_SEND_ENABLED && draftText && alertId)'),
    'PB celebrations should not auto-send without an explicit code gate'
);

assert.ok(
    pb.includes('loadClientSocialContact(coachId, userId)')
        && pb.includes("preferred_delivery_channel: socialContact.hasSocialContact ? 'instagram' : 'in_app'")
        && pb.includes("needs_you_reasons: ['post_workout', 'personal_best']"),
    'PB celebrations should route to Needs You and prefer IG/Facebook delivery when available'
);

assert.ok(
    badge.includes('function isWorkoutAdjacentBadge')
        && badge.includes('const workoutAdjacentCelebration = alertBadges.some(isWorkoutAdjacentBadge);'),
    'badge alerts should detect workout/PB-adjacent milestones'
);

assert.ok(
    badge.includes('!workoutAdjacentCelebration && !suppressPush && draftText && alertId')
        && badge.includes("needs_you_reasons: ['post_workout', 'badge_earned']")
        && badge.includes('...buildSocialContactAlertData(socialContact)'),
    'workout/PB badge celebrations should stay approval-first and prefer IG/Facebook metadata'
);

console.log('post-workout approval routing tests passed');
