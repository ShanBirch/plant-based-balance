const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../netlify/functions/master-form-check-status.js'), 'utf8');
test('status endpoint is registered in the production functions directory', () => {
    const wrapper = fs.readFileSync(require('node:path').join(__dirname, '../netlify/modern-functions/master-form-check-status.mts'), 'utf8');
    assert.ok(wrapper.includes("../functions/master-form-check-status.js"));
    assert.ok(wrapper.includes('withLambda(legacy.handler)'));
});
function runtime({ valid = true, fail = false } = {}) {
    const paths = [], exports = {};
    vm.runInNewContext(source, { exports, console: { error() {} }, fetch: async () => ({ ok: valid, json: async () => ({ id: 'member-a' }) }), require: () => ({ SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_KEY: 'test', supabaseQuery: async path => {
        paths.push(path); if (fail) throw new Error('offline');
        return path.startsWith('coach_alerts') ? [
            { id: 'a', created_at: 'today', data: { form_check_workout_name: 'Balance Master: squat', form_check_video_url: 'https://example.test/clip', private_draft: 'secret' } },
            { id: 'b', data: { form_check_workout_name: 'Balance Master: hinge' } }
        ] : [{ id: 'c', created_at: 'today', message: 'Video: [video: https://example.test/clip]\nWorkout: Balance Master: pull\nFocus: check' }];
    } }) });
    return { handler: exports.handler, paths };
}
test('receipts use authenticated identity and do not expose drafts or video links', async () => {
    const r = runtime();
    const result = await r.handler({ httpMethod: 'GET', headers: { authorization: 'Bearer token' }, queryStringParameters: { userId: 'someone-else' } });
    assert.equal(result.statusCode, 200);
    const data = JSON.parse(result.body);
    assert.deepEqual(Object.keys(data.submissions).sort(), ['pull', 'squat']);
    assert.ok(r.paths[0].includes('client_id=eq.member-a'));
    assert.ok(r.paths[1].includes('sender_id=eq.member-a'));
    assert.ok(!result.body.includes('secret') && !result.body.includes('https://'));
    assert.equal(result.headers['Cache-Control'], 'no-store');
});
test('missing or invalid auth and database failure cannot produce submission receipts', async () => {
    assert.equal((await runtime().handler({ httpMethod: 'GET', headers: {} })).statusCode, 401);
    assert.equal((await runtime({ valid: false }).handler({ httpMethod: 'GET', headers: { authorization: 'Bearer bad' } })).statusCode, 401);
    assert.equal((await runtime({ fail: true }).handler({ httpMethod: 'GET', headers: { authorization: 'Bearer valid' } })).statusCode, 503);
});
