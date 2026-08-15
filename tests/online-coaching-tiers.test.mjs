import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CheckoutGuardError,
    getBalanceCheckoutPlan,
} from '../netlify/edge-functions/lib/checkout-guard.js';

const tiers = [
    {
        token: 'balance_online_coaching_6_month_weekly',
        amount: 2999,
        plan: 'online_coaching_6_month',
        weeks: 26,
    },
    {
        token: 'balance_online_coaching_3_month_weekly',
        amount: 4999,
        plan: 'online_coaching_3_month',
        weeks: 13,
    },
    {
        token: 'balance_online_coaching_month_to_month_weekly',
        amount: 7499,
        plan: 'online_coaching_month_to_month',
        weeks: 4,
    },
];

test('online coaching tier tokens preserve their price and initial commitment', () => {
    for (const expected of tiers) {
        const actual = getBalanceCheckoutPlan(expected.token);
        assert.equal(actual.unitAmount, expected.amount);
        assert.equal(actual.balancePlan, expected.plan);
        assert.equal(actual.commitmentWeeks, expected.weeks);
        assert.equal(actual.interval, 'week');
        assert.equal(actual.mode, 'subscription');
        assert.match(actual.checkoutDisclosure, /billed weekly/i);
        assert.match(actual.checkoutDisclosure, /initial minimum/i);
    }
});

test('retired uncommitted starter token is not accepted by checkout', () => {
    assert.throws(
        () => getBalanceCheckoutPlan('balance_starter_coaching_weekly'),
        error => error instanceof CheckoutGuardError && error.message === 'Invalid checkout plan.'
    );
});
