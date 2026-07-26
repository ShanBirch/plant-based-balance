const assert = require('assert');

const { buildReplyTimingSuggestion } = require('../netlify/functions/_lib/client-context');

function makeLeadAlert({ inbound, qualifier = {}, leadStage = 'qualifying', suggested = 'sounds good, i can send that through now' } = {}) {
    return {
        id: 'alert-1',
        status: 'pending',
        alert_type: 'ig_incoming_dm',
        priority: 'high',
        client_id: null,
        description: inbound ? `"${inbound}"` : '',
        suggested_message: suggested,
        data: {
            channel: 'instagram',
            lead_stage: leadStage,
            message_preview: inbound || '',
            qualifier,
        },
    };
}

const accepted = buildReplyTimingSuggestion(makeLeadAlert({
    inbound: 'yeah im in',
    qualifier: { stage: 'won', warmth_score: 82 },
}));
assert.strictEqual(accepted.delay_ms, 0);
assert.strictEqual(accepted.signals.accepted_challenge, true);
assert.strictEqual(accepted.signals.accepted_coaching, true);

const offerWarm = buildReplyTimingSuggestion(makeLeadAlert({
    inbound: 'that sounds good',
    qualifier: { stage: 'pitched', warmth_score: 72 },
}));
assert.strictEqual(offerWarm.delay_ms, 5 * 60 * 1000);
assert.strictEqual(offerWarm.signals.offer_thread, true);

const explicitLink = buildReplyTimingSuggestion(makeLeadAlert({
    inbound: 'can you send me the link?',
    qualifier: { stage: 'current_state', warmth_score: 45 },
}));
assert.strictEqual(explicitLink.delay_ms, 0);
assert.strictEqual(explicitLink.signals.hot_intent, true);

const directChallengeQuestion = buildReplyTimingSuggestion(makeLeadAlert({
    inbound: 'Hey can you tell me about your challenge?',
    qualifier: { stage: 'current_state', warmth_score: 45 },
    suggested: 'Yeah, it is a simple six-week structure for training, food and support.',
}));
assert.strictEqual(directChallengeQuestion.delay_ms, 60 * 1000);
assert.strictEqual(directChallengeQuestion.signals.direct_challenge_question, true);

const lowStakes = buildReplyTimingSuggestion(makeLeadAlert({
    inbound: 'haha how are you?',
    qualifier: { stage: 'current_state', warmth_score: 35 },
    suggested: 'haha good, been fighting with app bits this morning. hows your day going?',
}));
assert.strictEqual(lowStakes.delay_ms, 30 * 60 * 1000);
assert.strictEqual(lowStakes.signals.low_stakes_rapport, true);

const activeExchange = makeLeadAlert({
    inbound: 'Bro you are ripped',
    qualifier: { stage: 'current_state', warmth_score: 55 },
    suggested: 'Hahaha appreciate it. You alive or still in full hungover gremlin mode?',
});
activeExchange.data.last_outbound_message = {
    text: "Morning haha what's up?",
    created_at: '2026-07-25T23:07:58.368Z',
};
activeExchange.data.inbound_message_batch = [
    { text: 'Just in bed hbu', created_at: '2026-07-25T23:08:06.614Z' },
    { text: 'Hungover lol', created_at: '2026-07-25T23:08:12.600Z' },
    { text: 'Bro you are ripped', created_at: '2026-07-25T23:08:50.790Z' },
];
activeExchange.data.response_timing_profile = {
    general: { scope: 'general', sample_count: 60, median_delay_ms: 15 * 60 * 1000 },
    recommendation_delay_ms: 15 * 60 * 1000,
};
const activeExchangeTiming = buildReplyTimingSuggestion(activeExchange);
assert.strictEqual(activeExchangeTiming.delay_ms, 2 * 60 * 1000);
assert.strictEqual(activeExchangeTiming.signals.active_back_and_forth, true);
assert.match(activeExchangeTiming.reason, /active rapid back-and-forth/);

console.log('reply timing conversion tests passed');
