const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const nativeHealthSource = fs.readFileSync(path.join(root, 'lib', 'native-health.js'), 'utf8');
const fitbitCardSource = fs.readFileSync(path.join(root, 'js', 'dashboard', 'pbb-deferred-fitbit.js'), 'utf8');
const fitbitSyncSource = fs.readFileSync(path.join(root, 'netlify', 'edge-functions', 'fitbit-sync.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');

let requestedReadTypes = [];
const activityRows = [];
const inserts = [];
const updates = [];
const healthPlugin = {
  async isAvailable() { return { available: true }; },
  async requestAuthorization(options) {
    requestedReadTypes = options.read;
    return { readAuthorized: options.read };
  },
  async queryWorkouts() {
    return {
      workouts: [{
        workoutType: 'walking',
        duration: 3600,
        totalEnergyBurned: 332,
        totalDistance: 5230,
        startDate: '2026-07-15T01:00:00.000Z',
        endDate: '2026-07-15T02:00:00.000Z',
        sourceName: 'Pixel Watch',
        sourceId: 'pixel-watch',
        platformId: 'walk-123'
      }]
    };
  }
};

function activityQuery() {
  let insertedRow = null;
  let updatedValues = null;
  return {
    select() { return this; },
    eq() { return this; },
    in() { return this; },
    limit() { return this; },
    insert(row) { insertedRow = row; return this; },
    update(values) { updatedValues = values; return this; },
    single() {
      if (insertedRow) {
        const saved = { ...insertedRow, id: `row-${activityRows.length + 1}` };
        activityRows.push(saved);
        inserts.push(saved);
        return Promise.resolve({ data: saved, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve, reject) {
      if (updatedValues) updates.push(updatedValues);
      return Promise.resolve({ data: activityRows, error: null }).then(resolve, reject);
    }
  };
}

const context = {
  console,
  Date,
  window: {
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      Plugins: { Health: healthPlugin }
    }
  }
};
vm.runInNewContext(nativeHealthSource, context, { filename: 'native-health.js' });

const supabase = { from: (table) => {
  assert.strictEqual(table, 'activity_logs');
  return activityQuery();
} };

(async () => {
  assert.strictEqual(await context.window.NativeHealth.init(), true, 'native health should initialise');
  assert.ok(requestedReadTypes.includes('workouts'), 'workout sessions must be requested at runtime');

  const firstImport = await context.window.NativeHealth.syncWorkoutsForSharing(supabase, 'user-1', 2);
  assert.strictEqual(firstImport.length, 1, 'a detected walk should create one imported activity');
  assert.strictEqual(inserts[0].source, 'native_health');
  assert.strictEqual(inserts[0].activity_type, 'walking');
  assert.strictEqual(inserts[0].duration_minutes, 60);
  assert.strictEqual(inserts[0].external_activity_id, 'native:walk-123');
  assert.strictEqual(inserts[0].source_metadata.distance_km, 5.23);

  const secondImport = await context.window.NativeHealth.syncWorkoutsForSharing(supabase, 'user-1', 2);
  assert.strictEqual(secondImport.length, 0, 'the same native session must not create a second share card');
  assert.strictEqual(inserts.length, 1, 'native session import should be idempotent');
  assert.strictEqual(updates.length, 1, 'existing sessions should refresh their metrics');

  assert.match(manifest, /android\.permission\.health\.READ_EXERCISE"\s*\/>/, 'Android must retain Health Connect exercise permission');
  assert.doesNotMatch(manifest, /READ_EXERCISE"\s+tools:node="remove"/, 'Android must not strip exercise permission');
  assert.match(fitbitCardSource, /getRecentImportedFromSources/, 'the home card must read both Fitbit and native imports');
  assert.match(fitbitCardSource, /maybeSyncFitbitImportedActivity\(\)/, 'the dashboard should sync Fitbit without a manual tap');
  assert.match(fitbitCardSource, /visibilitychange/, 'returning to the app should refresh the card');
  assert.match(fitbitSyncSource, /existingRow\.source === "native_health" && isSameImportedMovement/, 'late Fitbit syncs must not duplicate native sessions');

  console.log('Imported activity hardening tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
