const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');
const match = dashboard.match(/const NEEDS_YOU_AI_CONFUSION_RE = (\/.+?\/i);/);

assert.ok(match, 'Needs You AI confusion regex should be present');

const regex = vm.runInNewContext(match[1]);

assert.ok(
    regex.test('Client explicitly asked whether this is AI/automated and the thread is too inconsistent for a safe self-reply.'),
    'stored Matty AI/automated reason should count as Needs You'
);

assert.ok(
    regex.test('Can you be straight with me...is this actually Shan replying, or is it an AI assistant trained to reply on your behalf?'),
    'direct AI authenticity question should count as Needs You'
);

assert.ok(
    dashboard.includes("const NEEDS_YOU_ALERT_TYPES = [...DM_ALERT_TYPES, 'onboarding_day_30'];"),
    'month-one milestones should be loaded into Needs You'
);

assert.ok(
    dashboard.includes("if (alert.alert_type === 'weekly_checkin') return false;"),
    'old weekly check-ins should stay out of Needs You'
);

assert.ok(
    dashboard.includes("if (alert.alert_type === 'onboarding_day_30')"),
    'month-one milestones should have explicit Needs You operator-work handling'
);

console.log('admin Needs You AI confusion regex tests passed');
