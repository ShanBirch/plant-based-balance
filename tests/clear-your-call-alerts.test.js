const assert = require('assert');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-secret';
const clearFunction = require('../netlify/functions/clear-your-call-alerts');

const valid = '11111111-1111-4111-8111-111111111111';
assert.deepStrictEqual(clearFunction.__test.normalizeIds([valid, valid, 'bad']), [valid]);

(async () => {
    const adminId = '22222222-2222-4222-8222-222222222222';
    const calls = [];
    global.fetch = async (url, options = {}) => {
        calls.push({ url, options });
        if (url.endsWith('/auth/v1/user')) {
            return { ok: true, json: async () => ({ id: adminId, email: 'shannonbirch@cocospersonaltraining.com' }) };
        }
        if (url.includes('/rest/v1/coach_alerts?select=')) {
            return { ok: true, text: async () => JSON.stringify([{ id: valid, coach_id: adminId, status: 'pending', data: { retained: true } }]) };
        }
        if (options.method === 'PATCH') {
            return { ok: true, text: async () => JSON.stringify([{ id: valid, status: 'dismissed' }]) };
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };

    const response = await clearFunction.handler({
        httpMethod: 'POST',
        headers: { authorization: 'Bearer admin-user-token' },
        body: JSON.stringify({ ids: [valid] }),
    });
    const body = JSON.parse(response.body);
    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.cleared, 1);
    const patch = calls.find(call => call.options.method === 'PATCH');
    assert.ok(patch.url.includes('status=eq.pending'));
    const patchBody = JSON.parse(patch.options.body);
    assert.strictEqual(patchBody.status, 'dismissed');
    assert.strictEqual(patchBody.data.retained, true);
    assert.strictEqual(patchBody.data.dismissed_via, 'admin_your_call_clear_all');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
