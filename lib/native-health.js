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

// Health data types we want to read
const HEALTH_DATA_TYPES = {
  steps: 'steps',
  heartRate: 'heart_rate',
  sleep: 'sleep',
  activeCalories: 'active_energy_burned',
  exercise: 'workout',
  restingHeartRate: 'resting_heart_rate',
  hrv: 'heart_rate_variability_sdnn',
  distance: 'distance',
};

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
    const { CapacitorHealth } = await import('@capgo/capacitor-health');

    // Check if Health Connect / HealthKit is available on this device
    const available = await CapacitorHealth.isAvailable();
    if (!available.available) {
      console.log('[NativeHealth] Health platform not available on this device');
      return false;
    }

    // Request permissions for all data types we need
    const permissions = await CapacitorHealth.requestAuthorization({
      read: [
        'steps',
        'heart_rate',
        'sleep',
        'active_energy_burned',
        'workout',
        'resting_heart_rate',
        'heart_rate_variability_sdnn',
        'distance',
      ],
      write: [
        'steps',
        'workout',
        'active_energy_burned',
      ],
    });

    console.log('[NativeHealth] Authorization result:', permissions);

    // Store that we've initialized native health
    window._nativeHealthReady = true;
    window._CapacitorHealth = CapacitorHealth;

    return true;
  } catch (err) {
    console.error('[NativeHealth] Init failed:', err);
    return false;
  }
}

/**
 * Get today's step count from Health Connect / HealthKit
 */
async function getNativeSteps(daysBack = 0) {
  if (!window._nativeHealthReady || !window._CapacitorHealth) return null;

  try {
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    const endDate = daysBack === 0 ? now : new Date(startDate);
    if (daysBack > 0) endDate.setHours(23, 59, 59, 999);

    const result = await window._CapacitorHealth.queryAggregated({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dataType: 'steps',
    });

    return result?.value || 0;
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
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    const endDate = daysBack === 0 ? now : new Date(startDate);
    if (daysBack > 0) endDate.setHours(23, 59, 59, 999);

    const result = await window._CapacitorHealth.query({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dataType: 'heart_rate',
      limit: 100,
    });

    if (!result?.data || result.data.length === 0) return null;

    const values = result.data.map(d => d.value);
    return {
      latest: values[values.length - 1],
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      min: Math.min(...values),
      max: Math.max(...values),
      readings: result.data.length,
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

    const result = await window._CapacitorHealth.query({
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      dataType: 'sleep',
      limit: 10,
    });

    if (!result?.data || result.data.length === 0) return null;

    // Calculate total sleep duration in minutes
    let totalMinutes = 0;
    result.data.forEach(session => {
      if (session.startDate && session.endDate) {
        const start = new Date(session.startDate);
        const end = new Date(session.endDate);
        totalMinutes += (end - start) / 60000;
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);

    return {
      totalMinutes: Math.round(totalMinutes),
      formatted: `${hours}h ${mins}m`,
      sessions: result.data.length,
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
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - daysBack);
    startDate.setHours(0, 0, 0, 0);

    const endDate = daysBack === 0 ? now : new Date(startDate);
    if (daysBack > 0) endDate.setHours(23, 59, 59, 999);

    const result = await window._CapacitorHealth.queryAggregated({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dataType: 'active_energy_burned',
    });

    return result?.value ? Math.round(result.value) : 0;
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

    const result = await window._CapacitorHealth.query({
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      dataType: 'workout',
      limit: 50,
    });

    if (!result?.data) return [];

    return result.data.map(w => ({
      type: w.value || w.workoutType || 'Unknown',
      startDate: w.startDate,
      endDate: w.endDate,
      duration: w.startDate && w.endDate
        ? Math.round((new Date(w.endDate) - new Date(w.startDate)) / 60000)
        : 0,
      calories: w.calories || 0,
      distance: w.distance || 0,
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
    source: 'native',  // So you know this came from Health Connect/HealthKit
    timestamp: new Date().toISOString(),
  };
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
};
