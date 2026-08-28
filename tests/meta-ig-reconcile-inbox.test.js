const assert = require('assert');

const { _test: reconcileTest } = require('../netlify/functions/meta-ig-reconcile-inbox');
const { _test: webhookTest } = require('../netlify/functions/instagram-webhook');

const payload = reconcileTest.buildWebhookPayloadFromMessages({
    accountId: '17841499999999999',
    messages: [{
        id: 'inbound_mid',
        created_time: '2026-05-25T01:02:03+0000',
        from: { id: '555222111', username: 'plant_lead' },
        to: { data: [{ id: '17841499999999999' }] },
        message: 'sounds good',
        attachments: {
            data: [{
                type: 'image',
                image_data: { url: 'https://lookaside.fbsbx.com/ig_messaging_cdn/photo.jpg' },
            }],
        },
    }, {
        id: 'outbound_mid',
        created_time: '2026-05-25T01:03:03+0000',
        from: { id: '17841499999999999', username: 'cocos_pt_studio' },
        to: { data: [{ id: '555222111', username: 'plant_lead' }] },
        message: 'nice, keen to help',
    }],
});

assert.strictEqual(payload.object, 'instagram');
assert.strictEqual(payload.entry.length, 1);
assert.strictEqual(payload.entry[0].id, '17841499999999999');
assert.strictEqual(payload.entry[0].messaging.length, 2);

const inbound = payload.entry[0].messaging[0];
assert.strictEqual(inbound.sender.id, '555222111');
assert.strictEqual(inbound.sender.username, 'plant_lead');
assert.strictEqual(inbound.recipient.id, '17841499999999999');
assert.strictEqual(inbound.message.mid, 'inbound_mid');
assert.strictEqual(inbound.message.text, 'sounds good');
assert.strictEqual(inbound.message.attachments[0].payload.url, 'https://lookaside.fbsbx.com/ig_messaging_cdn/photo.jpg');

const outbound = payload.entry[0].messaging[1];
assert.strictEqual(outbound.sender.id, '17841499999999999');
assert.strictEqual(outbound.recipient.id, '555222111');
assert.strictEqual(outbound.recipient.username, 'plant_lead');
assert.strictEqual(outbound.message.is_echo, true);

assert.strictEqual(
    reconcileTest.messageIsRecent({ created_time: '2026-05-25T01:00:00+0000' }, Date.parse('2026-05-25T00:00:00+0000')),
    true
);
assert.strictEqual(
    reconcileTest.messageIsRecent({ created_time: '2026-05-24T23:59:59+0000' }, Date.parse('2026-05-25T00:00:00+0000')),
    false
);

assert.strictEqual(
    reconcileTest.isScheduledInvocation({ headers: { 'x-nf-event': 'schedule' } }, {}),
    true
);
assert.strictEqual(
    reconcileTest.isScheduledInvocation({}, { next_run: '2026-05-29T03:50:00.000Z' }),
    true
);
assert.strictEqual(
    webhookTest.timestampIsoFromMessaging({ item: { timestamp: Date.parse('2026-05-25T01:02:03.000Z'), message: { mid: 'one', text: 'hi' } }, value: {} }),
    '2026-05-25T01:02:03.000Z'
);
assert.strictEqual(
    webhookTest.timestampIsoFromMessaging({ item: { message: { created_time: '2026-05-25T01:02:03+0000' } }, value: {} }),
    '2026-05-25T01:02:03.000Z'
);
assert.strictEqual(webhookTest.alertNeedsDraftRecovery({
    status: 'pending',
    suggested_message: null,
    data: { draft_text: '', draft_error: 'draft_generation_pending' },
}), true);
assert.strictEqual(webhookTest.alertNeedsDraftRecovery({
    status: 'pending',
    suggested_message: 'yeah absolutely',
    data: { draft_text: 'yeah absolutely' },
}), false);
assert.strictEqual(webhookTest.alertNeedsDraftRecovery({
    status: 'sent',
    suggested_message: null,
    data: { draft_text: '' },
}), false);
assert.strictEqual(webhookTest.shouldRecoverDedupedInboundAgainstAlerts({
    exactAlerts: [],
    activeAlerts: [{ id: 'earlier-paid-meta-alert', status: 'pending' }],
    allowActiveAlertCoalesce: true,
}), true, 'a new paid-Meta mirror duplicate must still join the active rapid-message batch');
assert.strictEqual(webhookTest.shouldRecoverDedupedInboundAgainstAlerts({
    exactAlerts: [{ status: 'sent', suggested_message: 'Already sent', data: {} }],
    activeAlerts: [],
    allowActiveAlertCoalesce: true,
}), false, 'the exact same paid-Meta inbound must never be drafted twice');
assert.strictEqual(webhookTest.shouldRecoverDedupedInboundAgainstAlerts({
    exactAlerts: [],
    activeAlerts: [{ id: 'ordinary-active-alert', status: 'pending' }],
    allowActiveAlertCoalesce: false,
}), false, 'ordinary recovery behavior remains unchanged outside paid Meta');

