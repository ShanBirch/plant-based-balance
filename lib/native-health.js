/**
 * Native Health Bridge
 *
 * Reads health data from Health Connect (Android) and HealthKit (iOS)
 * via the @capgo/capacitor-health plugin when running as a native app.
 *
 * Falls back gracefully to the existing REST API integrations
 * (Fitbit, WHOOP, Oura, Strava) when running as a web app.
 */

// Check if we're running inside Capacitor native shell
function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

// Data types supported by @capgo/capacitor-health (camelCase, NOT Health Connect raw names)
const READ_TYPES = [
  'steps',
  'distance',
  'calories',
  'heartRate',
  'restingHeartRate',
  'heartRateVariability',
  'sleep',
];
const WRITE_TYPES = ['steps', 'calories'];

/**
 * Initialize native health integration
 * Call this during app startup — it will no-op on web
 */
async function initNativeHealth() {
  if (!isNativeApp()) {
    console.log('[NativeHealth] Not a native app, skipping Health Connect/HealthKit init');
    return false;
  }

  try {
    // Plugin is injected by the Capacitor native shell — must NOT use dynamic
    // import() because dashboard.html is loaded remotely from a CDN with no bundler.
    const CapacitorHealth = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Health;
    if (!CapacitorHealth) {
      window._nativeHealthLastError = 'Capacitor.Plugins.Health not found (plugin not installed in native shell)';
      console.error('[NativeHealth] Capacitor.Plugins.Health is missing');
      if (typeof showWearableToast === 'function') showWearableToast('Health plugin missing from native shell');
      return false;
    }

    // Check if Health Connect / HealthKit is available on this device
    const available = await CapacitorHealth.isAvailable();
    console.log('[NativeHealth] isAvailable result:', JSON.stringify(available));
    if (!available || !available.available) {
      const reason = (available && available.reason) ? available.reason : 'unknown';
      window._nativeHealthLastError = 'isAvailable=false (' + reason + ')';
      console.log('[NativeHealth] Health platform not available on this device', available);
      if (typeof showWearableToast === 'function') {
        showWearableToast('Health unavailable: ' + reason);
      }
      return false;
    }

    // Request permissions for all data types we need.
    // On iOS this triggers the per-type HealthKit permission sheet.
    const permissions = await CapacitorHealth.requestAuthorization({
      read: READ_TYPES,
      write: WRITE_TYPES,
    });

    console.log('[NativeHealth] Authorization result:', JSON.stringify(permissions));

    window._nativeHealthReady = true;
    window._CapacitorHealth = CapacitorHealth;

    return true;
  } catch (err) {
    const msg = (err && (err.message || err.errorMessage)) || String(err);
    window._nativeHealthLastError = msg;
    console.error('[NativeHealth] Init failed:', err);
    if (typeof showWearableToast === 'function') {
      showWearableToast('Health init error: ' + msg);
    }
    return false;
  }
}

function _rangeForDaysBack(daysBack) {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  const endDate = daysBack === 0 ? now : new Date(startDate);
  if (daysBack > 0) endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

/**
 * Get today's step count from Health Connect / HealthKit
 */
async function getNativeSteps(daysBack = 0) {
  if (!window._nativeHealthReady || !window._CapacitorHealth) return null;

  try {
    const { startDate, endDate } = _rangeForDaysBack(daysBack);
    const result = await window._CapacitorHealth.queryAggregated({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dataType: 'steps',
      bucket: 'day',
      aggregation: 'sum',
    });

    const samples = result?.samples || [];
    return samples.reduce((sum, s) => sum + (s.value || 0), 0);
  } catch (err) {
    console.error('[NativeHealth] Error reading steps:', err);
    return null;
  }
}

/**
 * Get heart rate data from Health Connect / HealthKit
 */
async function getNativeHeartRate(daysBack = 0) {
  if (!window._nativeHealthReady || !window._CapacitorHealth) return null;

  try {
    const { startDate, endDate } = _rangeForDaysBack(daysBack);
    const result = await window._CapacitorHealth.readSamples({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dataType: 'heartRate',
      limit: 100,
    });

    const samples = result?.samples || [];
    if (samples.length === 0) return null;

    const values = samples.map(d => d.value);
    return {
      latest: values[values.length - 1],
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
      readings: samples.length,
    };
  } catch (err) {
    console.error('[NativeHealth] Error reading heart rate:', err);
    return null;
  }
}

/**
 * Get sleep data from Health Connect / HealthKit
 */
async function getNativeSleep(daysBack = 1) {
  if (!window._nativeHealthReady || !window._CapacitorHealth) return null;

  try {
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    const result = await window._CapacitorHealth.readSamples({
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      dataType: 'sleep',
      limit: 200,
    });

    const samples = result?.samples || [];
    if (samples.length === 0) return null;

    // Only count actual asleep states (skip 'inBed' / 'awake')
    const ASLEEP_STATES = new Set(['asleep', 'rem', 'deep', 'light']);

    let totalMinutes = 0;
    samples.forEach(s => {
      if (!s.startDate || !s.endDate) return;
      if (s.sleepState && !ASLEEP_STATES.has(s.sleepState)) return;
      totalMinutes += (new Date(s.endDate) - new Date(s.startDate)) / 60000;
    });

    if (totalMinutes <= 0) return null;

    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);

    return {
      totalMinutes: Math.round(totalMinutes),
      formatted: `${hours}h ${mins}m`,
      sessions: samples.length,
    };
  } catch (err) {
    console.error('[NativeHealth] Error reading sleep:', err);
    return null;
  }
}

/**
 * Get active calories from Health Connect / HealthKit
 */
