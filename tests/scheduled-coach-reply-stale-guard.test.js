const assert = require('assert');

const originalFetch = global.fetch;
const worker = require('../netlify/functions/scheduled-coach-reply-worker')._test;

async function run() {
    assert.deepStrictEqual(
        await worker.buildCurrentClientNeedsYouHold({
            id: 'current-client-alert',
            client_id: 'client-current',
            data: { scheduled_via: 'auto_send' },
        }),
        {
            code: 'linked_client_requires_shannon_approval',
            label: 'current client reply needs Shannon approval',
            linked_user_id: 'client-current',
        },
        'scheduled worker must hold current clients before transport'
    );
    assert.strictEqual(
        await worker.buildCurrentClientNeedsYouHold({
            client_id: 'client-current',
            data: { scheduled_via: 'admin_dashboard' },
        }),
        null,
        'scheduled worker must allow replies Shannon explicitly scheduled'
    );

    const alert = {
        id: 'scheduled-alert',
        created_at: '2026-07-13T02:25:29.604Z',
        data: {
            channel: 'instagram',
            ig_thread_id: 'thread-andy',
        },
    };

    global.fetch = async (url) => {
        assert.match(String(url), /thread_id=eq\.thread-andy/);
        assert.match(String(url), /created_at=gt\.2026-07-13T02%3A25%3A29\.604Z/);
        assert.doesNotMatch(String(url), /direction=eq\.in/);
        return {
            ok: true,
            text: async () => JSON.stringify([{
                id: 'newer-inbound',
                direction: 'in',
                text: 'How is the goldie?',
                created_at: '2026-07-13T02:25:31.799Z',
                alert_id: 'goldie-alert',
            }]),
        };
    };
    const newer = await worker.getNewerInstagramInbound(alert);
    assert.strictEqual(newer.id, 'newer-inbound');

    global.fetch = async () => ({
        ok: true,
        text: async () => JSON.stringify([{
            id: 'newer-outbound',
            direction: 'out',
            text: 'Already replied manually',
            created_at: '2026-07-13T02:26:00.000Z',
        }]),
    });
    assert.strictEqual(
        (await worker.getNewerInstagramConversationMessage(alert)).id,
        'newer-outbound',
        'a newer outbound must also invalidate the scheduled reply'
    );
    assert.strictEqual(await worker.getNewerInstagramInbound(alert), null);

    const messengerAlert = {
        ...alert,
        data: { channel: 'messenger', ig_thread_id: 'thread-messenger' },
    };
    global.fetch = async (url) => {
        assert.match(String(url), /thread_id=eq\.thread-messenger/);
        return {
            ok: true,
            text: async () => JSON.stringify([{ id: 'newer-messenger-inbound', direction: 'in' }]),
        };
    };
    assert.strictEqual((await worker.getNewerInstagramInbound(messengerAlert)).id, 'newer-messenger-inbound');

    global.fetch = async () => ({ ok: true, text: async () => '[]' });
    assert.strictEqual(await worker.getNewerInstagramInbound(alert), null);
    assert.strictEqual(await worker.getNewerInstagramInbound({ data: { channel: 'instagram' } }), null);

    const paidMetaGoalAlert = {
        data: {
            acquisition_mode: 'paid_meta',
            message_preview: 'I need to lose weight!',
            qualifier: { commercial_stage: 'engaged' },
            auto_send_review_approved_at: '2026-08-03T01:03:30.000Z',
        },
    };
    assert.strictEqual(
        worker.buildPaidMetaPrematureOfferHold(
            paidMetaGoalAlert,
            "Starter Coaching is probably the best fit. It's $29.99 a week."
        ).code,
        'paid_meta_premature_offer',
        'manager approval must not bypass the paid Meta goal-to-blocker progression'
    );
    assert.strictEqual(
        worker.buildPaidMetaPrematureOfferHold(
            {
                data: {
                    acquisition_mode: 'paid_meta',
                    message_preview: 'I need to lose weight, probably 15kgs',
                    qualifier: { commercial_stage: 'engaged' },
                },
            },
            'The Founders Pass is probably the best starting point. It is $99 once.'
        ).code,
        'paid_meta_premature_offer',
        'goal replies with a number attached still need the offer-rewrite hold'
    );
    assert.strictEqual(
        worker.buildPaidMetaPrematureOfferHold(
            paidMetaGoalAlert,
            'Yeah, I get you. What usually makes weight loss hard to stick with for you?'
        ),
        null,
        'a normal blocker question after the goal remains sendable'
    );
    assert.strictEqual(
        worker.buildPaidMetaPrematureOfferHold({
            data: {
                ...paidMetaGoalAlert.data,
                message_preview: 'Send me the link',
                qualifier: { commercial_stage: 'buyer_intent' },
            },
        }, 'Yep, here is the Founders Pass link.'),
        null,
        'explicit buyer intent can still receive the offer handoff'
    );

    const controllerCalls = [];
    const controllerResult = await worker.reconcileScheduledInstagramController({
        id: 'alert-controller',
        data: {
            ig_thread_id: 'thread-controller',
            manychat_message_id: 'ig_graph:inbound-transport',
        },
    }, {
        db: async (path, options = {}) => {
            controllerCalls.push({ path, options });
            if (path.startsWith('ig_messages?') && path.includes('direction=eq.in')) {
                return [{ id: 'inbound-row', created_at: '2026-08-13T11:01:45.449Z' }];
            }
            if (path.startsWith('ig_messages?') && path.includes('direction=eq.out')) {
                return [{
                    id: 'outbound-row',
                    text: 'A fresh reply',
                    created_at: '2026-08-13T11:02:24.254Z',
                    manychat_message_id: 'ig_graph:outbound-transport',
                }];
            }
            if (path.startsWith('ig_next_actions?select=')) {
                return [{ id: 'action-row', action_version: 12, status: 'ready', source_message_id: 'inbound-row' }];
            }
            if (path.startsWith('ig_next_actions?id=eq.action-row')) {
                assert.strictEqual(options.method, 'PATCH');
                assert.strictEqual(options.body.status, 'completed');
                assert.strictEqual(options.body.receipt.source_inbound_id, 'inbound-row');
                assert.strictEqual(options.body.receipt.canonical_outbound_id, 'outbound-row');
                return [{ id: 'action-row', status: 'completed' }];
            }
            throw new Error(`Unexpected controller path: ${path}`);
        },
    });
    assert.strictEqual(controllerResult.reconciled, true);
    assert.ok(controllerCalls.some(call => call.path.includes('claim_token=is.null')));

    global.fetch = originalFetch;
    console.log('scheduled coach reply stale guard tests passed');
}

run().catch((error) => {
    global.fetch = originalFetch;
    console.error(error);
    process.exit(1);
});
