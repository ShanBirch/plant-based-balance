const assert = require('assert');

const {
    buildCheckinThreadMetadata,
    normalizeActiveCheckinAlert,
    buildCheckinConversationBlock,
    summarizeWeeklyGoalsRow,
} = require('../netlify/functions/_lib/client-context');

const metadata = buildCheckinThreadMetadata({
    cadence: 'wednesday',
    cadenceLabel: 'Wednesday night halfway check',
    dateKey: '2026-05-20',
    challengeName: '30 Day Challenge',
    challengeWeek: 'week 3',
    startedAt: '2026-05-20T08:00:00.000Z',
});

assert.strictEqual(metadata.active, true);
assert.strictEqual(metadata.cadence, 'wednesday');
assert.strictEqual(metadata.state, 'midweek_checkin_active');
assert.ok(metadata.objective.includes('all 3 Weekly Goals as a bundle'));
assert.strictEqual(metadata.expires_at, '2026-05-23T08:00:00.000Z');

const block = buildCheckinConversationBlock({
    ...metadata,
    alert_id: 'alert-1',
    sent_at: '2026-05-20T08:05:00.000Z',
    message: 'need anything from me this week?',
});

assert.ok(block.includes('ACTIVE CHECK-IN THREAD'));
assert.ok(block.includes('Wednesday night halfway check'));
assert.ok(block.includes('First answer what they actually just said'));
assert.ok(block.includes('Do not ask them to pick one main focus'));
assert.ok(block.includes('one training goal, one food/tracking goal, and one recovery or consistency goal'));

assert.strictEqual(buildCheckinConversationBlock(null), '');

const legacyContext = normalizeActiveCheckinAlert({
    id: 'legacy-alert',
    status: 'sent',
    alert_type: 'weekly_checkin',
    suggested_message: 'how has the week been so far?',
    data: {
        subtype: 'challenge_checkin',
        challenge_checkin: true,
        cadence: 'wednesday',
        cadence_label: 'Wednesday night halfway check',
        challenge_week: 'week 3',
    },
    created_at: '2026-05-20T07:43:47.244Z',
    actioned_at: '2026-05-20T20:48:05.878Z',
}, new Date('2026-05-21T01:00:00.000Z'));

assert.strictEqual(legacyContext.alert_id, 'legacy-alert');
assert.strictEqual(legacyContext.source, 'legacy_challenge_checkin');
assert.strictEqual(legacyContext.cadence, 'wednesday');
assert.ok(legacyContext.message.includes('how has the week'));

const weeklyGoalsText = summarizeWeeklyGoalsRow({
    week_start: '2026-05-18',
    week_end: '2026-05-24',
    selected_goals: [
        { id: 'train_3', label: 'Train 3 times', category: 'training', target: 3, unit: 'sessions' },
        { id: 'protein', label: 'Hit protein', category: 'food', target: 5, unit: 'days' },
        { id: 'sleep', label: 'Sleep routine', category: 'recovery', target: 4, unit: 'nights' },
    ],
    status: 'active',
    completed_count: 1,
    total_count: 3,
    completion_rate: 33.33,
}, { now: new Date('2026-05-21T01:00:00.000Z') });

assert.ok(weeklyGoalsText.includes('Weekly Goals this week'));
assert.ok(weeklyGoalsText.includes('selected 3/3'));
assert.ok(weeklyGoalsText.includes('Train 3 times'));
assert.ok(weeklyGoalsText.includes('1/3 complete'));
assert.strictEqual(summarizeWeeklyGoalsRow(null), 'Weekly Goals: none saved for the current/recent week.');

console.log('check-in thread context tests passed');
