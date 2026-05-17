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

const lowStakes = buildReplyTimingSuggestion(makeLeadAlert({
    inbound: 'haha how are you?',
    qualifier: { stage: 'current_state', warmth_score: 35 },
    suggested: 'haha good, been fighting with app bits this morning. hows your day going?',
}));
assert.strictEqual(lowStakes.delay_ms, 30 * 60 * 1000);
assert.strictEqual(lowStakes.signals.low_stakes_rapport, true);

console.log('reply timing conversion tests passed');
