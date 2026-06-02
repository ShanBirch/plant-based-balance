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
