const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/dashboard/pbb-client-activity-alerts.js', 'utf8');
const USER_A = 'a1111111-1111-4111-8111-111111111111';
const USER_B = 'b2222222-2222-4222-8222-222222222222';
const START = 1700000000000;
let uuidCounter = 0;

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), values };
}

function target() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    emit(type, event = {}) { for (const listener of listeners.get(type) || []) listener(event); }
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function settle() { for (let index = 0; index < 30; index++) await Promise.resolve(); }

function harness(options = {}) {
  let now = options.now || START, timerId = 0;
  let session = options.session === undefined ? { user: { id: USER_A }, access_token: 'existing-token-a' } : options.session;
  const timers = new Map(), authListeners = [], requests = [], outcomes = [];
  const document = Object.assign(target(), { visibilityState: options.hidden ? 'hidden' : 'visible', hidden: !!options.hidden });
  const window = Object.assign(target(), {
    document,
    location: { search: options.search || '', hostname: options.hostname || 'plantbased-balance.org' },
    navigator: { onLine: options.online !== false },
    crypto: { randomUUID: () => '00000000-0000-4000-8000-' + String(++uuidCounter).padStart(12, '0') },
    AbortController,
    localStorage: options.localStorage || storage(), sessionStorage: options.sessionStorage || storage(),
    currentUser: { id: USER_A }, _pbbAuthGuardReady: options.ready !== false,
    getBalanceAppUsageTrackerState: () => ({ userId: USER_A, sessionId: 'existing-usage-session' }),
    supabaseClient: { auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: listener => { authListeners.push(listener); return { data: { subscription: { unsubscribe() {} } } }; }
    } },
    fetch: async (url, init) => {
      requests.push({ url, ...init, payload: JSON.parse(init.body), at: now });
      const outcome = outcomes.shift();
      if (outcome instanceof Error) throw outcome;
      if (outcome?.promise) return outcome.promise;
      return { status: outcome || 202 };
    }
  }, options.globals || {});
  const native = target();
  if (options.native) {
    window.Capacitor = { Plugins: { App: {
      addListener: (type, callback) => { native.addEventListener(type, callback); return Promise.resolve({ remove() {} }); },
      getState: async () => ({ isActive: options.nativeActive !== false })
    } } };
  }
  function schedule(callback, delay, interval) {
    const id = ++timerId;
    timers.set(id, { callback, due: now + Number(delay || 0), interval });
    return id;
  }
  const context = vm.createContext({
    window, document, URLSearchParams, Uint8Array, console,
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback, delay) => schedule(callback, delay, 0), clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => schedule(callback, delay, delay), clearInterval: id => timers.delete(id)
  });
  vm.runInContext(source, context);
  return {
    window, document, requests, outcomes, context,
    async advance(ms) {
      await settle();
      const until = now + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, timer]) => timer.due <= until).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.due;
        if (timer.interval) timer.due += timer.interval;
        else timers.delete(id);
        timer.callback();
        await settle();
      }
      now = until;
      await settle();
    },
    hide() { document.hidden = true; document.visibilityState = 'hidden'; document.emit('visibilitychange'); },
    show() { document.hidden = false; document.visibilityState = 'visible'; document.emit('visibilitychange'); },
    nativeState(isActive) { native.emit('appStateChange', { isActive }); },
    auth(next, event = next ? 'SIGNED_IN' : 'SIGNED_OUT') {
      session = next;
      for (const listener of authListeners) listener(event, next);
    },
    interact(trusted = true) { document.emit('pointerdown', { isTrusted: trusted, target: { privateValue: 'must never be read' } }); }
  };
}

test('authenticated initial launch waits two seconds and sends only the approved presence fields', async () => {
  const app = harness();
  await app.advance(1999);
  assert.equal(app.requests.length, 0);
  await app.advance(1);
  assert.equal(app.requests.length, 1);
  const request = app.requests[0];
  assert.equal(request.url, '/.netlify/functions/client-activity-event');
  assert.equal(request.method, 'POST');
  assert.equal(request.headers.Authorization, 'Bearer existing-token-a');
  assert.deepEqual(Object.keys(request.payload).sort(), ['event_id', 'kind', 'occurred_at', 'usage_session_id', 'visible']);
  assert.equal(request.payload.kind, 'foreground');
  assert.equal(request.payload.usage_session_id, 'existing-usage-session');
  assert.equal(request.payload.visible, true);
  assert.equal(request.payload.occurred_at, new Date(START + 2000).toISOString());
  assert.match(request.payload.event_id, /^[a-f0-9-]{36}$/i);
  assert.equal(request.credentials, 'omit');
});

