import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getSlotOffer, bookSelectedSlot } from '../scripts/balance-dm-call-booking.mjs';
import relaunch from '../netlify/functions/_lib/summer-ready-relaunch.js';
import challenge from '../netlify/functions/_lib/plant-based-challenge-dm.js';

const now = Date.parse('2026-10-16T00:00:00Z');
const startsAt = '2026-10-17T00:00:00.000Z';
const slot = { start: startsAt, end: '2026-10-17T01:00:00.000Z' };
const availability = { ok: true, bookingEnabled: true, calendarConnected: true,
    calendarReconnectRequired: false, calendarConnectionIssue: false, durationMinutes: 60,
    dates: [{ slots: [slot, slot] }] };
const require = createRequire(import.meta.url);

function input() {
    return { actionId: '11111111-1111-4111-8111-111111111111',
        threadId: '22222222-2222-4222-8222-222222222222',
        sourceMessageId: '33333333-3333-4333-8333-333333333333',
        ownershipVerified: true, selectionConfirmed: true, contactConfirmed: true,
        name: 'Test Prospect', email: 'fixture@example.com', phone: '0400000000',
        timezone: 'Australia/Brisbane', callType: 'phone', startsAt,
        offer: { checkedAt: new Date(now).toISOString(), timezone: 'Australia/Brisbane',
            options: [{ ...slot, timezone: 'Australia/Brisbane' }] },
        goal: 'Build a consistent exercise routine', attribution: { ad_id: 'fixture-ad' } };
}

test('offers require healthy authoritative availability and label the recipient timezone', async () => {
    const result = await getSlotOffer({ timezone: 'Australia/Sydney', now,
        fetchImpl: async () => Response.json(availability) });
    assert.equal(result.options.length, 1);
    assert.equal(result.options[0].timezone, 'Australia/Sydney');
    assert.match(result.options[0].label, /11:00 am/i);
    for (const change of [{ calendarConnected: false }, { bookingEnabled: false },
        { calendarReconnectRequired: true }, { calendarConnectionIssue: true }]) {
        await assert.rejects(getSlotOffer({ timezone: 'Australia/Brisbane', now,
            fetchImpl: async () => Response.json({ ...availability, ...change }) }), /unavailable/);
    }
    await assert.rejects(getSlotOffer({ timezone: 'invented/timezone', now }), /Invalid time zone/);
});

test('booking rechecks the slot, uses existing email/form transport and does not duplicate an action', async () => {
    const receiptsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-call-test-'));
    let postCount = 0;
    const fetchImpl = async (url, options) => {
        if (options.method !== 'POST') return Response.json(availability);
        postCount += 1;
        const body = JSON.parse(options.body);
        assert.equal(body.source, 'plant_based_challenge');
        assert.equal(body.callType, 'phone');
        assert.equal(body.attribution.ad_id, 'fixture-ad');
        return Response.json({ ok: true, booking: { id: 'fixture-booking', startsAt,
            timezone: 'Australia/Brisbane', callType: 'phone' },
        calendarEventCreated: true, confirmationEmailSent: true }, { status: 201 });
    };
    try {
        const first = await bookSelectedSlot(input(), { receiptsDir, fetchImpl, now });
        assert.equal(first.status, 'confirmed');
        assert.equal(first.confirmationEmailSent, true);
        const second = await bookSelectedSlot(input(), { receiptsDir, fetchImpl, now: now + 900000 });
        assert.equal(second.reusedReceipt, true);
        assert.equal(postCount, 1);
        assert.doesNotMatch(JSON.stringify(first), /fixture@example|0400000000/);
        await assert.rejects(bookSelectedSlot({ ...input(), startsAt: '2026-10-18T00:00:00Z' },
            { receiptsDir, fetchImpl, now }), /different booking/);
    } finally { await fs.rm(receiptsDir, { recursive: true }); }
});

test('unknown send outcomes are durable no-repeat, not automatic booking retries', async () => {
    const receiptsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-call-test-'));
    let posts = 0;
    const fetchImpl = async (url, options) => {
        if (options.method !== 'POST') return Response.json(availability);
        posts += 1;
        throw new Error('simulated timeout after remote acceptance');
    };
    try {
        assert.equal((await bookSelectedSlot(input(), { receiptsDir, fetchImpl, now })).status, 'uncertain_no_repeat');
        assert.equal((await bookSelectedSlot(input(), { receiptsDir, fetchImpl, now })).status, 'uncertain_no_repeat');
        assert.equal(posts, 1);
    } finally { await fs.rm(receiptsDir, { recursive: true }); }
});

