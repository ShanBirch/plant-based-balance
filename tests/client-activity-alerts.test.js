const test = require('node:test');
const assert = require('node:assert/strict');

const EVENT = 'a1111111-1111-4111-8111-111111111111';
const USER = 'b2222222-2222-4222-8222-222222222222';
const CLAIM = 'c3333333-3333-4333-8333-333333333333';
const config = { url: 'https://database.example', key: 'mock-service-key', mailKey: 'mock-mail-key', from: 'Balance <alerts@example.com>' };
const row = { id: EVENT, claim_token: CLAIM, event_kind: 'open', recipient_email: 'owner@example.com' };
const payload = { kind: 'foreground', event_id: EVENT, usage_session_id: 'session_123', visible: true, occurred_at: new Date().toISOString() };
const moduleReady = import('../netlify/functions/_lib/client-activity-alerts.mjs');
const handlerReady = import('../netlify/modern-functions/client-activity-event.mts');

function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }); }
function request(body = payload, options = {}) {
  return new Request('https://app.example/.netlify/functions/client-activity-event', {
    method: 'POST', headers: { authorization: 'Bearer client-token', 'Content-Type': 'application/json', ...options.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body), ...options
  });
}
function mockFetch(t, reply) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const call = { url: String(url), ...init, payload: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    return reply(call, calls);
  });
  return calls;
}
function configure(t) {
  const old = globalThis.Netlify;
  const values = { SUPABASE_URL: config.url, SUPABASE_SERVICE_ROLE_KEY: config.key, RESEND_API_KEY: config.mailKey, BOOKING_EMAIL_FROM: config.from };
  globalThis.Netlify = { env: { get: name => values[name] || '' } };
  t.after(() => { if (old === undefined) delete globalThis.Netlify; else globalThis.Netlify = old; });
}
function dispatchReplies(overrides = {}) {
  return call => {
    if (call.url.endsWith('/balance_activity_runtime_status')) return json(null);
    if (call.url.endsWith('/balance_activity_claim')) return json(overrides.rows || [row]);
    if (call.url === 'https://api.resend.com/emails') return overrides.provider ? overrides.provider(call) : json({ id: 'provider-id' });
    if (call.url.endsWith('/balance_activity_finish')) return overrides.finish ? overrides.finish(call) : json(true);
    throw new Error('Unexpected URL: ' + call.url);
  };
}

test('notification email projects only the generic label and opaque event ID', async () => {
  const { notificationEmail, SUBJECT } = await moduleReady;
  const email = notificationEmail({ ...row, client_id: USER, client_name: 'PRIVATE-NAME', safe_activity: { medical: 'PRIVATE-HEALTH', answer: 'PRIVATE-ANSWER' } }, config.from);
  assert.deepEqual(Object.keys(email).sort(), ['from', 'subject', 'text', 'to']);
  assert.deepEqual(email.to, ['owner@example.com']);
  assert.equal(email.subject, `${SUBJECT} ${EVENT}`);
  assert.ok(email.text.includes(EVENT));
  assert.doesNotMatch(JSON.stringify(email), /PRIVATE|b2222222/);
  const synthetic = notificationEmail({ ...row, event_kind: 'test' }, config.from);
  assert.match(synthetic.subject, / TEST /);
  assert.match(synthetic.text, /^Synthetic test\./);
});

test('notification email rejects malformed event identifiers and sender header injection', async () => {
  const { notificationEmail } = await moduleReady;
  assert.throws(() => notificationEmail({ ...row, id: 'private-data\nBCC: other@example.com' }, config.from), /invalid_delivery/);
  assert.throws(() => notificationEmail(row, 'alerts@example.com\r\nBCC: other@example.com'), /invalid_delivery/);
  assert.throws(() => notificationEmail({ ...row, recipient_email: '' }, config.from), /invalid_delivery/);
});

test('JSON responses prohibit caching', async () => {
  const { response } = await moduleReady;
  const result = response(202, { accepted: true });
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(await result.json(), { accepted: true });
});