test('hidden startup and brief visibility changes cannot create foreground activity', async () => {
  const app = harness({ hidden: true });
  await app.advance(65000);
  assert.equal(app.requests.length, 0);
  app.show();
  await app.advance(1500);
  app.hide();
  await app.advance(2500);
  assert.equal(app.requests.length, 0);
  app.show();
  await app.advance(2000);
  assert.equal(app.requests.length, 1);
});

test('presence heartbeat needs actual recent interaction and stops when idle or hidden', async () => {
  const app = harness();
  await app.advance(2000);
  app.interact(false);
  await app.advance(180000);
  assert.deepEqual(app.requests.map(request => request.payload.kind), ['foreground']);
  app.interact();
  await app.advance(60000);
  assert.equal(app.requests.at(-1).payload.kind, 'presence');
  await app.advance(310000);
  const afterIdle = app.requests.length;
  await app.advance(180000);
  assert.equal(app.requests.length, afterIdle);
  app.hide();
  app.interact();
  await app.advance(120000);
  assert.equal(app.requests.length, afterIdle);
});

test('refreshes share cooldowns while distinct tab sessions still register for server dedupe', async () => {
  const localStorage = storage(), sessionStorage = storage();
  const first = harness({ localStorage, sessionStorage });
  await first.advance(2000);
  assert.equal(first.requests.length, 1);
  const refreshed = harness({ localStorage, sessionStorage, now: START + 3000 });
  const otherTab = harness({ localStorage, now: START + 3000 });
  await refreshed.advance(2000);
  await otherTab.advance(2000);
  assert.equal(refreshed.requests.length, 0);
  assert.equal(otherTab.requests.length, 0);
  const distinctTab = harness({ localStorage, now: START + 3000, globals: {
    getBalanceAppUsageTrackerState: () => ({ userId: USER_A, sessionId: 'distinct-tab-session' })
  } });
  await distinctTab.advance(2000);
  assert.equal(distinctTab.requests.length, 1);
  assert.equal(distinctTab.requests[0].payload.usage_session_id, 'distinct-tab-session');
  assert.ok([...localStorage.values.keys()].every(key => key.startsWith('pbb_client_activity_hint_v1:')));
  for (const value of localStorage.values.values()) {
    const hint = JSON.parse(value);
    assert.deepEqual(Object.keys(hint).sort(), ['at', 'usage_session_id']);
    assert.equal(typeof hint.at, 'number');
    assert.equal(typeof hint.usage_session_id, 'string');
  }
  first.hide();
  await first.advance(62000);
  first.show();
  await first.advance(2000);
  assert.equal(first.requests.length, 2);
});

test('a real interaction after ten idle minutes re-confirms foreground before presence', async () => {
  const app = harness();
  await app.advance(12 * 60000);
  assert.equal(app.requests.length, 1);
  app.interact(false);
  await app.advance(5000);
  assert.equal(app.requests.length, 1);
  app.interact();
  await app.advance(1999);
  assert.equal(app.requests.length, 1);
  // More interactions during confirmation must not postpone it indefinitely.
  app.interact();
  await app.advance(1);
  assert.equal(app.requests.length, 2);
  assert.equal(app.requests[1].payload.kind, 'foreground');
  assert.notEqual(app.requests[1].payload.event_id, app.requests[0].payload.event_id);
  await app.advance(65000);
  assert.equal(app.requests[2].payload.kind, 'presence');
});

test('idle re-confirmation cancels on hide and does not fire for recent activity', async () => {
  const app = harness();
  await app.advance(2000);
  app.interact();
  await app.advance(590000);
  const beforeRecent = app.requests.length;
  app.interact();
  await app.advance(2000);
  assert.equal(app.requests.filter(request => request.payload.kind === 'foreground').length, 1);
  assert.ok(app.requests.length >= beforeRecent);
  await app.advance(11 * 60000);
  app.interact();
  await app.advance(1000);
  app.hide();
  const beforeHidden = app.requests.length;
  await app.advance(5000);
  assert.equal(app.requests.length, beforeHidden);
  app.show();
  await app.advance(2000);
  assert.equal(app.requests.at(-1).payload.kind, 'foreground');
});

test('transient retries retain the exact event UUID and payload after token refresh', async () => {
  const app = harness();
  app.outcomes.push(new Error('offline transport'), 503, 202);
  await app.advance(2000);
  const original = app.requests[0].payload;
  app.auth({ user: { id: USER_A }, access_token: 'refreshed-token-a' }, 'TOKEN_REFRESHED');
  await app.advance(28000);
  assert.equal(app.requests.length, 3);
  assert.deepEqual(app.requests.map(request => request.payload), [original, original, original]);
  assert.equal(app.requests[2].payload.occurred_at, new Date(START + 2000).toISOString());
  assert.equal(app.requests[1].headers.Authorization, 'Bearer refreshed-token-a');
});

