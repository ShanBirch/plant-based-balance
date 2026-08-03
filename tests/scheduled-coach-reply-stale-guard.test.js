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

    global.fetch = originalFetch;
    console.log('scheduled coach reply stale guard tests passed');
}

run().catch((error) => {
    global.fetch = originalFetch;
    console.error(error);
    process.exit(1);
});
