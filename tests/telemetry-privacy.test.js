const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const privacy = require('../lib/telemetry-privacy.js');
const read = path => fs.readFileSync(path, 'utf8');

test('source URLs retain filename diagnostics without query, fragment or userinfo', () => {
  for (const value of [
    'https://dummy-user:dummy-pass@example.invalid/js/app.js?access_token=DUMMY_QUERY#DUMMY_FRAGMENT',
    '/js/app.js#refresh_token=DUMMY_FRAGMENT',
    '//example.invalid/js/app.js?anything=DUMMY_QUERY',
    'https%3A%2F%2Fexample.invalid%2Fjs%2Fapp.js%3Faccess_token%3DDUMMY_QUERY',
    '/js/app.js%253Faccess_token%253DDUMMY_QUERY',
    '/js/app.js&#63;key=DUMMY_QUERY',
    '/js/app.js\\u003fkey=DUMMY_QUERY',
    '/js/app.js?key=DUMMY_QUERY%20DUMMY_REMAINDER',
    '/js/app.js%3Fkey=DUMMY_QUERY%ZZ',
    'https:\\example.invalid\\js\\app.js?key=DUMMY_QUERY',
    'https:\\/\\/example.invalid\\/js\\/app.js?key=DUMMY_QUERY',
  ]) assert.equal(privacy.sourceFile(value), 'app.js');
  assert.equal(privacy.string('at https://example.invalid/js/app.js:42:7'), 'at https://example.invalid/js/app.js:42:7');
  assert.equal(privacy.sourceFile('C:\\app\\bundle.js'), 'bundle.js');
});

test('normalized and encoded credential markers cannot survive punctuation stripping or truncation', () => {
  for (const value of [
    'app.js_access_token_DUMMY', 'app.js_accesstoken_DUMMY',
    'refresh-token-DUMMY', 'id.token.DUMMY', 'AUTHORIZATION_DUMMY',
    'api-key-DUMMY', 'clientsecretDUMMY', 'Bearer DUMMY',
    'access%5Ftoken%3DDUMMY', 'a.c.c.e.s.s.t.o.k.e.n_DUMMY',
    'x'.repeat(140) + 'refresh_token_DUMMY',
    'data:text/javascript,DUMMY', 'blob:https://example.invalid/DUMMY',
    'javascript:DUMMY', 'eyJdummy.dummy.dummy',
    'dummy-user:dummy-pass@example.invalid/app.js',
  ]) assert.equal(privacy.string(value), '[redacted]');
  const result = privacy.sanitize({ nested: { 'a.p.i.k.e.y': 'DUMMY', 'access%5Ftoken': 'DUMMY', count: 2 }, source_file: 'app.js_accesstoken_DUMMY', line: 42 });
  assert.deepEqual(result, { nested: { count: 2 }, source_file: 'redacted', line: 42 });
});

function harness(withPrivacy = true) {
  const listeners = {}, rows = [];
  let fail = false;
  const window = {
    BalanceTelemetryPrivacy: withPrivacy ? privacy : undefined,
    addEventListener: (name, fn) => { listeners[name] = fn; },
    currentUser: { id: 'dummy-user' }, location: { pathname: '/dashboard.html' },
    getBalanceAppUsageTrackerState: () => ({ sessionId: 'dummy-session' }),
    BalanceReplay: { getSessionId: () => 'dummy-replay' },
    supabaseClient: { from: table => {
      assert.equal(table, 'user_activity');
      return { insert: async batch => {
        if (fail) { fail = false; return { error: { code: 'DUMMY_RETRY' } }; }
        rows.push(...JSON.parse(JSON.stringify(batch))); return {};
      } };
    } }
  };
  const document = { readyState: 'loading', addEventListener() {}, querySelectorAll: () => [] };
  vm.runInNewContext(read('js/dashboard/pbb-app-telemetry.js'), {
    window, document, MutationObserver: class {}, setTimeout: () => 1, setInterval() {}, console: { warn() {} }
  });
  return { window, rows, listeners, failNext: () => { fail = true; } };
}

