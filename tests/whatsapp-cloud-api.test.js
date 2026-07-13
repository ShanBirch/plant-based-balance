const assert = require('assert');

const webhook = require('../netlify/functions/whatsapp-webhook')._test;
const sender = require('../netlify/functions/send-whatsapp-reply')._test;

const events = webhook.inboundEvents({
    entry: [{
        changes: [{
            field: 'messages',
            value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '123', display_phone_number: '+61 400 000 000' },
                contacts: [{ wa_id: '61400111222', profile: { name: 'Nat Example' } }],
                messages: [
                    { id: 'wamid.test', from: '61400111222', timestamp: '1784000000', type: 'text', text: { body: 'Hello from WhatsApp' } },
                    { id: 'wamid.image', from: '61400111222', timestamp: '1784000001', type: 'image', image: { caption: 'Meal prep done' } },
                ],
            },
        }],
    }],
});

assert.strictEqual(events.length, 2, 'only WhatsApp message events should be parsed');
assert.deepStrictEqual(events[0], {
    messageId: 'wamid.test',
    waId: '61400111222',
    profileName: 'Nat Example',
    text: 'Hello from WhatsApp',
    receivedAt: '2026-07-14T03:33:20.000Z',
    phoneNumberId: '123',
    displayPhoneNumber: '+61 400 000 000',
    type: 'text',
});
assert.strictEqual(events[1].text, 'Meal prep done', 'media captions should be surfaced in the inbox');
assert.strictEqual(sender.customerWindowOpen({ whatsapp_customer_service_window_ends_at: '2026-07-14T12:00:01.000Z' }, Date.parse('2026-07-14T12:00:00.000Z')), true);
assert.strictEqual(sender.customerWindowOpen({ whatsapp_customer_service_window_ends_at: '2026-07-14T12:00:00.000Z' }, Date.parse('2026-07-14T12:00:00.000Z')), false);
assert.strictEqual(sender.customerWindowOpen({}, Date.now()), false, 'missing timestamps must fail closed');
assert.deepStrictEqual(sender.withoutSendClaim({ one: 1, send_claim_id: 'claim', send_claim_at: 'now' }), { one: 1 });

console.log('WhatsApp Cloud API tests passed');
