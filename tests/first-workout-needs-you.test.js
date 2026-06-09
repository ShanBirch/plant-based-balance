const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'first-workout-celebration.js'), 'utf8');

assert.ok(
    source.includes("needs_you_reason: 'first workout needs Shannon approval before sending'"),
    'first workout alerts should be marked for the Needs You queue'
);

assert.ok(
    source.includes("needs_you_reasons: ['first_workout']"),
    'first workout alerts should persist a first_workout Needs You reason'
);

assert.ok(
    source.includes('First workouts are retention moments Shannon should personally'),
    'first workout push path should document that Shannon approves this moment manually'
);

assert.ok(
    source.includes('const FIRST_WORKOUT_AUTO_SEND_ENABLED = false;')
        && source.includes('if (FIRST_WORKOUT_AUTO_SEND_ENABLED && draftText && alertId)'),
    'first workout trusted-client auto-send path should stay disabled'
);

assert.ok(
    source.includes('loadClientSocialContact(coachId, clientId)')
        && source.includes("preferred_delivery_channel: socialContact.hasSocialContact ? 'instagram' : 'in_app'")
        && source.includes('...buildSocialContactAlertData(socialContact)'),
    'first workout approvals should prefer IG/Facebook delivery when a linked social contact exists'
);

console.log('first workout Needs You tests passed');
