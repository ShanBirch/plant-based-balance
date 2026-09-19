const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const privacy = require('../js/dashboard/pbb-replay-privacy');
const source = fs.readFileSync(require.resolve('../js/dashboard/pbb-session-replay'), 'utf8');

test('private DOM text, attributes, form contents, media and URLs never leave the sanitizer', () => {
  const clean = privacy.event({ type: 2, timestamp: 123, data: { node: { type: 0, childNodes: [
    { type: 2, tagName: 'div', attributes: { title: 'SECRET_TITLE', 'data-email': 'SECRET_EMAIL', onclick: 'SECRET_SCRIPT', style: 'background:url("photo (1).jpg?token=SECRET_URL");content:"SECRET_CONTENT";color:red' }, childNodes: [{ type: 3, textContent: 'SECRET_HEALTH' }] },
    { type: 2, tagName: 'textarea', attributes: { value: 'SECRET_INPUT' }, childNodes: [{ type: 3, textContent: 'SECRET_INPUT' }] },
    { type: 2, tagName: 'img', attributes: { src: 'SECRET_PHOTO', alt: 'SECRET_ALT' } },
    { type: 2, tagName: 'script', childNodes: [{ type: 3, textContent: 'SECRET_TOKEN' }] }
  ] }, initialOffset: { top: 0, left: 0 } } });
  assert.doesNotMatch(JSON.stringify(clean), /SECRET/);
  assert.equal(privacy.mask('Home'), 'Home');
  assert.equal(privacy.mask('Blood pressure 130/90'), '***** ******** ******');
  assert.equal(privacy.event({ type: 3, timestamp: 1, data: { source: 5, text: 'SECRET' } }), null);
  assert.equal(privacy.event({ type: 6, timestamp: 1, data: { payload: 'SECRET' } }), null);
  assert.doesNotMatch(JSON.stringify(privacy.event({ type: 4, timestamp: 1, data: { href: '?token=SECRET', width: 390, height: 844 } })), /SECRET/);
});

function harness({ id = 'member-a', fail = false } = {}) {
  let authId = id, cb, recording, failNext = fail;
  const uploads = [], intervals = [], listeners = {}, storage = new Map();
  const document = { visibilityState: 'visible', hidden: false, getElementById: () => null, addEventListener: (key, fn) => { listeners[key] = fn; } };
  const window = {
    currentUser: id ? { id } : null, crypto: { randomUUID }, CompressionStream, BalanceReplayPrivacy: privacy,
    addEventListener: (key, fn) => { listeners[key] = fn; },
    rrweb: { record(options) { recording = options; options.emit({ type: 4, timestamp: Date.now(), data: { width: 390, height: 844 } }); options.emit({ type: 2, timestamp: Date.now(), data: { node: { type: 0, childNodes: [] }, initialOffset: { top: 0, left: 0 } } }); return () => { recording = null; }; } },
    supabaseClient: {
      auth: { getSession: async () => ({ data: { session: authId ? { user: { id: authId } } : null } }), onAuthStateChange: fn => { cb = fn; } },
      from: () => ({ insert: async row => { if (failNext) { failNext = false; return { error: { code: 'NETWORK' } }; } uploads.push(row); return {}; } })
    }
  };
  const context = { window, document, crypto: window.crypto, localStorage: { getItem: key => storage.get(key), setItem: (k, v) => storage.set(k, v) }, setInterval: fn => intervals.push(fn), Blob, Response, CompressionStream, Uint8Array, btoa, Date, console };
  vm.runInNewContext(source, context);
  return { window, uploads, document, listeners, intervals, settle: () => new Promise(resolve => setTimeout(resolve, 30)), setAuth(id) { authId = id; cb('SIGNED_IN', id ? { user: { id } } : null); }, get recording() { return recording; } };
}
test('automatic authenticated capture uploads a decodable opening snapshot and error marker', async () => {
  const h = harness(); await h.settle(); assert.ok(h.recording);
  h.listeners.error(); await h.settle(); await h.window.BalanceReplay.flush();
  assert.equal(h.uploads[0].user_id, 'member-a'); assert.equal(h.uploads[0].seq, 0);
  const events = JSON.parse(gunzipSync(Buffer.from(h.uploads[0].payload, 'base64')));
  assert.ok(events.some(e => e.type === 2)); assert.ok(events.some(e => e.type === 5));
});
test('signed-out use does not record and account switching discards old pending data', async () => {
  const guest = harness({ id: null }); await guest.settle(); assert.equal(guest.recording, undefined); assert.equal(guest.uploads.length, 0);
  const h = harness(); await h.settle(); h.setAuth('member-b'); h.window.currentUser.id = 'member-b';
  await h.intervals[0](); await h.settle(); await h.window.BalanceReplay.flush();
  assert.equal(h.uploads.length, 1); assert.equal(h.uploads[0].user_id, 'member-b'); assert.equal(h.uploads[0].seq, 0);
});
test('opt-out stops capture and discards queued replay immediately', async () => {
  const h = harness(); await h.settle(); h.window.BalanceReplay.setEnabled(false);
  assert.equal(h.recording, null); await h.window.BalanceReplay.flush(); assert.equal(h.uploads.length, 0);
  await h.intervals[0](); assert.equal(h.recording, null);
});
test('background capture stops, uploads the pending chunk, and resumes with a new opening snapshot', async () => {
  const h = harness(); await h.settle(); const first = h.window.BalanceReplay.getSessionId();
  h.document.hidden = true; h.document.visibilityState = 'hidden'; h.listeners.visibilitychange(); await h.settle();
  assert.equal(h.recording, null); assert.equal(h.uploads.length, 1);
  h.document.hidden = false; h.document.visibilityState = 'visible'; h.listeners.visibilitychange(); await h.settle();
  assert.ok(h.recording); assert.notEqual(h.window.BalanceReplay.getSessionId(), first);
});
test('failed uploads retain sequence and queued data instead of silently dropping a chunk', async () => {
  const h = harness({ fail: true }); await h.settle(); const session = h.window.BalanceReplay.getSessionId();
  await h.window.BalanceReplay.flush(); assert.equal(h.uploads.length, 0); assert.equal(h.window.BalanceReplay.getSessionId(), session);
});