test('offline events wait for reconnection; expired events require fresh foreground confirmation', async () => {
  const app = harness({ online: false });
  await app.advance(2000);
  assert.equal(app.requests.length, 0);
  app.window.navigator.onLine = true;
  app.window.emit('online');
  await app.advance(0);
  assert.equal(app.requests.length, 1);
  const stale = harness({ online: false });
  await stale.advance(7 * 60000);
  stale.window.navigator.onLine = true;
  stale.window.emit('online');
  await stale.advance(0);
  assert.equal(stale.requests.length, 0);
  await stale.advance(1999);
  assert.equal(stale.requests.length, 0);
  await stale.advance(1);
  assert.equal(stale.requests.length, 1);
  assert.equal(stale.requests[0].payload.kind, 'foreground');
  assert.equal(stale.requests[0].payload.occurred_at, new Date(START + 7 * 60000 + 2000).toISOString());
});

test('long offline use reconnects with fresh foreground before any queued presence', async () => {
  const app = harness();
  await app.advance(2000);
  const initial = app.requests[0].payload;
  app.window.navigator.onLine = false;
  for (let minute = 0; minute < 12; minute++) {
    app.interact();
    await app.advance(60000);
  }
  assert.equal(app.requests.length, 1);
  app.window.navigator.onLine = true;
  app.window.emit('online');
  await app.advance(1999);
  assert.equal(app.requests.length, 1);
  await app.advance(1);
  assert.equal(app.requests.length, 2);
  assert.equal(app.requests[1].payload.kind, 'foreground');
  assert.notEqual(app.requests[1].payload.event_id, initial.event_id);
  await app.advance(65000);
  assert.equal(app.requests[2].payload.kind, 'presence');
});

test('reconnect keeps a recent retry UUID and waits while the app is hidden', async () => {
  const app = harness();
  app.outcomes.push(new Error('lost network'));
  await app.advance(2000);
  const original = app.requests[0].payload;
  app.window.navigator.onLine = false;
  app.hide();
  await app.advance(10000);
  app.window.navigator.onLine = true;
  app.window.emit('online');
  await app.advance(5000);
  assert.equal(app.requests.length, 1);
  app.show();
  await app.advance(2000);
  assert.equal(app.requests.length, 2);
  assert.deepEqual(app.requests[1].payload, original);
});

test('guest, admin view, preview and known test surfaces never send events', async () => {
  const cases = [
    { globals: { guestMode: true } }, { globals: { isAdminViewing: true } },
    { globals: { metaAdTrialMode: true } }, { globals: { __balanceOnboardingAnalyticsTest: true } },
    { globals: { userProfile: { id: USER_A, is_test_account: true } } },
    { globals: { isBalanceAdminEmail: () => true } },
    { search: '?view_as=client' }, { search: '?guest=true' }, { search: '?testFlow=1' },
    { search: '?meta_trial=facebook_5m_foundations_v3' }, { search: '?utm_campaign=onboarding_test' },
    { search: '?preview=true' }, { hostname: 'deploy-preview-123--balance.netlify.app' }, { hostname: 'localhost' }
  ];
  for (const options of cases) {
    const app = harness(options);
    await app.advance(65000);
    app.interact();
    await app.advance(65000);
    assert.equal(app.requests.length, 0, JSON.stringify(options));
  }
});

test('auth guard readiness, bearer session and exact matching identity are required', async () => {
  const app = harness({ ready: false });
  await app.advance(10000);
  assert.equal(app.requests.length, 0);
  app.window._pbbAuthGuardReady = true;
  app.window.emit('pbbCurrentUserReady');
  await app.advance(2000);
  assert.equal(app.requests.length, 1);
  for (const session of [null, { user: { id: USER_A } }, { user: { id: USER_B }, access_token: 'b' }]) {
    const invalid = harness({ session });
    await invalid.advance(15000);
    assert.equal(invalid.requests.length, 0);
  }
});

test('account switches discard old queued events and reject the old tracker session', async () => {
  const app = harness({ online: false });
  await app.advance(2000);
  app.interact();
  app.auth({ user: { id: USER_B }, access_token: 'existing-token-b' });
  app.window.currentUser = { id: USER_B };
  app.window.navigator.onLine = true;
  await app.advance(2000);
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].headers.Authorization, 'Bearer existing-token-b');
  assert.notEqual(app.requests[0].payload.usage_session_id, 'existing-usage-session');
  assert.match(app.requests[0].payload.usage_session_id, /^[a-f0-9-]{36}$/i);
  await app.advance(120000);
  assert.equal(app.requests.length, 1, 'previous account interaction must not authorize new account presence');
  app.auth(null);
  await app.advance(120000);
  assert.equal(app.requests.length, 1);
});