async function getNativeCalories(daysBack = 0) {
  if (!window._nativeHealthReady || !window._CapacitorHealth) return null;

  try {
    const { startDate, endDate } = _rangeForDaysBack(daysBack);
    const result = await window._CapacitorHealth.queryAggregated({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dataType: 'calories',
      bucket: 'day',
      aggregation: 'sum',
    });

    const samples = result?.samples || [];
    const total = samples.reduce((sum, s) => sum + (s.value || 0), 0);
    return Math.round(total);
  } catch (err) {
    console.error('[NativeHealth] Error reading calories:', err);
    return null;
  }
}

/**
 * Get exercise/workout data from Health Connect / HealthKit
 */
async function getNativeWorkouts(daysBack = 7) {
  if (!window._nativeHealthReady || !window._CapacitorHealth) return null;

  try {
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    const result = await window._CapacitorHealth.queryWorkouts({
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      limit: 50,
    });

    const workouts = result?.workouts || [];
    return workouts.map(w => ({
      type: w.workoutType || 'other',
      startDate: w.startDate,
      endDate: w.endDate,
      duration: w.duration ? Math.round(w.duration / 60) : 0,
      calories: w.totalEnergyBurned || 0,
      distance: w.totalDistance || 0,
    }));
  } catch (err) {
    console.error('[NativeHealth] Error reading workouts:', err);
    return null;
  }
}

/**
 * Get a full health summary (today's data from all sources)
 * This is the main function your dashboard can call
 */
async function getNativeHealthSummary() {
  if (!window._nativeHealthReady) return null;

  const [steps, heartRate, sleep, calories, workouts] = await Promise.all([
    getNativeSteps(0),
    getNativeHeartRate(0),
    getNativeSleep(1),
    getNativeCalories(0),
    getNativeWorkouts(7),
  ]);

  return {
    steps,
    heartRate,
    sleep,
    calories,
    workouts,
    source: 'native',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sync native sleep data to the DB so the sleep challenge can score it.
 * Reads the past 7 days from HealthKit/Health Connect and saves any days
 * not already covered by a wearable (WHOOP/Oura) into oura_sleep.
 * Safe to call on startup and periodically — skips days that already have data.
 */
async function syncNativeSleepForChallenge(supabaseClient, userId) {
  if (!window._nativeHealthReady || !window._CapacitorHealth) return;
  if (!supabaseClient || !userId) return;

  try {
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    const startStr = startDate.toISOString().split('T')[0];

    const result = await window._CapacitorHealth.readSamples({
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      dataType: 'sleep',
      limit: 500,
    });

    const samples = result?.samples || [];
    if (samples.length === 0) return;

    const ASLEEP_STATES = new Set(['asleep', 'rem', 'deep', 'light']);

    // Group asleep sessions by the date the user woke up
    const byDate = {};
    for (const s of samples) {
      if (!s.startDate || !s.endDate) continue;
      if (s.sleepState && !ASLEEP_STATES.has(s.sleepState)) continue;
      const endDt = new Date(s.endDate);
      const dateStr = endDt.toISOString().split('T')[0];
      const durationMins = Math.round((endDt - new Date(s.startDate)) / 60000);
      byDate[dateStr] = (byDate[dateStr] || 0) + durationMins;
    }

    if (Object.keys(byDate).length === 0) return;

    const [ouraRes, whoopRes] = await Promise.all([
      supabaseClient.from('oura_sleep').select('date').eq('user_id', userId).gte('date', startStr),
      supabaseClient.from('whoop_sleep').select('date').eq('user_id', userId).gte('date', startStr),
    ]);

    const coveredDates = new Set([
      ...((ouraRes.data || []).map(r => r.date)),
      ...((whoopRes.data || []).map(r => r.date)),
    ]);

    let anyInserted = false;
    for (const [date, totalMinutes] of Object.entries(byDate)) {
      if (totalMinutes < 60) continue;
      if (coveredDates.has(date)) continue;

      const { error } = await supabaseClient
        .from('oura_sleep')
        .insert({ user_id: userId, date, total_sleep_minutes: totalMinutes, sleep_score: null, deep_minutes: null });

      if (!error) anyInserted = true;
    }

    if (anyInserted && typeof refreshChallengeProgress === 'function') {
      refreshChallengeProgress();
    }
  } catch (err) {
    console.warn('[NativeHealth] Sleep-challenge sync failed:', err);
  }
}

// Export to window so dashboard.html can use them
window.NativeHealth = {
  isNativeApp,
  init: initNativeHealth,
  getSteps: getNativeSteps,
  getHeartRate: getNativeHeartRate,
  getSleep: getNativeSleep,
  getCalories: getNativeCalories,
  getWorkouts: getNativeWorkouts,
  getSummary: getNativeHealthSummary,
  syncSleepForChallenge: syncNativeSleepForChallenge,

  /**
   * Lightweight permission check — uses checkAuthorization() which does NOT
   * re-prompt the user. Use this when rechecking after the user returns from
   * the system Health permission UI.
   */
  checkPermission: async function() {
    if (window._nativeHealthReady) return true;
    if (!isNativeApp()) return false;
    try {
      const CapacitorHealth = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Health;
      if (!CapacitorHealth) return false;
      const available = await CapacitorHealth.isAvailable();
      if (!available || !available.available) return false;

      const status = await CapacitorHealth.checkAuthorization({
        read: READ_TYPES,
        write: WRITE_TYPES,
      });

      const granted = (status?.readAuthorized || []).length > 0;
      if (granted) {
        window._nativeHealthReady = true;
        window._CapacitorHealth = CapacitorHealth;
      }
      return granted;
    } catch (_) {
      return false;
    }
  },
};
