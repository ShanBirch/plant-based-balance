const assert = require('assert');

const clientContext = require('../netlify/functions/_lib/client-context');
const manager = require('../netlify/functions/client-lead-manager')._test;

function makeAlert(overrides = {}) {
    return {
        id: 'alert-1',
        status: 'pending',
        alert_type: 'ig_incoming_dm',
        client_id: null,
        client_name: 'Lead',
        description: '"hey"',
        suggested_message: 'hey, how are you going?',
        data: {
            channel: 'instagram',
            message_preview: 'hey',
        },
        ...overrides,
        data: {
            channel: 'instagram',
            message_preview: 'hey',
            ...(overrides.data || {}),
        },
    };
}

assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Shane' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ profile_name: 'Fra' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ ig_username: 'francesca_balance' }), true);
assert.strictEqual(clientContext.isAlwaysNeedsYouPerson({ client_name: 'Frank' }), false);

const shane = manager.classifyNeedsYou(makeAlert({ client_name: 'Shane' }));
assert.strictEqual(shane.shouldRoute, true);
assert.ok(shane.reasons.includes('always_needs_you_person'));

const media = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: '[PHOTO:https://example.com/photo.jpg]',
        image_url_count: 1,
    },
}));
assert.strictEqual(media.shouldRoute, true);
assert.ok(media.reasons.includes('media_review_required'));

const aiSuspicion = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'is this AI?',
    },
}));
assert.strictEqual(aiSuspicion.shouldRoute, true);
assert.ok(aiSuspicion.reasons.includes('ai_suspicion_or_authenticity_question'));

const contextLoss = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'sorry i dont understand what you mean',
        draft_review: {
            context_loss_suspected: true,
        },
    },
}));
assert.strictEqual(contextLoss.shouldRoute, true);
assert.ok(contextLoss.reasons.includes('client_does_not_understand_context'));
assert.ok(contextLoss.reasons.includes('draft_review_context_loss'));

const normal = manager.classifyNeedsYou(makeAlert({
    data: {
        message_preview: 'thanks mate, that sounds good',
        last_outbound_message: 'sweet, start with the simple version today',
    },
}));
assert.strictEqual(normal.shouldRoute, false);

const stamped = manager.buildNeedsYouData(makeAlert({ client_name: 'Fra' }), shane);
assert.strictEqual(stamped.operator_queue, 'needs_you');
assert.strictEqual(stamped.needs_you_required, true);
assert.strictEqual(stamped.codex_review.source, 'balance-lead-client-manager');
assert.strictEqual(stamped.codex_review.queue, 'needs_you');

console.log('client-lead-manager tests passed');
