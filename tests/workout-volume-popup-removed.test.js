const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const workoutScript = fs.readFileSync(
  path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
  'utf8'
);

test('workout opens without the last-volume interruption', () => {
  assert.doesNotMatch(dashboard, /id="last-volume-popup"/);
  assert.doesNotMatch(dashboard, />Last Workout Volume</);
  assert.doesNotMatch(dashboard, /Can you beat it today\? Every rep counts!/);
  assert.doesNotMatch(workoutScript, /popup\.style\.display = 'flex'/);
  assert.doesNotMatch(workoutScript, /setTimeout\(dismissVolumePopup, 4000\)/);
});

test('useful workout volume comparison remains available', () => {
  assert.match(dashboard, /id="total-volume-bar"/);
  assert.match(workoutScript, /function updateTotalWorkoutVolume\(\)/);
  assert.match(workoutScript, /calculateLastWorkoutTotalVolume\(\)/);
  assert.match(dashboard, /v=230-remove-volume-popup/);
});