test('actual error handlers and flush sanitize before insert while normal tracking and retry work', async () => {
  const h = harness();
  h.listeners.error({ filename: 'https://example.invalid/js/app.js?access_token=DUMMY_QUERY', lineno: 42, colno: 7, error: { name: 'TypeError' } });
  h.listeners.error({ filename: 'app.js_accesstoken_DUMMY_NORMALIZED', lineno: 51, error: { name: 'Error' } });
  h.listeners.unhandledrejection({ reason: { name: 'Bearer DUMMY_REASON' } });
  h.window.trackBalanceActivity('app_tab_opened', { tab: 'movement', source: 'nav-movement', count: 3, success: true, detail: '/app.js?key=DUMMY_DETAIL', nested: { 'access-token': 'DUMMY_KEY' } });
  h.failNext();
  await h.window.flushBalanceActivity();
  assert.equal(h.rows.length, 0);
  await h.window.flushBalanceActivity();
  assert.equal(h.rows.length, 5);
  const error = h.rows.find(row => row.activity_data.line === 42).activity_data;
  assert.equal(error.source_file, 'app.js');
  assert.equal(error.error_name, 'typeerror');
  assert.equal(error.column, 7);
  assert.equal(error.path, '/dashboard.html');
  assert.equal(error.session_id, 'dummy-session');
  assert.equal(error.replay_session_id, 'dummy-replay');
  const normal = h.rows.find(row => row.activity_type === 'app_tab_opened').activity_data;
  assert.equal(normal.tab, 'movement'); assert.equal(normal.count, 3); assert.equal(normal.success, true);
  assert.doesNotMatch(JSON.stringify(h.rows), /DUMMY_|accesstoken|access_token/);
});

test('missing privacy helper fails closed without inserting telemetry', () => {
  const h = harness(false);
  assert.equal(h.window.trackBalanceActivity, undefined);
  assert.equal(h.rows.length, 0);
});

test('db.activity sanitizes both writes and historical read projections without mutating stored rows', async () => {
  const source = read('lib/supabase.js').replace(/\r\n/g, '\n');
  const section = source.slice(source.indexOf('  activity: {'), source.indexOf('  /**\n   * Admin operations'));
  let inserted;
  const stored = { id: 'dummy-id', activity_type: 'app_client_error', activity_data: { source_file: 'app.js_accesstoken_DUMMY_HISTORY', line: 33, 'api-key': 'DUMMY_KEY' } };
  const chain = {
    insert: rows => { inserted = rows; return chain; }, select: () => chain, eq: () => chain, order: () => chain,
    limit: async () => ({ data: [stored] }), single: async () => ({ data: inserted[0] })
  };
  const activity = vm.runInNewContext('({' + section + '}).activity', { supabase: { from: () => chain }, pbbTelemetryPrivacy: async () => privacy });
  const logged = await activity.log('dummy-user', 'page_view', { path: '/dashboard.html?key=DUMMY_QUERY', count: 1 });
  assert.equal(logged.activity_data.path, '/dashboard.html');
  const recent = await activity.getRecent('dummy-user');
  assert.equal(recent[0].activity_data.source_file, 'redacted');
  assert.equal(recent[0].activity_data.line, 33);
  assert.doesNotMatch(JSON.stringify(recent), /DUMMY_/);
  assert.match(stored.activity_data.source_file, /DUMMY_HISTORY/);
});

test('shared privacy loader rejects on asset failure and can retry without unprotected writes', async () => {
  const source = read('lib/supabase.js');
  const loader = source.slice(source.indexOf('var pbbTelemetryPrivacyLoading;'), source.indexOf('function pbbOfflineCacheKey'));
  let loads = 0;
  const window = {};
  const context = vm.createContext({ window, document: {
    createElement: () => ({}), head: { appendChild: script => {
      loads++;
      if (loads === 1) script.onerror();
      else { window.BalanceTelemetryPrivacy = privacy; script.onload(); }
    } }
  } });
  vm.runInContext(loader, context);
  await assert.rejects(context.pbbTelemetryPrivacy(), /privacy helper unavailable/);
  assert.equal(await context.pbbTelemetryPrivacy(), privacy);
  assert.equal(loads, 2);
});

test('dashboard loads versioned privacy helper before telemetry', () => {
  const html = read('dashboard.html');
  assert.ok(html.indexOf('/lib/telemetry-privacy.js?v=1') < html.indexOf('pbb-app-telemetry.js?v=3-privacy'));
  assert.match(html, /script_part_2.js\?v=25-telemetry-privacy/);
  assert.equal((read('js/dashboard/script_part_2.js').match(/supabase.js\?v=20-telemetry-privacy/g) || []).length, 2);
});
