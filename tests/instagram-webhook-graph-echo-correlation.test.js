const test = require('node:test');
const assert = require('node:assert/strict');

const webhook = require('../netlify/functions/instagram-webhook');

test('a Graph echo can only clear a pending alert for the same inbound', () => {
    const sent = { idempotency_key: 'ig_incoming_dm:ig_graph:goal-inbound' };
    const sameInboundShell = { idempotency_key: 'ig_incoming_dm:ig_graph:goal-inbound' };
    const newerBlockerShell = { idempotency_key: 'ig_incoming_dm:ig_graph:blocker-inbound' };

    assert.equal(webhook._test.shouldApplyBalanceSendEchoToPending(sent, sameInboundShell), true);
    assert.equal(webhook._test.shouldApplyBalanceSendEchoToPending(sent, newerBlockerShell), false);
    assert.equal(webhook._test.shouldApplyBalanceSendEchoToPending({}, newerBlockerShell), false);
});

test('only unlinked verified paid Meta threads start immediate webhook typing', () => {
    const paidMetaThread = {
        linked_user_id: null,
        custom_data: {
            meta_ad_attribution: { source: 'meta_ads', platform_source: 'ADS', ad_id: 'ad-1' },
            instagram_graph: {
                send_ready: true,
                ig_graph_user_id: 'lead-1',
                ig_account_id: 'account-1',
            },
        },
    };
    assert.equal(webhook._test.isVerifiedPaidMetaTypingThread(paidMetaThread), true);
    assert.equal(webhook._test.isVerifiedPaidMetaTypingThread({
        ...paidMetaThread,
        linked_user_id: 'client-1',
    }), false);
    assert.equal(webhook._test.isVerifiedPaidMetaTypingThread({
        linked_user_id: null,
        custom_data: { instagram_graph: paidMetaThread.custom_data.instagram_graph },
    }), false);
});
