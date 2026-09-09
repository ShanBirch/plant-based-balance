import test from 'node:test';
import assert from 'node:assert/strict';
import { getBalanceCheckoutPlan } from '../netlify/edge-functions/lib/checkout-guard.js';
test('Learn launch price changes at midnight Brisbane on 9 October for both checkout routes', () => {
    for (const token of ['balance_vegan_founders_pass','balance_meta_foundations_pass']) {
        const before = getBalanceCheckoutPlan(token, '2026-10-08T13:59:59.999Z');
        const after = getBalanceCheckoutPlan(token, '2026-10-08T14:00:00.000Z');
        assert.equal(before.unitAmount, 15000);
        assert.equal(after.unitAmount, 45000);
        assert.equal(after.mode, 'payment');
        assert.equal(after.accessDays, 42);
        assert.equal(after.checkinsPerWeek, '1');
        assert.match(after.checkoutDisclosure, /AUD \$450/);
    }
});
test('Learn weekly and existing coaching prices are not changed by the launch deadline', () => {
    for (const [token,amount] of [['balance_learn_weekly',2483],['balance_online_coaching_6_month_weekly',2999]]) {
        assert.equal(getBalanceCheckoutPlan(token, '2026-11-01').unitAmount, amount);
    }
});
