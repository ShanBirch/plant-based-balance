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