test('RPC requires configured database and uses server credentials with a bounded request', async t => {
  const { rpc } = await moduleReady;
  const calls = mockFetch(t, () => json({ accepted: true }));
  await assert.rejects(rpc('balance_activity_record_presence', {}, { url: '', key: '' }), /database_not_configured/);
  assert.equal(calls.length, 0);
  assert.deepEqual(await rpc('balance_activity_record_presence', { p_user_id: USER }, config), { accepted: true });
  assert.equal(calls[0].url, config.url + '/rest/v1/rpc/balance_activity_record_presence');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers.apikey, config.key);
  assert.equal(calls[0].headers.Authorization, 'Bearer ' + config.key);
  assert.deepEqual(calls[0].payload, { p_user_id: USER });
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test('RPC errors expose status only, never response bodies', async t => {
  const { rpc } = await moduleReady;
  mockFetch(t, () => json({ secret: 'PRIVATE-DATABASE-ERROR' }, 500));
  await assert.rejects(rpc('balance_activity_claim', {}, config), error => error.message === 'database_500');
});

test('missing mail configuration records diagnostics without claiming or sending', async t => {
  const { dispatch } = await moduleReady;
  const calls = mockFetch(t, () => json(null));
  assert.deepEqual(await dispatch({ config: { ...config, mailKey: '' } }), { sent: 0, blocked: 'email_not_configured' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /balance_activity_runtime_status$/);
  assert.equal(calls[0].payload.p_status.email_configured, false);
  assert.doesNotMatch(JSON.stringify(calls[0].payload), /mock-service-key|mock-mail-key/);
});

test('an empty outbox causes no provider call', async t => {
  const { dispatch } = await moduleReady;
  const calls = mockFetch(t, dispatchReplies({ rows: [] }));
  assert.deepEqual(await dispatch({ config }), { sent: 0 });
  assert.equal(calls.filter(call => call.url.includes('resend.com')).length, 0);
});

test('successful dispatch uses a stable event idempotency key and exact lease token', async t => {
  const { dispatch } = await moduleReady;
  const calls = mockFetch(t, dispatchReplies());
  assert.deepEqual(await dispatch({ config, eventId: EVENT, limit: 1 }), { sent: 1 });
  const claim = calls.find(call => call.url.endsWith('/balance_activity_claim'));
  assert.deepEqual(claim.payload, { p_event_id: EVENT, p_limit: 1 });
  const mail = calls.find(call => call.url.includes('resend.com'));
  assert.equal(mail.headers['Idempotency-Key'], 'balance-activity-v1/' + EVENT);
  assert.equal(mail.headers.Authorization, 'Bearer ' + config.mailKey);
  assert.ok(mail.signal instanceof AbortSignal);
  const finish = calls.find(call => call.url.endsWith('/balance_activity_finish'));
  assert.deepEqual(finish.payload, { p_event_id: EVENT, p_claim_token: CLAIM, p_provider_id: 'provider-id', p_error_code: null });
});

test('a provider rejection persists only a generic status for retry', async t => {
  const { dispatch } = await moduleReady;
  const calls = mockFetch(t, dispatchReplies({ provider: () => json({ message: 'PRIVATE-ERROR' }, 429) }));
  assert.deepEqual(await dispatch({ config }), { sent: 0 });
  const finish = calls.find(call => call.url.endsWith('/balance_activity_finish'));
  assert.equal(finish.payload.p_error_code, 'provider_429');
  assert.equal(finish.payload.p_provider_id, null);
  assert.doesNotMatch(JSON.stringify(finish.payload), /PRIVATE-ERROR/);
});

test('provider transport errors and missing receipts return the event for bounded retry', async t => {
  const { dispatch } = await moduleReady;
  const outcomes = [() => { throw new Error('PRIVATE-TRANSPORT'); }, () => json({ unexpected: 'PRIVATE-RECEIPT' })];
  for (const provider of outcomes) {
    const calls = mockFetch(t, dispatchReplies({ provider }));
    assert.deepEqual(await dispatch({ config }), { sent: 0 });
    const finish = calls.find(call => call.url.endsWith('/balance_activity_finish'));
    assert.equal(finish.payload.p_error_code, 'transport_or_receipt_unconfirmed');
    assert.equal(finish.payload.p_provider_id, null);
    assert.doesNotMatch(JSON.stringify(finish.payload), /PRIVATE-/);
    t.mock.restoreAll();
  }
});

test('ambiguous receipt persistence retries using the original provider idempotency key', async t => {
  const { dispatch } = await moduleReady;
  let finishes = 0;
  const calls = mockFetch(t, dispatchReplies({ finish: () => ++finishes === 1 ? json({ error: 'PRIVATE-DB-FAILURE' }, 503) : json(true) }));
  assert.deepEqual(await dispatch({ config }), { sent: 0 });
  assert.deepEqual(await dispatch({ config }), { sent: 1 });
  const mails = calls.filter(call => call.url.includes('resend.com'));
  assert.equal(mails.length, 2);
  assert.equal(mails[0].headers['Idempotency-Key'], mails[1].headers['Idempotency-Key']);
  assert.deepEqual(mails[0].payload, mails[1].payload);
});

test('a superseded lease must not be reported as a confirmed sent receipt', async t => {
  const { dispatch } = await moduleReady;
  mockFetch(t, dispatchReplies({ finish: () => json(false) }));
  assert.deepEqual(await dispatch({ config }), { sent: 0 });
});

test('event handler rejects non-POST requests without contacting any service', async t => {
  const { default: handler } = await handlerReady;
  const calls = mockFetch(t, () => { throw new Error('unexpected fetch'); });
  const result = await handler(new Request('https://app.example', { method: 'GET' }));
  assert.equal(result.status, 405);
  assert.equal(calls.length, 0);
});

test('event handler requires an explicit bearer token', async t => {
  const { default: handler } = await handlerReady;
  const calls = mockFetch(t, () => { throw new Error('unexpected fetch'); });
  for (const token of ['', 'Basic abc', 'Bearer', 'Bearer token extra']) {
    const result = await handler(request(payload, { headers: { authorization: token } }));
    assert.equal(result.status, 401);
  }
  assert.equal(calls.length, 0);
});

test('event handler rejects oversized and malformed JSON bodies before authentication', async t => {
  const { default: handler } = await handlerReady;
  const calls = mockFetch(t, () => { throw new Error('unexpected fetch'); });
  assert.equal((await handler(request('x'.repeat(2049)))).status, 413);
  assert.equal((await handler(request('{'))).status, 400);
  assert.equal((await handler(request(payload, { headers: { authorization: 'Bearer x', 'content-length': '2049' } }))).status, 413);
  assert.equal(calls.length, 0);
});

test('event handler allowlists event fields and cannot accept a supplied client identity', async t => {
  const { default: handler } = await handlerReady;
  const calls = mockFetch(t, () => { throw new Error('unexpected fetch'); });
  const invalid = [null, [], { ...payload, visible: false }, { ...payload, kind: 'send_message' },
    { ...payload, event_id: 'not-a-uuid' }, { ...payload, usage_session_id: 'session with spaces' },
    { ...payload, usage_session_id: 'a'.repeat(121) }, { ...payload, user_id: USER }, { ...payload, health: 'sensitive' }];
  for (const body of invalid) assert.equal((await handler(request(body))).status, 400, JSON.stringify(body));
  assert.equal(calls.length, 0);
});

test('event handler validates token remotely and attributes only the authenticated user', async t => {
  const { default: handler } = await handlerReady;
  configure(t);
  const calls = mockFetch(t, call => call.url.endsWith('/auth/v1/user') ? json({ id: USER }) : json({ accepted: false }));
  const result = await handler(request());
  assert.equal(result.status, 202);
  assert.deepEqual(await result.json(), { accepted: true });
  assert.equal(calls[0].headers.Authorization, 'Bearer client-token');
  assert.equal(calls[0].headers.apikey, config.key);
  assert.deepEqual(calls[1].payload, { p_user_id: USER, p_event_id: EVENT, p_usage_session_id: 'session_123', p_kind: 'foreground', p_occurred_at: payload.occurred_at });
  assert.equal(calls.length, 2, 'disabled or ineligible capture must not invoke the email provider');
});

test('invalid token or malformed auth identity never reaches the private RPC', async t => {
  const { default: handler } = await handlerReady;
  configure(t);
  for (const authResult of [() => json({ error: 'PRIVATE-AUTH' }, 401), () => json({ id: 'malformed' })]) {
    const calls = mockFetch(t, authResult);
    const result = await handler(request());
    assert.equal(result.status, 401);
    assert.deepEqual(await result.json(), { error: 'unauthorized' });
    assert.equal(calls.length, 1);
    t.mock.restoreAll();
  }
});

test('durably captured events stay accepted when immediate dispatch is unavailable', async t => {
  const { default: handler } = await handlerReady;
  configure(t);
  const calls = mockFetch(t, call => {
    if (call.url.endsWith('/auth/v1/user')) return json({ id: USER });
    if (call.url.endsWith('/balance_activity_record_presence')) return json({ accepted: true, outbox_id: EVENT });
    return json({ error: 'PRIVATE-DISPATCH-ERROR' }, 503);
  });
  const result = await handler(request());
  assert.equal(result.status, 202);
  assert.deepEqual(await result.json(), { accepted: true });
  assert.ok(calls.some(call => call.url.endsWith('/balance_activity_record_presence')));
});

test('failed durable capture returns a retryable generic failure', async t => {
  const { default: handler } = await handlerReady;
  configure(t);
  mockFetch(t, call => call.url.endsWith('/auth/v1/user') ? json({ id: USER }) : json({ error: 'PRIVATE-CAPTURE-ERROR' }, 500));
  const result = await handler(request());
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { error: 'temporarily_unavailable' });
});


test('foreground rejects missing, stale, future and invalid occurrence timestamps', async t => {
  const { default: handler } = await handlerReady;
  const calls = mockFetch(t, () => { throw new Error('unexpected fetch'); });
  for (const occurred_at of [undefined, 'bad', '2020-01-01T00:00:00.000Z', new Date(Date.now()+120000).toISOString()]) {
    assert.equal((await handler(request({...payload, occurred_at}))).status,400);
  }
  assert.equal(calls.length,0);
});
