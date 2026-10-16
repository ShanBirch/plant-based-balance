import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverRequestedBookingNotifications } from '../netlify/functions/balance-booking.mts';

async function scenario({ existing = false, loseClaim = false, throwSend = false,
    reconciled = true, expired = false, reject = false } = {}) {
    const oldFetch = globalThis.fetch;
    const oldNetlify = globalThis.Netlify;
    const config = { SUPABASE_URL: 'https://fixture.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture',
        RESEND_API_KEY: 'fixture', BOOKING_EMAIL_FROM: 'Balance <fixture@example.com>',
        BOOKING_NOTIFY_EMAIL: 'coach@example.com' };
    globalThis.Netlify = { env: { get: name => config[name] || '' } };
    let booking = { id: 'fixture-booking', name: 'Test', email: 'fixture@example.com', phone: '0400000000',
        starts_at: new Date(Date.now() + 4 * 3600000).toISOString(), timezone: 'Australia/Brisbane',
        call_type: 'video', meeting_url: 'https://meet.google.com/test', updated_at: '2026-10-16T00:00:00Z',
        confirmation_email_sent_at: existing ? '2026-10-16T00:01:00Z' : null,
        metadata: { source: 'plant_based_challenge', ...(existing ? { coach_notification_email_sent_at: 'saved' } : {}),
            notification_recovery: { state: 'requested', deliveryReconciled: reconciled,
                expiresAt: new Date(Date.now() + (expired ? -1 : 3600000)).toISOString() } } };
    const emails = [];
    let creates = 0;
    globalThis.fetch = async (url, options = {}) => {
        const target = String(url);
        if (target.includes('api.resend.com')) {
            if (throwSend) throw new Error('uncertain network result');
            emails.push({ body: JSON.parse(options.body), key: options.headers['Idempotency-Key'] });
            return Response.json({}, { status: reject ? 422 : 200 });
        }
        if (target.includes('balance_booking_settings')) return Response.json([]);
        if (target.includes('balance_bookings')) {
            if (options.method === 'POST') { creates += 1; throw new Error('must not create booking'); }
            if (options.method === 'PATCH') {
                if (loseClaim) return Response.json([]);
                booking = { ...booking, ...JSON.parse(options.body) };
                return Response.json([booking]);
            }
            return Response.json(booking.metadata.notification_recovery.state === 'requested' ? [booking] : []);
        }
        throw new Error('Unexpected request');
    };
    try {
        const first = await recoverRequestedBookingNotifications();
        const second = await recoverRequestedBookingNotifications();
        assert.equal(creates, 0);
        return { first, second, booking, emails };
    } finally { globalThis.fetch = oldFetch; globalThis.Netlify = oldNetlify; }
}

test('explicit reconciled recovery sends both emails once without another appointment', async () => {
    const result = await scenario();
    assert.equal(result.first[0].state, 'completed');
    assert.deepEqual(result.emails.map(email => email.key), [
        'booking-confirmation-fixture-booking', 'booking-coach-fixture-booking',
    ]);
    assert.match(result.emails[0].body.html, /balanceneurosciencefitness.com\/pre-call.html/);
    assert.equal(result.booking.metadata.source, 'plant_based_challenge');
    assert.ok(result.booking.confirmation_email_sent_at);
    assert.deepEqual(result.second, []);
});

test('expired, unreconciled or lost recovery claims send nothing', async () => {
    for (const options of [{ expired: true }, { reconciled: false }, { loseClaim: true }]) {
        assert.deepEqual((await scenario(options)).emails, []);
    }
});

test('existing email receipts are preserved without repeat sends', async () => {
    const result = await scenario({ existing: true });
    assert.deepEqual(result.emails, []);
    assert.equal(result.first[0].state, 'completed');
});

test('rejection or uncertain delivery remains terminal instead of automatically retrying', async () => {
    for (const options of [{ reject: true }, { throwSend: true }]) {
        const result = await scenario(options);
        assert.equal(result.first[0].state, options.throwSend ? 'uncertain_no_repeat' : 'failed');
        assert.deepEqual(result.second, []);
    }
});