test('a stale asynchronous session cannot send after an identity switch', async () => {
  const app = harness();
  await app.advance(0);
  const pending = deferred();
  app.window.supabaseClient.auth.getSession = () => pending.promise;
  await app.advance(2000);
  app.auth({ user: { id: USER_B }, access_token: 'existing-token-b' });
  app.window.currentUser = { id: USER_B };
  pending.resolve({ data: { session: { user: { id: USER_A }, access_token: 'stale-token-a' } } });
  await app.advance(0);
  assert.equal(app.requests.length, 0);
});

test('native background state overrides visible WebView and resume confirms again', async () => {
  const app = harness({ native: true, nativeActive: false });
  await app.advance(65000);
  assert.equal(app.requests.length, 0);
  app.nativeState(true);
  await app.advance(1999);
  assert.equal(app.requests.length, 0);
  await app.advance(1);
  assert.equal(app.requests.length, 1);
  app.interact();
  app.nativeState(false);
  await app.advance(120000);
  assert.equal(app.requests.length, 1);
  app.nativeState(true);
  await app.advance(2000);
  assert.equal(app.requests.length, 2);
  assert.equal(app.requests[1].payload.kind, 'foreground');
});

test('pagehide cancels pending visibility and bfcache pageshow restarts confirmation', async () => {
  const app = harness();
  await app.advance(1000);
  app.window.emit('pagehide');
  await app.advance(10000);
  assert.equal(app.requests.length, 0);
  app.window.emit('pageshow');
  await app.advance(2000);
  assert.equal(app.requests.length, 1);
});

test('hiding while getSession is in flight prevents a late foreground request', async () => {
  const app = harness();
  await app.advance(0);
  const pending = deferred();
  app.window.supabaseClient.auth.getSession = () => pending.promise;
  await app.advance(2000);
  app.hide();
  pending.resolve({ data: { session: { user: { id: USER_A }, access_token: 'a' } } });
  await app.advance(0);
  assert.equal(app.requests.length, 0);
});

test('permanent request failures are not retried and duplicate script loads are inert', async () => {
  const app = harness();
  app.outcomes.push(403);
  vm.runInContext(source, app.context);
  await app.advance(120000);
  assert.equal(app.requests.length, 1);
});

test('persistent transient failures stop after eight attempts with one stable event ID', async () => {
  const app = harness();
  app.outcomes.push(...Array(20).fill(503));
  await app.advance(15 * 60000);
  assert.equal(app.requests.length, 8);
  assert.equal(new Set(app.requests.map(request => request.payload.event_id)).size, 1);
});

test('storage failures retain in-memory cooldowns and safe cryptographic UUID fallback', async () => {
  const unavailable = { getItem() { throw new Error('storage unavailable'); }, setItem() { throw new Error('storage unavailable'); } };
  const app = harness({ localStorage: unavailable, sessionStorage: unavailable, globals: {
    crypto: { getRandomValues: bytes => bytes.fill(66) }, getBalanceAppUsageTrackerState: undefined
  } });
  await app.advance(2000);
  assert.equal(app.requests.length, 1);
  assert.match(app.requests[0].payload.event_id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i);
  app.hide();
  app.show();
  await app.advance(2000);
  assert.equal(app.requests.length, 1);
});

test('a missing native getState implementation falls back to document visibility', async () => {
  const app = harness({ globals: { Capacitor: { Plugins: { App: {
    addListener: () => Promise.resolve({ remove() {} }),
    getState() { throw new Error('not implemented'); }
  } } } } });
  await app.advance(2000);
  assert.equal(app.requests.length, 1);
});

test('late initial native state cannot override a newer background notification', async () => {
  const pending = deferred();
  let notifyNative;
  const app = harness({ globals: { Capacitor: { Plugins: { App: {
    addListener: (_, callback) => { notifyNative = callback; return Promise.resolve({ remove() {} }); },
    getState: () => pending.promise
  } } } } });
  await app.advance(0);
  notifyNative({ isActive: false });
  pending.resolve({ isActive: true });
  await app.advance(10000);
  assert.equal(app.requests.length, 0);
  notifyNative({ isActive: true });
  await app.advance(2000);
  assert.equal(app.requests.length, 1);
});

test('dashboard includes the versioned foreground signal once', () => {
  const html = fs.readFileSync('dashboard.html', 'utf8');
  assert.equal((html.match(/pbb-client-activity-alerts\.js\?v=1-foreground/g) || []).length, 1);
});
