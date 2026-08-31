const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const workoutSource = fs.readFileSync(
  path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
  'utf8'
);

test('freshly saved workout calendar wins over a stale standalone phone key', () => {
  const start = workoutSource.indexOf('function getStoredOnboardingWorkoutCalendar');
  const end = workoutSource.indexOf('\nfunction buildOnboardingWeeklySchedule', start);
  const source = workoutSource.slice(start, end);
  assert.ok(source.indexOf('profile.workout_calendar') < source.indexOf("localStorage.getItem('workoutCalendar')"));
});

test('workout rotation repairs invalid and future dates and always returns a workout', () => {
  const start = workoutSource.indexOf('function getWorkoutRotationSelection');
  const end = workoutSource.indexOf('\nfunction buildOnboardingWeeklySchedule', start);
  const functionSource = workoutSource.slice(start, end);
  const store = new Map([['gym_split_start_date', 'not-a-date']]);
  const context = {
    localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, value)
    },
    getLocalDateString: () => '2026-08-31',
    Date,
    Number,
    Math
  };
  vm.createContext(context);
  vm.runInContext(`${functionSource}; this.pick = getWorkoutRotationSelection;`, context);
  const workouts = [{ id: 'fullbody-1', exercises: [{ name: 'Squat' }] }];
  assert.equal(context.pick(workouts, 'gym_split_start_date', new Date('2026-08-31T09:00:00')), workouts[0]);
  assert.equal(store.get('gym_split_start_date'), '2026-08-31');
});

test('guided workout waits for real workout data and records proof', () => {
  assert.match(dashboard, /async function waitForMetaPreviewWorkoutLibrary/);
  assert.match(dashboard, /await waitForMetaPreviewWorkoutLibrary\(12000\)/);
  assert.match(dashboard, /recordWorkoutTourDiagnostic\('calendar-result'/);
  assert.match(dashboard, /exerciseCount:document\.querySelectorAll\('#workout-exercises-list \.exercise-logger-card'\)\.length/);
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=222-add-exercise-contrast/);
});
