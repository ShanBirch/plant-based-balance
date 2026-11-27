const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(process.env.NATIVE_HEALTH_SOURCE || path.join(__dirname, '../lib/native-health.js'), 'utf8');

function setup(options = {}) {
  const diagnostics = [], saved = [], painted = [], energyWrites = [];
  let checks = 0, prompts = 0;
  const permissions = options.permissions || ['steps', 'calories', 'sleep', 'workouts'];
  const plugin = {
    isAvailable: async () => ({ available: true }),
    checkAuthorization: async () => { checks++; return { readAuthorized: permissions }; },
    requestAuthorization: async () => { prompts++; return { readAuthorized: permissions }; },
    queryAggregated: async ({ dataType, startDate, endDate }) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (options.iphone && dataType === 'calories' && end - start > 86400000) {
        options.onEnergyRead?.();
        if (options.emptyEnergy) return { samples: [] };
        return { samples: [
          { startDate: start.toISOString(), value: 210.6, unit: 'kilocalorie' },
          { startDate: start.toISOString(), value: 200, unit: 'kilocalorie' },
          { startDate: end.toISOString(), value: 400, unit: 'kilocalorie' },
          { startDate: new Date(+start + 86400000).toISOString(), value: 100, unit: 'joule' },
        ] };
      }
      return { samples: [{ value: 100 }] };
    },
    readSamples: async () => {
      if (options.hang) return new Promise(() => {});
      if (options.sleepError) throw new Error(options.sleepError);
      return { samples: options.empty ? [] : [{ startDate: '2026-09-11T20:00:00+10:00', endDate: '2026-09-12T04:38:00+10:00' }] };
    },
  };
  const client = {
    async rpc(name, payload) {
      energyWrites.push({ name, ...payload });
      return options.energySaveError ? { error: new Error('network failed') } : { data: 1 };
    },
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
      localStorage: { getItem: () => options.connected ? 'true' : null },
      Capacitor: { isNativePlatform: () => true, getPlatform: () => options.iphone ? 'ios' : 'android', Plugins: { Health: plugin } },
      _nativeHealthReady: true, // stale flag; plugin reference deliberately absent
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, diagnostics, saved, painted, energyWrites, checks: () => checks, prompts: () => prompts };
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

  const apple = setup({ iphone: true, connected: true });
  await apple.context.window.NativeHealth.recoverConnection();
  await apple.context.window.NativeHealth.getSummary();
  assert.equal(apple.energyWrites.length, 1, 'repeated summaries share the hourly sync');
  assert.equal(apple.energyWrites[0].name, 'fill_apple_health_active_energy');
  assert.equal(apple.energyWrites[0].p_days.length, 1, 'today and non-kcal samples are excluded');
  assert.equal(apple.energyWrites[0].p_days[0].active_calories, 211, 'duplicate buckets are never summed');
  assert.equal('total_calories' in apple.energyWrites[0].p_days[0], false);
  assert.ok(apple.diagnostics.some(row => row.activity_data.stage === 'active_energy_save' && row.activity_data.days_saved === 1));

  for (const options of [{ iphone: true }, { connected: true }, { iphone: true, connected: true, emptyEnergy: true }]) {
    const skipped = setup(options);
    await skipped.context.window.NativeHealth.recoverConnection();
    assert.equal(skipped.energyWrites.length, 0, 'only a connected iPhone with usable active energy is uploaded');
  }

  const accountSwitch = { iphone: true, connected: true };
  const changed = setup(accountSwitch);
  accountSwitch.onEnergyRead = () => { changed.context.window.currentUser = { id: 'member-b' }; };
  await changed.context.window.NativeHealth.recoverConnection();
  assert.equal(changed.energyWrites.length, 0, 'an in-flight query must not cross accounts');

  const failedEnergy = setup({ iphone: true, connected: true, energySaveError: true });
  await failedEnergy.context.window.NativeHealth.recoverConnection();
  assert.ok(failedEnergy.diagnostics.some(row => row.activity_data.stage === 'active_energy_save' && row.activity_data.status === 'failed'));

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
