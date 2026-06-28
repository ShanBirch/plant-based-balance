const assert = require('assert');

const dailyReels = require('../netlify/functions/daily-reel-opportunity-scan')._test;

const NOW = new Date('2026-06-07T00:00:00.000Z');

function assignment(overrides = {}) {
    return {
        coach_id: 'coach-1',
        client_id: 'client-1',
        client: {
            name: 'Shane',
            email: 'shane@example.com',
            is_test_account: false,
        },
        ...overrides,
    };
}

function thread(overrides = {}) {
    return {
        id: 'thread-1',
        subscriber_id: 'ig_graph:account-1:recipient-1',
        ig_username: 'shane_minahan',
        profile_name: 'Shane',
        linked_user_id: 'client-1',
        last_inbound_at: '2026-06-06T12:00:00.000Z',
        custom_data: {
            instagram_graph: {
                ig_graph_user_id: 'recipient-1',
                ig_account_id: 'account-1',
            },
        },
        ...overrides,
    };
}

const frontSquatSignal = dailyReels.classifyConversation({
    assignment: assignment(),
    thread: thread(),
    nowMs: NOW.getTime(),
    messages: [
        {
            id: 'm1',
            direction: 'in',
            source: 'instagram_graph',
            text: 'Question? How many sets and what rep range should I be aiming for?',
            created_at: '2026-06-06T11:00:00.000Z',
        },
        {
            id: 'm2',
            direction: 'out',
            source: 'instagram_graph',
            text: 'Yep, the front squat program is set in the app. Monday heavy, Thursday lighter.',
            created_at: '2026-06-06T11:05:00.000Z',
        },
    ],
});

assert.ok(frontSquatSignal, 'front squat conversation should create a reel signal');
assert.strictEqual(frontSquatSignal.id, 'front_squat_technique');
assert.strictEqual(frontSquatSignal.topicId, 'weight_training_technique');
assert.match(frontSquatSignal.caption, /front squats/);

const noGenericProgramSignal = dailyReels.classifyConversation({
    assignment: assignment(),
    thread: thread(),
    nowMs: NOW.getTime(),
    messages: [{
        id: 'm3',
        direction: 'out',
        source: 'instagram_graph',
        text: 'The program is in the app.',
        created_at: '2026-06-06T11:05:00.000Z',
    }],
});
assert.strictEqual(noGenericProgramSignal, null, 'generic app/program talk should not create reel suggestions');

assert.strictEqual(
    dailyReels.veganRequiredFromContext({
        thread: thread({ personal_context: 'Vegan challenge client, prefers plant-based meals.' }),
        assignment: assignment(),
        messages: [],
    }),
    true,
    'vegan client context should require vegan-safe food reels'
);

const unsafeProtein = {
    topic_id: 'protein_science',
    title: 'How much whey protein and milk should you use?',
    description: 'Whey, milk and Greek yogurt protein tips.',
    channel_title: 'Jeff Nippard',
    source_kind: 'evidence_fitness',
};
assert.strictEqual(
    dailyReels.assessCandidateVeganSafety(unsafeProtein, { required: true, topicId: 'protein_science' }).status,
    'unsafe',
    'animal-product nutrition metadata should be unsafe for vegan-required clients'
);

const safeTechnique = {
    topic_id: 'weight_training_technique',
    title: 'Front Squat Technique',
    description: 'How to keep your torso position on front squats.',
    channel_title: 'Squat University',
    source_kind: 'evidence_fitness',
};
assert.strictEqual(
    dailyReels.assessCandidateVeganSafety(safeTechnique, { required: true, topicId: 'weight_training_technique' }).status,
    'safe',
    'non-food technique reels with no animal-product signal are safe for vegan-required clients'
);

const reel = {
    url: 'https://www.youtube.com/shorts/front123',
    title: 'Front Squat Form Fix',
    channel_title: 'Squat University',
    channel_id: 'squat-channel',
    video_id: 'front123',
    description: 'Front squat technique tips.',
    thumbnail_url: 'https://img.example/front.jpg',
    duration_seconds: 45,
    view_count: 120000,
    source_id: 'squat_university',
    source_kind: 'evidence_fitness',
    reason: 'trusted source: Squat University. matched topic: Weight training technique. 120,000 views',
};
const alert = dailyReels.buildNeedsYouAlert({
    assignment: assignment(),
    thread: thread(),
    signal: frontSquatSignal,
    reel,
    searchMeta: { raw_count: 12, eligible_count: 3, queries: ['Squat University front squat technique shorts'] },
    now: NOW,
});

assert.strictEqual(alert.alert_type, 'weekly_checkin');
assert.strictEqual(alert.status, 'pending');
assert.strictEqual(alert.data.operator_queue, 'needs_you');
assert.strictEqual(alert.data.needs_shannon_approval, true);
assert.strictEqual(alert.data.daily_reel_opportunity, true);
assert.strictEqual(alert.data.learning_reels[0].video_id, 'front123');
assert.match(alert.suggested_message, /front squats/);
assert.match(alert.suggested_message, /https:\/\/www\.youtube\.com\/shorts\/front123/);
assert.strictEqual(alert.data.delivery_channel, 'instagram_graph');

const key = dailyReels.reelOpportunityIdempotencyKey({
    assignment: assignment(),
    signal: frontSquatSignal,
    now: NOW,
});
assert.ok(key.includes('daily_reel:coach-1:client-1:2026-06-07:front_squat_technique'));

console.log('daily reel opportunity scan tests passed');
