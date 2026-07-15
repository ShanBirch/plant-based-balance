const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const coaching = read('coaching.html');
const checkout = read('checkout.js');
const migration = read('supabase/migrations/20260716100000_standardise_ig_coaching_checkout_url.sql');

test('DM coaching page goes directly to hosted Stripe Checkout', () => {
    assert.match(coaching, /href="#starter-checkout"/);
    assert.doesNotMatch(coaching, /shop\.html#pricing/);
    assert.match(coaching, /id="terms-checkbox"/);
    assert.match(coaching, /data-hosted-checkout-only="true"/);
    assert.match(coaching, /src="checkout\.js"/);
    assert.match(checkout, /btn\.dataset\.hostedCheckoutOnly !== 'true'/);
    assert.match(checkout, /create-checkout-session/);
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
