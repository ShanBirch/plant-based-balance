const assert = require('assert');

const radar = require('../netlify/functions/support-radar-scan')._test;

const NOW = new Date('2026-06-07T00:00:00.000Z').getTime();
const realDateNow = Date.now;
Date.now = () => NOW;
process.on('exit', () => {
    Date.now = realDateNow;
});

function assignment(overrides = {}) {
    return {
        coach_id: 'coach-1',
        client_id: 'client-1',
        client: {
            name: 'Mon',
            email: 'mon@example.com',
            last_login: '2026-06-06T00:00:00.000Z',
            is_test_account: false,
        },
        ...overrides,
    };
}

assert.strictEqual(radar.isLowMoodText('I am feeling a little bit down today'), true);
assert.strictEqual(radar.isLowMoodText('I have not actually left my van yet, I am overwhelmed'), true);
assert.strictEqual(radar.isLowMoodText('Yum'), false);

const lowMoodMessages = [
    {
        id: 'm1',
        direction: 'in',
        text: 'Morning, I am feeling a little bit down today but it is personal stuff',
        source: 'instagram_graph',
        created_at: '2026-06-05T23:00:00.000Z',
    },
    {
        id: 'm2',
        direction: 'out',
        text: 'no pressure to unpack it straight away',
        source: 'instagram_graph',
        created_at: '2026-06-05T23:10:00.000Z',
    },
];

const lowMood = radar.classifyLowMoodSupport({
    assignment: assignment(),
    messages: lowMoodMessages,
    nowMs: NOW,
});
assert.ok(lowMood, 'low mood from yesterday should create a follow-up signal');
assert.strictEqual(lowMood.signal, 'low_mood_followup');
assert.match(lowMood.message, /how are you feeling today/);

const alreadyFollowedUp = radar.classifyLowMoodSupport({
    assignment: assignment(),
    messages: [
        ...lowMoodMessages,
        {
            id: 'm3',
            direction: 'out',
            text: 'hey mon, checking in, how are you feeling today?',
            source: 'manual_instagram',
            created_at: '2026-06-06T18:30:00.000Z',
        },
    ],
    nowMs: NOW,
});
assert.strictEqual(alreadyFollowedUp, null, 'later support follow-up should suppress duplicate low mood card');

const tooFresh = radar.classifyLowMoodSupport({
    assignment: assignment(),
    messages: [{
        id: 'm4',
        direction: 'in',
        text: 'not feeling good today',
        created_at: '2026-06-06T18:00:00.000Z',
    }],
    nowMs: NOW,
});
assert.strictEqual(tooFresh, null, 'support radar waits until next-day style follow-up timing');

const inactive = radar.classifyInactiveSupport({
    assignment: assignment({
        client: {
            name: 'Shane',
            email: 'shane@example.com',
            last_login: '2026-05-30T00:00:00.000Z',
        },
    }),
    nowMs: NOW,
});
assert.ok(inactive, '7+ day inactivity should create a support signal');
assert.strictEqual(inactive.signal, 'app_inactive_7d');
assert.match(inactive.message, /haven't been in the app/);

const recent = radar.classifyInactiveSupport({
    assignment: assignment({
        client: {
            name: 'Shane',
            email: 'shane@example.com',
            last_login: '2026-06-03T00:00:00.000Z',
        },
    }),
    nowMs: NOW,
});
assert.strictEqual(recent, null, 'recent app users should not get inactivity cards');

const graphThread = {
    id: 'thread-1',
    subscriber_id: 'ig_graph:recipient-1',
    ig_username: 'monica',
    profile_name: 'Monica',
    last_inbound_at: '2026-06-06T12:00:00.000Z',
    custom_data: {
        instagram_graph: {
            ig_graph_user_id: 'recipient-1',
            ig_account_id: 'account-1',
        },
    },
};
const graphDelivery = radar.threadDeliveryData(graphThread, { signal: 'low_mood_followup' });
assert.strictEqual(graphDelivery.delivery_channel, 'instagram_graph');
assert.strictEqual(graphDelivery.manual_ig_required, false);

const manualThread = {
    ...graphThread,
    last_inbound_at: '2026-06-01T00:00:00.000Z',
};
const manualDelivery = radar.threadDeliveryData(manualThread, { signal: 'low_mood_followup' });
assert.strictEqual(manualDelivery.delivery_channel, 'manual_ig');
assert.strictEqual(manualDelivery.manual_ig_required, true);

const alert = radar.buildNeedsYouAlert({
    assignment: assignment(),
    signal: lowMood,
    thread: manualThread,
    now: new Date('2026-06-07T00:00:00.000Z'),
});
assert.strictEqual(alert.alert_type, 'weekly_checkin');
assert.strictEqual(alert.data.operator_queue, 'needs_you');
assert.strictEqual(alert.data.needs_you_required, true);
assert.strictEqual(alert.data.support_radar, true);
assert.strictEqual(alert.data.manual_checkin_roster, true);
assert.strictEqual(alert.data.codex_review.source, 'balance-support-radar');

const key = radar.supportIdempotencyKey({
    assignment: assignment(),
    signal: lowMood,
    now: new Date('2026-06-07T00:00:00.000Z'),
});
assert.ok(key.includes('support_radar:coach-1:client-1:low_mood_followup:2026-06-05'));

console.log('support radar scan tests passed');
