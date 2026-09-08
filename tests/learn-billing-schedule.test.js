const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../netlify/edge-functions');
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const guardUrl = url(fs.readFileSync(path.join(root, 'lib/checkout-guard.js'), 'utf8'));
const load = file => import(url(fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/(['"])(?:\.\/)?lib\/checkout-guard.js\1|(['"])\.\/checkout-guard.js\2/g, JSON.stringify(guardUrl))));

function mockStripe() {
    const start = Math.floor(Date.now() / 1000) - 60;
    const subscription = { id: 'sub_qa', status: 'active', start_date: start,
        metadata: { balance_plan: 'balance_learn_weekly', checkout_email: 'qa@example.com' },
        items: { data: [{ quantity: 1, price: { id: 'price_weekly', product: 'prod_learn', unit_amount: 2483, currency: 'aud', recurring: { interval: 'week', interval_count: 1 } } }] } };
    const calls = [];
    const schedule = { id: 'sub_sched_qa', metadata: {} };
    const stripe = { subscriptions: { retrieve: async () => subscription }, subscriptionSchedules: {
        create: async (params, options) => { calls.push(['create', params, options]); subscription.schedule = schedule.id; return schedule; },
        retrieve: async () => schedule,
        update: async (id, params, options) => { calls.push(['update', params, options]); Object.assign(schedule, params); subscription.metadata = params.phases[0].metadata; return schedule; },
    } };
    return { stripe, subscription, calls, schedule };
}

test('six weekly payments transition after 42 days to four-week billing, without proration', async () => {
    const { ensureLearnBillingSchedule } = await load('lib/learn-billing-schedule.js');
    const { stripe, subscription, calls } = mockStripe();
    await ensureLearnBillingSchedule(stripe, subscription);
    const params = calls[1][1];
    assert.equal(params.phases[0].end_date - params.phases[0].start_date, 42 * 86400);
    assert.equal(params.phases[1].start_date, params.phases[0].end_date);
    assert.equal(params.phases[1].items[0].price_data.unit_amount, 9932);
    assert.deepEqual(params.phases[1].items[0].price_data.recurring, { interval: 'week', interval_count: 4 });
    assert.equal(params.end_behavior, 'release');
    assert.equal(params.proration_behavior, 'none');
    assert.equal(params.phases[1].metadata.checkout_email, 'qa@example.com');
    await ensureLearnBillingSchedule(stripe, subscription);
    assert.equal(calls.length, 2, 'duplicate delivery must not create another schedule');
});

test('schedule update failure is retryable and resumes the existing schedule', async () => {
    const { ensureLearnBillingSchedule } = await load('lib/learn-billing-schedule.js');
    const { stripe, subscription, calls } = mockStripe();
    const update = stripe.subscriptionSchedules.update;
    stripe.subscriptionSchedules.update = async () => { throw new Error('temporary failure'); };
    await assert.rejects(ensureLearnBillingSchedule(stripe, subscription), error => error.balanceScheduleFailure === true);
    stripe.subscriptionSchedules.update = update;
    await ensureLearnBillingSchedule(stripe, subscription);
    assert.equal(calls.filter(call => call[0] === 'create').length, 1);
    assert.match(calls[0][2].idempotencyKey, /sub_qa/);
});

test('cancelled subscriptions and unrelated plans cannot have their schedules recreated', async () => {
    const { ensureLearnBillingSchedule } = await load('lib/learn-billing-schedule.js');
    for (const changes of [{ cancel_at_period_end: true }, { status: 'canceled' }, { metadata: { balance_plan: 'online_coaching_6_month' } }]) {
        const { stripe, subscription, calls } = mockStripe();
        Object.assign(subscription, changes);
        await ensureLearnBillingSchedule(stripe, subscription);
        assert.equal(calls.length, 0);
    }
});

test('hosted Checkout uses the weekly amount while the upfront price remains unchanged', async () => {
    const { getBalanceCheckoutPlan } = await import(guardUrl);
    const { createStripeCheckoutSession } = await load('create-checkout-session.js');
    const originalFetch = global.fetch;
    const requests = [];
    global.fetch = async (_, options) => { requests.push(options.body); return { ok: true, json: async () => ({ id: 'cs_test_qa' }) }; };
    try {
        for (const token of ['balance_learn_weekly', 'balance_meta_foundations_pass']) {
            await createStripeCheckoutSession('test-placeholder', { plan: getBalanceCheckoutPlan(token), successUrl: 'https://example.com/success', cancelUrl: 'https://example.com/cancel' });
        }
        assert.equal(requests[0].get('mode'), 'subscription');
        assert.equal(requests[0].get('line_items[0][price_data][unit_amount]'), '2483');
        assert.match(requests[0].get('custom_text[submit][message]'), /six-week minimum/);
        assert.equal(requests[1].get('mode'), 'payment');
        assert.equal(requests[1].get('line_items[0][price_data][unit_amount]'), '14900');
    } finally { global.fetch = originalFetch; }
});


test('Learn cancellation releases future phases and stops at the paid period end', async () => {
    const source = fs.readFileSync(path.join(root, 'cancel-subscription.js'), 'utf8')
        .replace('import { createClient } from "@supabase/supabase-js";', 'const createClient = globalThis.__learnTestClient;');
    const originalFetch = global.fetch;
    const originalNetlify = global.Netlify;
    const periodEnd = Math.floor(Date.now() / 1000) + 6 * 86400;
    const sub = { id: 'sub_qa', status: 'active', schedule: 'sub_sched_qa', metadata: { balance_plan: 'balance_learn_weekly' }, items: { data: [{ current_period_end: periodEnd }] } };
    const writes = [];
    global.Netlify = { env: { get: () => 'test-placeholder' } };
    global.__learnTestClient = () => ({ auth: { getUser: async () => ({ data: { user: { id: 'qa' } } }) },
        from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'qa', stripe_customer_id: 'cus_qa' } }) }) }) }) });
    global.fetch = async (url, options) => {
        if (options.method === 'GET') return { ok: true, json: async () => ({ data: [sub] }) };
        writes.push({ url, params: options.body });
        return { ok: true, json: async () => ({ ...sub, cancel_at_period_end: true }) };
    };
    try {
        const { default: cancel, _test } = await import(url(source));
        const timing = _test.cancellationTiming(sub, Math.floor(Date.now() / 1000));
        assert.equal(timing.effectiveAt, periodEnd);
        assert.equal(timing.noticeDays, 0);
        assert.equal(_test.subscriptionSummary(sub).pauseAvailable, false);
        const response = await cancel(new Request('https://plantbased-balance.org/cancel', { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', confirmation: 'CANCEL' }) }));
        assert.equal(response.status, 200);
        assert.match(writes[0].url, /subscription_schedules\/sub_sched_qa\/release$/);
        assert.equal(writes[1].params.get('cancel_at_period_end'), 'true');
        assert.equal(writes[1].params.has('cancel_at'), false);
    } finally { global.fetch = originalFetch; global.Netlify = originalNetlify; delete global.__learnTestClient; }
});


test('new Learn purchases remain weekly without creating a four-week schedule', async () => {
    const { getBalanceCheckoutPlan } = await import(guardUrl);
    const offer = getBalanceCheckoutPlan('balance_learn_weekly');
    assert.equal(offer.unitAmount, 2483);
    assert.equal(offer.interval, 'week');
    assert.equal(offer.commitmentWeeks, 6);
    assert.equal(offer.renewalUnitAmount, undefined);
    const { ensureLearnBillingSchedule } = await load('lib/learn-billing-schedule.js');
    const { stripe, subscription, calls } = mockStripe();
    subscription.metadata.renewal_terms = offer.renewalTerms;
    await ensureLearnBillingSchedule(stripe, subscription);
    assert.equal(calls.length, 0);
});

test('new Learn cancellation respects six weeks, then the current paid boundary', async () => {
    const source = fs.readFileSync(path.join(root, 'cancel-subscription.js'), 'utf8')
        .replace('import { createClient } from "@supabase/supabase-js";', 'const createClient = () => {};');
    const { _test } = await import(url(source));
    const week = 7 * 86400;
    const start = 1800000000;
    const sub = { start_date: start, created: start - 60, metadata: { balance_plan: 'balance_learn_weekly', commitment_weeks: '6' }, items: { data: [{ current_period_end: start + week }] } };
    assert.equal(_test.cancellationTiming(sub, start + 3600).effectiveAt, start + 6 * week);
    sub.items.data[0].current_period_end = start + 8 * week;
    assert.equal(_test.cancellationTiming(sub, start + 7 * week + 3600).effectiveAt, start + 8 * week);
    assert.equal(_test.cancellationTiming(sub, start + 3600).noticeDays, 0);
});