test('onboarding markers retain fixed step metadata, never answers or arbitrary labels', () => {
  const clean = privacy.event({ type: 5, timestamp: 123, data: { tag: 'balance-onboarding', payload: { phase: 'tour', step: 'SECRET_HEALTH', step_number: 14, status: 'viewed', action: 'outside_highlight', answers: 'SECRET_ANSWER', url: 'SECRET_URL' } } });
  assert.equal(clean.data.payload.step_number, 14);
  assert.equal(clean.data.payload.action, 'outside_highlight');
  assert.doesNotMatch(JSON.stringify(clean), /SECRET/);
  assert.equal(privacy.event({ type: 5, timestamp: 1, data: { tag: 'balance-onboarding', payload: { phase: 'SECRET' } } }), null);
});

test('setup and tour markers link to a playable session without inflating errors', async () => {
  const h = harness(); await h.settle();
  const id = await h.window.BalanceReplay.markOnboarding({ phase: 'screen', step: 'slide_4', status: 'viewed', step_number: 4, answers: 'SECRET' });
  assert.equal(id, h.window.BalanceReplay.getSessionId());
  await h.window.BalanceReplay.flush();
  const events = JSON.parse(gunzipSync(Buffer.from(h.uploads[0].payload, 'base64')));
  assert.ok(events.some(e => e.type === 2));
  assert.equal(events.find(e => e.data.tag === 'balance-onboarding').data.payload.step, 'slide_4');
  assert.equal(h.uploads[0].error_count, 0); assert.doesNotMatch(JSON.stringify(events), /SECRET/);
  h.window.BalanceReplay.setEnabled(false);
  assert.equal(await h.window.BalanceReplay.markOnboarding({ phase: 'tour', step_number: 1 }), null);
  await h.window.BalanceReplay.flush(); assert.equal(h.uploads.length, 1);
});

test('outside-highlight taps are marked, guide controls and target taps are not', async () => {
  const h = harness(); await h.settle(); h.window.__balanceGuidedTourActive = true;
  const bubbleTarget = {};
  h.document.getElementById = id => id === 'guided-tour-bubble' ? { contains: target => target === bubbleTarget } : id === 'guided-tour-spotlight' ? { getBoundingClientRect: () => ({ left: 10, right: 100, top: 20, bottom: 80, width: 90, height: 60 }) } : null;
  await h.window.BalanceReplay.markOnboarding({ phase: 'tour', step_number: 14, status: 'viewed' });
  await h.window.BalanceReplay.markOnboarding({ phase: 'course', status: 'viewed' });
  h.listeners.pointerdown({ target: bubbleTarget, clientX: 200, clientY: 200 });
  h.listeners.pointerdown({ target: {}, clientX: 30, clientY: 40 });
  h.listeners.pointerdown({ target: {}, clientX: 200, clientY: 200 });
  await h.window.BalanceReplay.flush();
  const events = JSON.parse(gunzipSync(Buffer.from(h.uploads[0].payload, 'base64')));
  const taps = events.filter(e => e.data.payload?.action === 'outside_highlight');
  assert.equal(taps.length, 1); assert.equal(taps[0].data.payload.step_number, 14);
});

test('background and return retain the last onboarding step; switching accounts clears it', async () => {
  const h = harness(); await h.settle();
  await h.window.BalanceReplay.markOnboarding({ phase: 'screen', step: 'slide_4', status: 'viewed' });
  h.document.hidden = true; h.document.visibilityState = 'hidden'; h.listeners.visibilitychange(); await h.settle();
  h.document.hidden = false; h.document.visibilityState = 'visible'; h.listeners.visibilitychange(); await h.settle();
  await h.window.BalanceReplay.flush();
  const events = h.uploads.flatMap(row => JSON.parse(gunzipSync(Buffer.from(row.payload, 'base64'))));
  assert.ok(events.some(e => e.data.payload?.action === 'app_hidden'));
  assert.ok(events.some(e => e.data.payload?.action === 'app_returned'));
  h.setAuth('member-b'); h.window.currentUser.id = 'member-b'; await h.intervals[0](); await h.settle(); await h.window.BalanceReplay.flush();
  const last = JSON.parse(gunzipSync(Buffer.from(h.uploads.at(-1).payload, 'base64')));
  assert.equal(last.some(e => e.data.tag === 'balance-onboarding'), false);
});
