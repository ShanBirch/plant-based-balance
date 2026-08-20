const assert = require('assert');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-secret';
const { createApprovalToken } = require('../netlify/functions/_lib/ig-dispatch-approval-token');
const approvalFunction = require('../netlify/functions/approve-ig-dispatch-batch');
const {
    rowBatch,
    matchesBatch,
    isBatchExpired,
    buildApprovalPatch,
} = approvalFunction.__test;

const identity = {
    batchId: 'balance-ig-approval-20260821T0130Z',
    batchVersion: 7,
    recipientId: '11111111-1111-4111-8111-111111111111',
};
const awaiting = {
    batch_id: identity.batchId,
    version: identity.batchVersion,
    state: 'awaiting_approval',
    items: [{ username: 'example', estimated_expires_at: '2099-08-21T08:39:48+10:00' }],
};
const row = {
    cursor_start: {},
    cursor_current: { phase: 'approval_gate', approval_batch: awaiting },
    cursor_end: { approval_batch: awaiting },
    next_resume: { lane: 'story_tray_discovery', approval_batch: awaiting },
    receipt: { outcome: 'waiting' },
};

assert.deepStrictEqual(rowBatch(row), awaiting);
assert.strictEqual(matchesBatch(rowBatch(row), identity), true);
assert.strictEqual(isBatchExpired(awaiting, Date.parse('2026-08-21T00:00:00Z')), false);
assert.strictEqual(isBatchExpired({ ...awaiting, items: [{ expires_at: '2026-08-20T00:00:00Z' }] }, Date.parse('2026-08-21T00:00:00Z')), true);
assert.strictEqual(isBatchExpired({ ...awaiting, items: [{ expiry_evidence: { estimated_expires_at: '2026-08-20T00:00:00Z' } }] }, Date.parse('2026-08-21T00:00:00Z')), true);

const approvedAt = '2026-08-20T22:00:00.000Z';
const patch = buildApprovalPatch(row, identity, approvedAt);
assert.strictEqual(patch.cursor_current.approval_batch.state, 'approved');
assert.strictEqual(patch.next_resume.approval_batch.approval_source, 'balance_phone_notification_tap');
assert.strictEqual(patch.receipt.approval_batch.approved_by_user_id, identity.recipientId);
assert.strictEqual(patch.updated_at, approvedAt);

(async () => {
    const liveRow = {
        id: '22222222-2222-4222-8222-222222222222',
        run_id: 'balance-ig-browser-test',
        status: 'partial',
        started_at: '2026-08-20T21:00:00.000Z',
        lease_expires_at: '2026-08-20T21:15:00.000Z',
        updated_at: '2026-08-20T21:00:00.000Z',
        ...row,
    };
    const calls = [];
    global.fetch = async (url, options = {}) => {
        calls.push({ url, options });
        if (url.includes('/rest/v1/users?')) {
            return { ok: true, status: 200, text: async () => JSON.stringify([{ id: identity.recipientId, email: 'shannonbirch@cocospersonaltraining.com' }]) };
        }
        if (url.includes('/rest/v1/ig_browser_shift_runs?select=')) {
            return { ok: true, status: 200, text: async () => JSON.stringify([liveRow]) };
        }
        if (options.method === 'PATCH') {
            return { ok: true, status: 200, text: async () => JSON.stringify([{ id: liveRow.id }]) };
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    const token = createApprovalToken(identity, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const response = await approvalFunction.handler({
        httpMethod: 'POST',
        body: JSON.stringify({ ...identity, approvalToken: token }),
    });
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(JSON.parse(response.body).approved, true);
    const patchCall = calls.find(call => call.options.method === 'PATCH');
    assert.ok(patchCall);
    assert.ok(patchCall.url.includes('updated_at=eq.'));
    const patchBody = JSON.parse(patchCall.options.body);
    assert.strictEqual(patchBody.next_resume.approval_batch.state, 'approved');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
