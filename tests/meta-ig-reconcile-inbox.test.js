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

console.log('meta ig reconcile inbox tests passed');
