const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const handlerPromise = import(pathToFileURL(path.join(__dirname, '../netlify/functions/group-session.mts')).href).then(m => m.default);
const token = '956acb35-181a-42bf-b587-9a87a203c51c';
const session = { title: 'Test', starts_at: '2026-10-10T09:00:00+10:00', ends_at: '2026-10-10T10:00:00+10:00', capacity: 8, booking_enabled: true, meeting_url: 'https://meet.google.com/example' };
async function run(req, responses, check) {
    const handler = await handlerPromise;
    const original = global.fetch;
    const calls = [];
    process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-server-key';
    delete process.env.RESEND_API_KEY; delete process.env.BOOKING_EMAIL_FROM;
    global.fetch = async (url, options) => { calls.push({ url, options }); const next = responses.shift(); if (next instanceof Error) throw next; return new Response(JSON.stringify(next), { status: 200 }); };
    try { const response = await handler(req); await check(response, await response.json(), calls); } finally { global.fetch = original; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
}
const post = (reserve = false, extra = {}) => new Request('https://plantbased-balance.org/api/group-session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://plantbased-balance.org' }, body: JSON.stringify({ name: 'Test Guest', email: 'guest@example.com', phone: '', token, reserve, ...extra }) });
test('public availability returns counts, without meeting link or identities', async () => {
    await run(new Request('https://plantbased-balance.org/api/group-session'), [[session], Array.from({ length: 8 }, () => ({ id: 'private' }))], (r, data) => { assert.equal(r.status, 200); assert.equal(data.remaining, 0); assert.equal(data.capacity, 8); assert.equal(data.meetingUrl, undefined); assert.equal(JSON.stringify(data).includes('private'), false); });
});
test('last place race asks visitor to explicitly join reserves', async () => {
    await run(post(), [[session], { error: 'full' }], (r, data, calls) => { assert.equal(r.status, 409); assert.equal(data.error, 'full'); assert.equal(calls.length, 2); assert.equal(JSON.parse(calls[1].options.body).p_reserve, false); });
});
test('reserve confirmation never supplies meeting access', async () => {
    await run(post(true), [[session], { id: 'test-id', status: 'reserve', existing: false }, [{ confirmation_email_sent_at: null }]], (r, data) => { assert.equal(r.status, 200); assert.equal(data.status, 'reserve'); assert.equal(data.meetingUrl, null); assert.equal(data.emailSent, false); });
});
test('confirmed booking supplies receipt even when email is not configured', async () => {
    await run(post(), [[session], { id: 'test-id', status: 'confirmed', existing: false }, [{ confirmation_email_sent_at: null }]], (r, data) => { assert.equal(r.status, 200); assert.equal(data.meetingUrl, session.meeting_url); assert.equal(data.emailSent, false); });
});
test('invalid emails and bot fields do not write bookings', async () => {
    await run(post(false, { email: 'not-an-email' }), [[session]], (r, data, calls) => { assert.equal(r.status, 400); assert.equal(calls.length, 1); });
    await run(post(false, { website: 'bot' }), [[session]], (r, data, calls) => { assert.equal(r.status, 400); assert.equal(calls.length, 1); });
});
test('storage outage never claims a confirmed booking', async () => {
    await run(post(), [new Error('storage offline')], (r, data) => { assert.equal(r.status, 503); assert.equal(data.error, 'unavailable'); });
});
test('receipt lookup requires a valid private token', async () => {
    await run(new Request('https://plantbased-balance.org/api/group-session?receipt=invalid'), [[session]], (r, data, calls) => { assert.equal(r.status, 400); assert.equal(calls.length, 1); });
});
