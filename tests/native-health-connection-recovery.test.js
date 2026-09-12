const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(process.env.NATIVE_HEALTH_SOURCE || path.join(__dirname, '../lib/native-health.js'), 'utf8');

function setup(options = {}) {
  const diagnostics = [], saved = [], painted = [];
  let checks = 0, prompts = 0;
  const permissions = options.permissions || ['steps', 'calories', 'sleep', 'workouts'];
  const plugin = {
    isAvailable: async () => ({ available: true }),
    checkAuthorization: async () => { checks++; return { readAuthorized: permissions }; },
    requestAuthorization: async () => { prompts++; return { readAuthorized: permissions }; },
    queryAggregated: async () => ({ samples: [{ value: 100 }] }),
    readSamples: async () => {
      if (options.hang) return new Promise(() => {});
      if (options.sleepError) throw new Error(options.sleepError);
      return { samples: options.empty ? [] : [{ startDate: '2026-09-11T20:00:00+10:00', endDate: '2026-09-12T04:38:00+10:00' }] };
    },
  };
  const client = {
    from(table) {
      return {
        select() { return this; }, eq() { return this; },
        async gte() { return { data: [], error: null }; },
        async insert(row) {
          if (table === 'user_activity') diagnostics.push(row);
          else {
            saved.push(row);
            if (options.saveError) return { error: { message: 'network failed', code: 'NETWORK_ERROR' } };
          }
          return { error: null };
        },
      };
    },
  };
  const context = {
    console: { log() {}, error() {}, warn() {} },
    setTimeout: options.hang ? (fn) => setTimeout(fn, 1) : setTimeout,
    clearTimeout,
    updateDashboardWithHealthData: value => painted.push(value),
    window: {
      currentUser: { id: 'member-a' }, supabaseClient: client,
      navigator: { userAgent: 'Android 16; SM-A556E; FitGotchi-Native' },
      Capacitor: { isNativePlatform: () => true, Plugins: { Health: plugin } },
      _nativeHealthReady: true, // stale flag; plugin reference deliberately absent
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, diagnostics, saved, painted, checks: () => checks, prompts: () => prompts };
}

(async () => {
  const connected = setup();
  await Promise.all([connected.context.window.NativeHealth.recoverConnection(), connected.context.window.NativeHealth.recoverConnection()]);
  assert.equal(connected.checks(), 1, 'concurrent resume callbacks share one fresh authorization check');
  assert.equal(connected.prompts(), 0, 'recovery must never reopen permissions');
  assert.equal(connected.saved.length, 1, 'stale ready flag must reattach plugin and import sleep');
  assert.equal(connected.painted.length, 1);
  await connected.context.window.NativeHealth.recoverConnection();
  assert.equal(connected.checks(), 1, 'rapid resumes must not flood Health Connect');
  assert.ok(connected.diagnostics.some(row => row.activity_data.stage === 'sleep_sync' && row.activity_data.status === 'complete'));
  assert.ok(connected.diagnostics.every(row => row.user_id === 'member-a' && row.activity_data.user_agent.includes('SM-A556E')));
  assert.ok(connected.diagnostics.every(row => !('samples' in row.activity_data) && !('totalMinutes' in row.activity_data)));

  const partial = setup({ permissions: ['steps'], sleepError: 'Sleep permission denied' });
  await partial.context.window.NativeHealth.recoverConnection();
  assert.equal(partial.saved.length, 0);
  assert.ok(partial.diagnostics.some(row => row.activity_data.stage === 'sleep_read' && row.activity_data.error_kind === 'permission'));
  assert.ok(partial.diagnostics.some(row => row.activity_data.stage === 'steps_read' && row.activity_data.status === 'received'));

  const empty = setup({ empty: true });
  await empty.context.window.NativeHealth.recoverConnection();
  assert.ok(empty.diagnostics.some(row => row.activity_data.stage === 'sleep_read' && row.activity_data.status === 'empty'));

  const denied = setup({ permissions: [] });
  await denied.context.window.NativeHealth.recoverConnection();
  assert.equal(denied.context.window._nativeHealthReady, false, 'revoked access clears stale ready flag');
  assert.equal(denied.saved.length, 0);
  assert.equal(denied.prompts(), 0);

  const failedSave = setup({ saveError: true });
  await failedSave.context.window.NativeHealth.recoverConnection();
  assert.ok(failedSave.diagnostics.some(row => row.activity_data.stage === 'sleep_sync' && row.activity_data.status === 'save_failed'));

  const stalled = setup({ hang: true });
  await stalled.context.window.NativeHealth.recoverConnection();
  assert.ok(stalled.diagnostics.some(row => row.activity_data.stage === 'sleep_read' && row.activity_data.error_kind === 'timeout'));
  assert.equal(stalled.saved.length, 0);

  const initialized = setup();
  await initialized.context.window.NativeHealth.init();
  assert.equal(initialized.prompts(), 0, 'already granted startup must not request authorization again');

  const dashboard = fs.readFileSync(process.env.NATIVE_HEALTH_DASHBOARD || path.join(__dirname, '../dashboard.html'), 'utf8');
  const callback = dashboard.slice(dashboard.indexOf('window._recheckHealthPermission = function()'), dashboard.indexOf('function updateDashboardWithHealthData(data)'));
  let resumed = 0;
  const resumeContext = { localStorage: { getItem: () => 'true' }, window: { NativeHealth: { recoverConnection: () => { resumed++; } } } };
  vm.createContext(resumeContext);
  vm.runInContext(callback, resumeContext);
  resumeContext.window._recheckHealthPermission();
  assert.equal(resumed, 1, 'the Android onResume callback must recover even with the saved connected flag');

  console.log('Native health recovery: stale bridge, independent scopes, empty reads, revoked access, failed saves, timeouts, and diagnostic privacy passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
