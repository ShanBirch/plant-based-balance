const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'cancellation.html'), 'utf8');
const endpoint = fs.readFileSync(path.join(root, 'netlify/edge-functions/cancel-subscription.js'), 'utf8');
const checkout = fs.readFileSync(path.join(root, 'netlify/edge-functions/lib/checkout-guard.js'), 'utf8');
const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const coaching = fs.readFileSync(path.join(root, 'coaching.html'), 'utf8');
const checkoutScript = fs.readFileSync(path.join(root, 'checkout.js'), 'utf8');

assert.match(page, /Cancel your subscription/);
assert.match(page, /30 days' notice/);
assert.match(page, /Apple and Google subscriptions use the store's cancellation timing/);
assert.match(page, /Australian Consumer Law rights are not limited/);
assert.match(page, /Type CANCEL/);
assert.match(page, /Delete account/);
assert.match(page, /Pause payments for 30 days/);
assert.match(page, /billing resumes automatically/);
assert.match(page, /any balance already issued remains due/);
assert.doesNotMatch(page, /—/);

assert.match(endpoint, /auth\.getUser\(token\)/);
assert.match(endpoint, /cancellation_notice_days/);
assert.match(endpoint, /commitment_weeks/);
assert.match(endpoint, /proration_behavior/);
assert.match(endpoint, /balance_self_service/);
assert.match(endpoint, /String\(body\.confirmation/);
assert.match(endpoint, /pause_collection\[behavior\]/);
assert.match(endpoint, /pause_collection\[resumes_at\]/);
assert.match(endpoint, /retention_pause_used_at/);
assert.match(endpoint, /action === "pause"/);

assert.equal((checkout.match(/cancellationNoticeDays: 30/g) || []).length, 5);
assert.match(checkout, /AU\$779\.74 minimum total/);
assert.match(checkout, /AU\$649\.87 minimum total/);
assert.match(checkout, /AU\$299\.96 minimum total/);
assert.match(terms, /purchased on or after 1 September 2026/);
assert.match(dashboard, /settings-cancel-subscription/);
assert.match(coaching, /Direct recurring subscriptions require 30 days' notice/);
assert.match(checkoutScript, /terms: '2026-09-01'/);

console.log('cancellation page contract passed');
