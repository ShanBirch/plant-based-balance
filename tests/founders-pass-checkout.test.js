const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('one-time Founders Pass has a complete purchase and activation path', () => {
    const page = read('vegan-fitness.html');
    const guard = read('netlify/edge-functions/lib/checkout-guard.js');
    const checkout = read('netlify/edge-functions/create-checkout-session.js');
    const claim = read('netlify/edge-functions/claim-founders-pass.js');
    const webhook = read('netlify/edge-functions/stripe-webhook.js');
    const login = read('login.html');
    const success = read('success.html');
    const config = read('netlify.toml');
    const migration = read('supabase/migrations/20260717090000_founders_pass_purchases.sql');

    assert.match(page, /data-plan="founders-pass"/);
    assert.match(guard, /balance_vegan_founders_pass[\s\S]*?unitAmount: 9900[\s\S]*?mode: "payment"/);
    assert.match(checkout, /checkout\.plan\.mode === "subscription"/);
    assert.match(checkout, /payment_intent_data\[metadata\]/);
    assert.match(checkout, /founders_pass_lifetime/);
    assert.match(claim, /payment_status !== "paid"/);
    assert.match(claim, /This purchase does not match the signed-in account/);
    assert.match(claim, /subscription_plan: FOUNDERS_PLAN/);
    assert.match(webhook, /recordFoundersPassSale/);
    assert.match(login, /claimPendingFoundersPass/);
    assert.match(success, /balance_founders_pass_session_id/);
    assert.match(config, /function = "claim-founders-pass"/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.founders_pass_purchases/);
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.founders_pass_purchases TO service_role/);
});
