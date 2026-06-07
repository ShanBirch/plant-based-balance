const assert = require('assert');

const instagramAction = require('../netlify/functions/send-instagram-graph-action')._test;

assert.strictEqual(
    instagramAction.isAlertCapabilityReactionRequest({
        admin: { ok: false, error: 'missing_admin_token' },
        action: 'react',
        alertId: 'alert-1',
        body: { alertId: 'alert-1', reaction: 'love', resolveAlert: true },
    }),
    true,
    'cron alertId reaction requests can use alert capability auth'
);

assert.strictEqual(
    instagramAction.isAlertCapabilityReactionRequest({
        admin: { ok: false, error: 'missing_admin_token' },
        action: 'mark_seen',
        alertId: 'alert-1',
        body: { alertId: 'alert-1' },
    }),
    false,
    'alert capability auth does not allow mark_seen'
);

assert.strictEqual(
    instagramAction.shouldSendSeenReceiptAfterAction('react'),
    true,
    'reaction-only closes should also send a seen receipt'
);

assert.strictEqual(
    instagramAction.shouldSendSeenReceiptAfterAction('unreact'),
    false,
    'unreact does not need a seen receipt'
);

const reactionState = instagramAction.buildNextThreadActionCustomData({
    thread: {
        custom_data: {
            instagram_graph: { ig_graph_user_id: 'recipient-1' },
            instagram_graph_actions: {
                messages: {
                    'msg-1': { reaction: null },
                },
            },
        },
    },
    graphMessageId: 'msg-1',
    localMessageId: 'local-1',
    action: 'react',
    reaction: 'love',
    adminUserId: 'alert_capability',
    source: 'auto_like_no_reply',
    nowIso: '2026-06-07T11:00:00.000Z',
    seenAtIso: '2026-06-07T11:00:01.000Z',
});

assert.strictEqual(
    reactionState.instagram_graph.last_mark_seen_at,
    '2026-06-07T11:00:01.000Z',
    'reaction state should persist the automatic seen timestamp'
);
assert.strictEqual(
    reactionState.instagram_graph_actions.last_mark_seen_source,
    'auto_like_no_reply',
    'reaction state should preserve the source for the automatic seen receipt'
);
assert.strictEqual(
    reactionState.instagram_graph_actions.messages['msg-1'].reaction,
    'love',
    'reaction state should still persist the message reaction'
);

assert.strictEqual(
    instagramAction.isAlertCapabilityReactionRequest({
        admin: { ok: false, error: 'missing_admin_token' },
        action: 'react',
        alertId: '',
        body: { reaction: 'love' },
    }),
    false,
    'alert capability auth requires an alert id'
);

assert.strictEqual(
    instagramAction.isAlertCapabilityReactionRequest({
        admin: { ok: false, error: 'invalid_admin_token' },
        action: 'react',
        alertId: 'alert-1',
        body: { alertId: 'alert-1' },
    }),
    false,
    'invalid bearer tokens do not fall back to alert capability auth'
);

assert.strictEqual(
    instagramAction.isAlertCapabilityReactionRequest({
        admin: { ok: false, error: 'missing_admin_token' },
        action: 'react',
        alertId: 'alert-1',
        body: { alertId: 'alert-1', messageId: 'message-1' },
    }),
    false,
    'alert capability auth cannot target arbitrary message ids'
);

console.log('send instagram graph action capability tests passed');
