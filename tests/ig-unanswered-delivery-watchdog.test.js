const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migration = fs.readFileSync(path.join(
    __dirname,
    '../supabase/migrations/20260814123000_reconcile_unanswered_dm_delivery_failures.sql'
), 'utf8');
const receiptRepair = fs.readFileSync(path.join(
    __dirname,
    '../supabase/migrations/20260823233455_clear_reopened_delivery_rescue_receipts.sql'
), 'utf8');
const managerSource = fs.readFileSync(path.join(
    __dirname,
    '../netlify/functions/client-lead-manager.js'
), 'utf8');

test('unanswered delivery watchdog uses canonical latest-message and hard-hold gates', () => {
    assert.match(migration, /SELECT DISTINCT ON \(m\.thread_id\)/);
    assert.match(migration, /lower\(COALESCE\(lm\.direction, ''\)\) = 'in'/);
    assert.match(migration, /t\.linked_user_id IS NULL/);
    assert.match(migration, /needs_you_required/);
    assert.match(migration, /support_exception/);
    assert.match(migration, /native_story_context_required/);
    assert.match(migration, /status = 'claimed' AND v_action\.claim_expires_at > v_now/);
});

test('failed replies escalate from API retry to the native browser without duplicate sends', () => {
    assert.match(migration, /v_owner := 'dm_manager'/);
    assert.match(migration, /v_owner := 'browser_dispatcher'/);
    assert.match(migration, /failed_delivery_rescue/);
    assert.match(migration, /browser_dispatch_required/);
    assert.match(migration, /source_message_id = v_candidate\.inbound_id/);
    assert.match(migration, /p_browser_rescue_after INTERVAL DEFAULT INTERVAL '60 minutes'/);
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.reconcile_unanswered_dm_delivery_failures/);
});

test('the ten-minute cloud manager reconciles failures before loading its reply queue', () => {
    const reconcileAt = managerSource.indexOf('await reconcileUnansweredDeliveryFailures');
    const loadAt = managerSource.indexOf('const alerts = await loadPendingDmAlerts', reconcileAt);
    assert.ok(reconcileAt > 0 && loadAt > reconcileAt);
    assert.match(managerSource, /if \(data\.delivery_rescue_required === true\) return false/);
});

test('reopened delivery rescues archive the old receipt and remain claimable', () => {
    assert.match(receiptRepair, /reconcile_unanswered_dm_delivery_failures\(integer,interval,interval\)/i);
    assert.match(receiptRepair, /receipt = '\{\}'::JSONB/i);
    assert.match(receiptRepair, /owner = 'browser_dispatcher'/i);
    assert.match(receiptRepair, /action_type = 'reply_inbound'/i);
    assert.match(receiptRepair, /failed_delivery_rescue/i);
    assert.match(receiptRepair, /browser_dispatch_required/i);
    assert.match(receiptRepair, /browser_send_allowed/i);
    assert.match(receiptRepair, /source_message_id IS NOT NULL/i);
    assert.match(receiptRepair, /reopened_delivery_rescue_requires_empty_current_receipt/i);
});
