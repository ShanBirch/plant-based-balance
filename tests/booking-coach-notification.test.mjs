import test from 'node:test';
import assert from 'node:assert/strict';
import { sendCoachBookingNotification } from '../netlify/functions/balance-booking.mts';

test('coach receives a separate idempotent booking alert labelled in Brisbane time', async () => {
    const previousFetch = globalThis.fetch;
    const previousNetlify = globalThis.Netlify;
    const config = { RESEND_API_KEY: 'fixture', BOOKING_EMAIL_FROM: 'Balance <sender@example.com>',
        BOOKING_NOTIFY_EMAIL: 'coach@example.com' };
    globalThis.Netlify = { env: { get: name => config[name] || '' } };
    let sent;
    globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://api.resend.com/emails');
        sent = JSON.parse(options.body);
        assert.equal(options.headers['Idempotency-Key'], 'booking-coach-fixture-booking');
        return Response.json({ id: 'fixture-email' });
    };
    try {
        const booking = { id: 'fixture-booking', name: 'Test', email: 'lead@example.com',
            phone: '0400000000', starts_at: '2026-10-16T07:00:00Z', call_type: 'video',
            meeting_url: 'https://meet.google.com/example', calendar_event_id: 'fixture-event' };
        assert.equal(await sendCoachBookingNotification(booking), true);
        assert.deepEqual(sent.to, ['coach@example.com']);
        assert.match(sent.text, /Brisbane time/);
        assert.match(sent.text, /5:00/);
        assert.match(sent.text, /meet.google.com\/example/);
        delete config.BOOKING_NOTIFY_EMAIL;
        assert.equal(await sendCoachBookingNotification(booking), false);
        config.BOOKING_NOTIFY_EMAIL = 'coach@example.com';
        globalThis.fetch = async () => Response.json({ error: 'rejected' }, { status: 422 });
        assert.equal(await sendCoachBookingNotification(booking), false);
    } finally {
        globalThis.fetch = previousFetch;
        globalThis.Netlify = previousNetlify;
    }
});
