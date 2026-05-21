const assert = require('assert');

process.env.INSTAGRAM_GRAPH_ACCOUNT_ID = process.env.INSTAGRAM_GRAPH_ACCOUNT_ID || 'ig_account_test';

const { _test } = require('../netlify/functions/send-direct-ig-message');

const graphThread = {
    id: 'thread-1',
    subscriber_id: 'ig_graph:recipient_123',
    channel: 'instagram',
    custom_data: {
        instagram_graph: {
            ig_account_id: 'account_456',
        },
    },
};

assert.strictEqual(_test.resolveThreadGraphRecipientId(graphThread), 'recipient_123');
assert.strictEqual(_test.resolveThreadGraphAccountId(graphThread), 'account_456');

const graphRoute = _test.resolveDirectTransport(graphThread);
assert.deepStrictEqual(
    {
        ok: graphRoute.ok,
        channel: graphRoute.channel,
        transport: graphRoute.transport,
        recipientId: graphRoute.recipientId,
        accountId: graphRoute.accountId,
    },
    {
        ok: true,
        channel: 'instagram',
        transport: 'instagram_graph',
        recipientId: 'recipient_123',
        accountId: 'account_456',
    }
);
assert.strictEqual(_test.deliveryChannelForTransport(graphRoute), 'instagram_graph');
assert.strictEqual(_test.sourceForDelivery(graphRoute), 'admin_dashboard_direct_instagram_graph');

const nestedGraphThread = {
    id: 'thread-2',
    subscriber_id: 'manychat_legacy',
    channel: 'instagram',
    custom_data: {
        instagram_graph: {
            ig_graph_user_id: 'nested_recipient',
        },
    },
};
const nestedRoute = _test.resolveDirectTransport(nestedGraphThread);
assert.strictEqual(nestedRoute.transport, 'instagram_graph');
assert.strictEqual(nestedRoute.recipientId, 'nested_recipient');

const messengerRoute = _test.resolveDirectTransport({
    id: 'thread-3',
    subscriber_id: 'mc_subscriber',
    channel: 'messenger',
    custom_data: {},
});
assert.strictEqual(messengerRoute.channel, 'messenger');
assert.ok(['manychat', 'unavailable'].includes(messengerRoute.transport));

const missingGraphRoute = _test.resolveDirectTransport({
    id: 'thread-4',
    subscriber_id: 'ig_graph:',
    channel: 'instagram',
    custom_data: {},
});
assert.strictEqual(missingGraphRoute.ok, false);
assert.strictEqual(missingGraphRoute.code, 'graph_recipient_missing');

console.log('send-direct-ig-message routing tests passed');
