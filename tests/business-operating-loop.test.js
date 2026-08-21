const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(
    path.join(root, 'supabase', 'migrations', '20260821015536_balance_business_operating_loop.sql'),
    'utf8'
);
const dashboard = fs.readFileSync(path.join(root, 'admin-dashboard.html'), 'utf8');
const netlifyConfig = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
const codex = fs.readFileSync(path.join(root, 'CODEX.md'), 'utf8');
const { _test } = require('../netlify/functions/business-scorecard-daily');

test('scorecard joins money, client results, autonomy and shipped work', () => {
    assert.match(migration, /founders_pass_purchases/i);
    assert.match(migration, /growth_outcome_events/i);
    assert.match(migration, /clients_with_progress_signal/i);
    assert.match(migration, /automated_completed/i);
    assert.match(migration, /balance_business_changes/i);
    assert.match(migration, /primary_constraint/i);
    assert.match(migration, /unit_economics_visibility/i);
    assert.match(migration, /CAC and profit cannot be calculated until Meta ad spend is connected/i);
});

test('scorecard data stays admin-readable and service-written', () => {
    assert.match(migration, /ALTER TABLE public\.balance_business_scorecards ENABLE ROW LEVEL SECURITY/i);
    assert.match(migration, /Admins can read Balance business scorecards/i);
    assert.match(migration, /GRANT SELECT ON TABLE public\.balance_business_scorecards TO authenticated/i);
    assert.doesNotMatch(migration, /GRANT (?:INSERT|UPDATE|DELETE|ALL)[^;]*balance_business_scorecards TO authenticated/i);
    assert.match(migration, /record_balance_business_scorecard[\s\S]+TO service_role/i);
    assert.doesNotMatch(migration, /auth\.role\(\)/i);
});

test('daily loop is scheduled once and creates concise phone copy', () => {
    assert.match(netlifyConfig, /\[functions\."business-scorecard-daily"\][\s\S]+schedule = "15 20 \* \* \*"/i);
    const copy = _test.buildNotificationCopy({
        primary_constraint: 'checkout_conversion',
        metrics: { current: { founders_revenue_minor: 8999, founders_sales: 1, checkout_sent: 2 } },
    });
    assert.equal(copy.title, 'Balance: Checkout Conversion');
    assert.match(copy.body, /\$90/);
    assert.match(copy.body, /2 checkouts/);
    assert.match(copy.body, /1 sale/);
    assert.ok(copy.body.length <= 120, `notification body is ${copy.body.length} characters`);
});

test('admin dashboard and operating contract use the canonical loop', () => {
    assert.match(dashboard, /Balance Operating Loop/);
    assert.match(dashboard, /get_balance_business_scorecard/);
    assert.match(dashboard, /balance_business_scorecards/);
    assert.match(dashboard, /What We Changed/);
    assert.match(dashboard, /Measurement Trust/);
    assert.match(codex, /get_balance_business_scorecard\(7\)/);
    assert.match(codex, /npm run business:change/);
    assert.match(codex, /one active constraint at a time/i);
});
