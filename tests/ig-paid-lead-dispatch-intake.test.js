const assert = require('node:assert/strict');
const test = require('node:test');
const { registerPaidLeadDispatch } = require('../netlify/functions/_lib/ig-paid-lead-dispatch-intake');
const { mergeGraphCustomData } = require('../netlify/functions/instagram-webhook')._test;
const nowIso = '2026-09-12T03:00:00.000Z';
const paid = { bot_account: 'shan_n_sunny', meta_ad_attribution: { platform_source: 'ADS', source: 'meta_ads', ad_id: 'ad-123' } };

test('registers paid lead without changing conversation permissions or intent', () => {
    const original = { ...paid, manual_review_only: true, arbitrary_memory: { goal: 'strength' } };
    const result = registerPaidLeadDispatch(original, { nowIso });
    assert.equal(result.paid_lead_dispatch.registered_at, nowIso);
    assert.deepEqual(original, { ...paid, manual_review_only: true, arbitrary_memory: { goal: 'strength' } });
    assert.deepEqual(result.arbitrary_memory, original.arbitrary_memory);
    assert.equal(result.manual_review_only, true);
    assert.equal(result.auto_send_enabled, undefined);
    assert.equal(result.lead_stage, undefined);
});

test('retries and later messages preserve registration and dispatcher progress', () => {
    const first = registerPaidLeadDispatch(paid, { nowIso });
    first.paid_lead_dispatch.observed_at = nowIso;
    assert.strictEqual(registerPaidLeadDispatch(first, { nowIso: '2026-09-13T03:00:00Z' }), first);
});

test('does not enroll organic traffic, clients, tests, echoes or other accounts', () => {
    for (const [data, options] of [
        [{ bot_account: 'shan_n_sunny', acquisition_mode: 'paid_meta' }, {}],
        [paid, { linkedUserId: 'client-id' }],
        [paid, { direction: 'out' }],
        [paid, { attributionOnly: true }],
        [paid, { channel: 'facebook' }],
        [{ ...paid, bot_account: 'other_brand' }, {}],
        [{ ...paid, bot_account: null }, {}],
        [{ ...paid, internal_test_auto_reply_enabled: true }, {}],
        [{ ...paid, internal_account: 'true' }, {}],
    ]) assert.strictEqual(registerPaidLeadDispatch(data, { nowIso, ...options }), data);
});

test('Graph ad inbound adds marker; historic attribution survives later messages', () => {
    const options = { participantId: 'person', igAccountId: 'account', nowIso, messageId: 'in-1',
        accountConfig: { botAccount: 'shan_n_sunny' }, direction: 'in' };
    const first = mergeGraphCustomData({}, { ...options, metaAdReferral: paid.meta_ad_attribution });
    assert.equal(first.paid_lead_dispatch.registered_at, nowIso);
    const later = mergeGraphCustomData(first, { ...options, messageId: 'in-2', nowIso: '2026-09-13T03:00:00Z' });
    assert.deepEqual(later.paid_lead_dispatch, first.paid_lead_dispatch);
    const linked = mergeGraphCustomData({}, { ...options, linkedUserId: 'client', metaAdReferral: paid.meta_ad_attribution });
    assert.equal(linked.paid_lead_dispatch, undefined);
});

test('referral alone is not enrollment; subsequent inbound consumes it', () => {
    const options = { participantId: 'person', igAccountId: 'account', nowIso,
        accountConfig: { botAccount: 'shan_n_sunny' }, direction: 'in' };
    const referral = mergeGraphCustomData({}, { ...options, attributionOnly: true, metaAdReferral: paid.meta_ad_attribution });
    assert.equal(referral.paid_lead_dispatch, undefined);
    const inbound = mergeGraphCustomData(referral, { ...options, messageId: 'in-1' });
    assert.equal(inbound.paid_lead_dispatch.registered_at, nowIso);
});
