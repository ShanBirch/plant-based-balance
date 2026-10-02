import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { validatePayload } from '../netlify/functions/pre-call.mjs';

const payload = (kind = 'general') => ({ kind, name: 'Test person', email: 'test@example.com', consent: true, submission_id: 'e6aa7d49-43c5-46aa-9d48-4d263e261c08', answers: { goal: kind === 'general' ? 'Get stronger' : ['Getting stronger'] } });
const request = body => new Request('https://plantbased-balance.org/api/pre-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('both forms allow skipped questions and retain explicit answers', () => {
    for (const kind of ['general', 'menopause']) {
        const value = validatePayload(payload(kind));
        assert.deepEqual(value.answers.goal, payload(kind).answers.goal);
        assert.equal(value.answers.health, '');
    }
});
test('consent, contact, UUID and valid form type are enforced', () => {
    for (const change of [{ consent: false }, { name: '' }, { email: 'no' }, { submission_id: 'invalid' }, { kind: 'constructor' }]) {
        assert.throws(() => validatePayload({ ...payload(), ...change }));
    }
});
test('unknown fields are discarded and invalid options rejected', () => {
    const input = payload('menopause'); input.answers.private_extra = 'not stored';
    assert.equal(validatePayload(input).answers.private_extra, undefined);
    input.answers.goal = ['fake diagnosis']; assert.throws(() => validatePayload(input));
});
test('text answers are bounded', () => {
    const input = payload(); input.answers.health = 'x'.repeat(3000);
    assert.equal(validatePayload(input).answers.health.length, 1800);
});
test('save route is private, idempotent, manual-only and honest about storage failure', async () => {
    const original = globalThis.fetch;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    let saved;
    try {
        globalThis.fetch = async (url, init) => {
            if (url.includes('users?')) return Response.json([{ id: 'coach' }]);
            if (init?.method === 'POST') { saved = JSON.parse(init.body); return Response.json([saved]); }
            return Response.json([]);
        };
        assert.equal((await handler(request(payload()))).status, 200);
        assert.equal(saved.client_id, null);
        assert.equal(saved.suggested_message, null);
        assert.equal(saved.data.manual_only, true);
        assert.equal(saved.data.needs_you_required, true);
        assert.equal(saved.coach_id, 'coach');
        assert.equal(saved.data.contact_email, 'test@example.com');
        assert.equal((await handler(new Request('https://plantbased-balance.org/api/pre-call'))).status, 401);
        globalThis.fetch = async url => Response.json(url.includes('users?') ? [{ id: 'coach' }] : [{ id: payload().submission_id }]);
        assert.equal((await handler(request(payload()))).status, 200);
        globalThis.fetch = async () => new Response('', { status: 500 });
        assert.equal((await handler(request(payload()))).status, 503);
    } finally { globalThis.fetch = original; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});
test('unrelated signed-in users cannot retrieve answers', async () => {
    const original = globalThis.fetch; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    try {
        globalThis.fetch = async () => Response.json({ id: 'other', email: 'other@example.com' });
        const response = await handler(new Request('https://plantbased-balance.org/api/pre-call', { headers: { Authorization: 'Bearer fake' } }));
        assert.equal(response.status, 403);
    } finally { globalThis.fetch = original; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});
test('spam trap and oversized requests do not reach storage', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    try {
        assert.equal((await handler(request({ ...payload(), website: 'spam' }))).status, 200);
        assert.equal((await handler(request({ ...payload(), extra: 'x'.repeat(40001) }))).status, 413);
    } finally { delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});