test('missing consent, stale offers and unavailable slots cannot create appointments', async () => {
    const receiptsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-call-test-'));
    let posts = 0;
    const fetchImpl = async (url, options) => { if (options.method === 'POST') posts += 1;
        return Response.json({ ...availability, dates: [] }); };
    try {
        for (const change of [{ selectionConfirmed: false }, { ownershipVerified: false },
            { contactConfirmed: false }, { callType: 'unknown' }, { timezone: 'Australia/Sydney' },
            { offer: { ...input().offer, checkedAt: new Date(now - 360000).toISOString() } }]) {
            await assert.rejects(bookSelectedSlot({ ...input(), ...change }, { receiptsDir, fetchImpl, now }));
        }
        await assert.rejects(bookSelectedSlot(input(), { receiptsDir, fetchImpl, now }), /no longer available/);
        assert.equal(posts, 0);
    } finally { await fs.rm(receiptsDir, { recursive: true }); }
});

test('partial calendar and email outcomes never become complete confirmation claims', async () => {
    const receiptsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-call-test-'));
    const fetchImpl = async (url, options) => options.method !== 'POST' ? Response.json(availability)
        : Response.json({ ok: true, booking: { id: 'fixture-booking', startsAt,
            timezone: 'Australia/Brisbane', callType: 'phone' },
        calendarEventCreated: false, confirmationEmailSent: false }, { status: 201 });
    try {
        const receipt = await bookSelectedSlot(input(), { receiptsDir, fetchImpl, now });
        assert.equal(receipt.status, 'booking_recorded_calendar_pending');
        assert.equal(receipt.confirmationEmailSent, false);
    } finally { await fs.rm(receiptsDir, { recursive: true }); }
});

test('concurrent claims for one action cannot create two appointments', async () => {
    const receiptsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-call-test-'));
    let posts = 0;
    const fetchImpl = async (url, options) => {
        if (options.method !== 'POST') return Response.json(availability);
        posts += 1;
        return Response.json({ ok: true, booking: { id: 'fixture-booking', startsAt,
            timezone: 'Australia/Brisbane', callType: 'phone' },
        calendarEventCreated: true, confirmationEmailSent: true }, { status: 201 });
    };
    try {
        const results = await Promise.allSettled([
            bookSelectedSlot(input(), { receiptsDir, fetchImpl, now }),
            bookSelectedSlot(input(), { receiptsDir, fetchImpl, now }),
        ]);
        assert.ok(results.some(result => result.status === 'fulfilled'));
        assert.equal(posts, 1);
    } finally { await fs.rm(receiptsDir, { recursive: true }); }
});

test('relaunch writer and review share the paired-opening, neutral offer and verified-slot contract', () => {
    const policy = relaunch.buildSummerReadyRelaunchPolicy();
    assert.match(policy, /AUD \$125\/week for ten weeks/);
    assert.match(policy, /supervised training/);
    assert.match(policy, /motivation, nutrition and exercise/);
    assert.match(policy, /two-question opening/);
    assert.match(policy, /if both are known, skip both/i);
    assert.match(policy, /timeout or uncertain result is no-repeat/i);
    const prompt = challenge.buildChallengeLeadPrompt({ currentMessage: 'Tell me about the program' });
    assert.ok(prompt.includes(policy));
    assert.doesNotMatch(prompt, /challenge starting 5 October 2026 with plant-based meal guidance/);
    assert.deepEqual(challenge.collectChallengeLeadIssues({ currentMessage: 'Yes please',
        history: [{ direction: 'out', text: 'Would you like a call?' }],
        draft: { joined: 'Which timezone should I use for the available times?' } }), []);
});

test('compatibility writer permits the scoped paired opening and missing contact collection', () => {
    const check = require('../netlify/functions/ig-instant-draft')._test.collectPaidMetaWriterContractIssues;
    assert.deepEqual(check({ flowVariant: 'plant_based_challenge', currentMessage: 'Tell me about the program',
        history: [], draft: { joined: 'It is a ten-week challenge with written programs and one Zoom session each week.\n\nWhat are you hoping to achieve? What does your current exercise routine look like?' } }), []);
    assert.deepEqual(check({ flowVariant: 'plant_based_challenge', currentMessage: 'Saturday at 10am Brisbane time works. Phone please.',
        history: [{ direction: 'out', text: 'Would a phone consultation suit you?' }],
        draft: { joined: 'What email and mobile number should I use for your booking confirmation?' } }), []);
});
