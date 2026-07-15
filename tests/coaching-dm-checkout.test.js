const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const coaching = read('coaching.html');
const checkout = read('checkout.js');
const success = read('success.html');
const adminAi = read('netlify/edge-functions/admin-ai-coach.ts');
const migration = read('supabase/migrations/20260716100000_standardise_ig_coaching_checkout_url.sql');

test('DM coaching page goes directly to hosted Stripe Checkout', () => {
    assert.match(coaching, /href="#plan-checkout"/);
    assert.doesNotMatch(coaching, /shop\.html#pricing/);
    assert.match(coaching, /id="terms-checkbox"/);
    assert.match(coaching, /data-hosted-checkout-only="true"/);
    assert.match(coaching, /src="checkout\.js"/);
    assert.match(checkout, /btn\.dataset\.hostedCheckoutOnly !== 'true'/);
    assert.match(checkout, /create-checkout-session/);
    assert.match(coaching, /data-plan="app-monthly"/);
    assert.match(checkout, /'app-monthly': 'balance_app_community_monthly'/);
    assert.match(coaching, /App \+ Community/);
    assert.match(coaching, /\$19\.99<span>\/month<\/span>/);
    assert.match(coaching, /data-plan="coaching-calls"/);
    assert.match(checkout, /'coaching-calls': 'balance_coaching_calls_weekly'/);
    assert.match(coaching, /\$99\.99<span>\/week<\/span>/);
});

test('all active DM handoffs use the permanent branded coaching URL', () => {
    const files = [
        'netlify/edge-functions/sales-bot.js',
        'netlify/functions/_lib/client-context.js',
        'netlify/functions/_lib/dm-sparring-gym.js',
        'netlify/functions/_lib/qualifier-engine.js',
        'netlify/functions/client-lead-manager.js',
        'netlify/functions/ig-instant-draft.js',
        'netlify/functions/scheduled-coach-reply-worker.js'
    ];

    for (const file of files) {
        const source = read(file);
        assert.match(source, /https:\/\/plantbased-balance\.org\/coaching\.html/, file);
        assert.doesNotMatch(source, /https:\/\/future-balance\.netlify\.app\/coaching\.html/, file);
    }
});

test('money funnel recognises new and historic coaching links', () => {
    assert.match(migration, /plantbased-balance\.org\/coaching\.html/);
    assert.match(migration, /future-balance\.netlify\.app\/coaching\.html/);
    assert.match(migration, /ig_message_has_coaching_checkout_link/);
});

test('paid coaching handoff sends buyers into Balance with the checkout email', () => {
    assert.match(success, /Create your account using the same email you used at checkout/);
    assert.match(success, /login\.html\?action=signup&amp;source=checkout/);
    assert.match(success, /I already have a Balance account/);
    assert.doesNotMatch(success, /Your hormones will thank you/);
    assert.match(success, /app_community_monthly/);
    assert.match(success, /Balance App \+ Community/);
    assert.match(success, /coaching_calls_weekly/);
    assert.match(success, /BOOK MY FIRST CALL/);
    assert.match(success, /book\.html\?source=coaching_calls_purchase&amp;first_call=1/);
    assert.match(adminAi, /profile\.subscription_plan \|\| profile\.subscription_type/);
});
