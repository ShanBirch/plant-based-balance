const assert = require('assert');

const routing = require('../netlify/functions/_lib/ig-thread-routing');

(async () => {
    const nowMs = Date.parse('2026-06-10T00:00:00.000Z');
    const staleMonicaThread = {
        id: 'thread-monica',
        subscriber_id: 'ig_graph:balance_account:recipient_monica',
        channel: 'instagram',
        ig_username: 'monica.l.sheekey',
        profile_name: 'Monica',
        linked_user_id: 'user-mon',
        last_inbound_at: '2026-06-08T20:00:00.000Z',
        custom_data: {
            instagram_graph: {
                ig_account_id: 'balance_account',
            },
        },
    };
    const freshSaltyDreamsThread = {
        id: 'thread-salty-dreams',
        subscriber_id: 'ig_graph:balance_account:recipient_salty',
        channel: 'instagram',
        ig_username: 'saltydreams',
        profile_name: 'Salty Dreams',
        linked_user_id: 'user-mon',
        last_inbound_at: '2026-06-09T23:00:00.000Z',
        custom_data: {
            instagram_graph: {
                ig_graph_user_id: 'recipient_salty',
                ig_account_id: 'balance_account',
            },
        },
    };

    const queries = [];
    const supabaseQuery = async (path) => {
        queries.push(path);
        if (path.includes('linked_user_id=eq.user-mon')) {
            return [freshSaltyDreamsThread, staleMonicaThread];
        }
        return [];
    };

    const resolution = await routing.resolveAlternateIgDeliveryThread({
        thread: staleMonicaThread,
        supabaseQuery,
        nowMs,
        humanAgentEnabled: false,
    });

    assert.strictEqual(resolution.used, true);
    assert.strictEqual(resolution.thread.id, 'thread-salty-dreams');
    assert.strictEqual(resolution.reason, 'linked_user_fresh_ig_thread');
    assert.ok(queries.some(path => path.includes('linked_user_id=eq.user-mon')));

    const deliveryData = routing.buildAlternateIgDeliveryData(resolution);
    assert.strictEqual(deliveryData.requested_ig_thread_id, 'thread-monica');
    assert.strictEqual(deliveryData.sent_ig_thread_id, 'thread-salty-dreams');
    assert.strictEqual(deliveryData.alternate_ig_delivery.delivered_thread.ig_username, 'saltydreams');

    assert.strictEqual(
        routing.graphRecipientFromSubscriberId('ig_graph:balance_account:recipient_salty'),
        'recipient_salty'
    );
    assert.strictEqual(
        routing.graphAccountFromSubscriberId('ig_graph:balance_account:recipient_salty'),
        'balance_account'
    );

    console.log('ig-thread-routing tests passed');
})();