assert.deepStrictEqual(
    reconcileTest.sortAccountsByRecentActivity([
        { ownerId: 'older', lastActivityAt: '2026-07-25T01:00:00.000Z' },
        { ownerId: 'configured-without-activity' },
        { ownerId: 'fresh', lastActivityAt: '2026-07-25T21:17:46.000Z' },
    ]).map(account => account.ownerId),
    ['fresh', 'older', 'configured-without-activity'],
    'the inbox account with the newest live DM must be polled before quiet configured accounts'
);
assert.strictEqual(
    reconcileTest.newestIso('2026-07-25T20:00:00.000Z', '2026-07-25T21:17:46.000Z'),
    '2026-07-25T21:17:46.000Z'
);

(async () => {
    const collected = await reconcileTest.collectRecentConversationMessages({
        conversations: [
            { id: 'stale-inaccessible', updated_time: '2026-07-25T22:10:00.000Z' },
            { id: 'krish-valid', updated_time: '2026-07-25T21:17:46.000Z' },
        ],
        token: 'test-token',
        messageLimit: 12,
        maxMessages: 40,
        cutoffMs: Date.parse('2026-07-24T22:00:00.000Z'),
        startedAt: 0,
        now: () => 1,
        fetchMessages: async ({ conversationId }) => {
            if (conversationId === 'stale-inaccessible') throw new Error('Graph 400 unsupported object');
            return [{ id: 'krish-yo', created_time: '2026-07-25T21:17:46.000Z', message: 'Yo' }];
        },
    });
    assert.strictEqual(collected.conversationsScanned, 2);
    assert.strictEqual(collected.errors.length, 1, 'one inaccessible conversation is recorded');
    assert.deepStrictEqual(collected.replayMessages.map(message => message.id), ['krish-yo'], 'later valid DMs still replay');

    let inlineFallbackCalls = 0;
    const inlineCollected = await reconcileTest.collectRecentConversationMessages({
        conversations: [{
            id: 'inline-conversation',
            updated_time: '2026-07-25T21:17:46.000Z',
            messages: { data: [{ id: 'inline-yo', created_time: '2026-07-25T21:17:46.000Z', message: 'Yo' }] },
        }],
        token: 'test-token',
        messageLimit: 12,
        maxMessages: 40,
        cutoffMs: Date.parse('2026-07-24T22:00:00.000Z'),
        startedAt: 0,
        now: () => 1,
        fetchMessages: async () => {
            inlineFallbackCalls += 1;
            return [];
        },
    });
    assert.strictEqual(inlineFallbackCalls, 0, 'inline conversation messages avoid slow per-thread Graph calls');
    assert.deepStrictEqual(inlineCollected.replayMessages.map(message => message.id), ['inline-yo']);

    let replayPayload = null;
    const provided = await reconcileTest.processProvidedReplay({
        replay_account_id: '17841415641641750',
        replay_messages: [{
            id: 'krish-yo',
            created_time: '2026-07-25T21:17:46.000Z',
            from: { id: '943978798707085', username: 'krishhh.dutt' },
            to: { data: [{ id: '17841415641641750' }] },
            message: 'Yo',
        }],
    }, async payload => {
        replayPayload = payload;
        return { processed: 1, inserted: 1, drafted: 1 };
    });
    assert.strictEqual(provided.ok, true);
    assert.strictEqual(provided.provided_replay, true);
    assert.strictEqual(replayPayload.entry[0].messaging[0].message.mid, 'krish-yo');
    assert.strictEqual(replayPayload.entry[0].messaging[0].sender.username, 'krishhh.dutt');
    console.log('meta ig reconcile inbox tests passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
