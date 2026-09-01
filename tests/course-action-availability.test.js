const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const journey = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
const learning = fs.readFileSync(path.join(root, 'lib/learning-inline.js'), 'utf8');
const diary = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-1-daily_weighin_card_logic.js'), 'utf8');
const checkin = fs.readFileSync(path.join(root, 'js/dashboard/pbb-weekly-checkin-preview.js'), 'utf8');

test('course steps explain and enforce their local diary and Brisbane check-in windows', () => {
  assert.match(journey, /function taskAvailability\(item, date\)/);
  assert.match(journey, /\['Fri', 'Sat', 'Sun'\]\.includes\(clock\.weekday\)/);
  assert.match(journey, /Available Friday–Sunday/);
  assert.match(journey, /const localHour = \(date \|\| new Date\(\)\)\.getHours\(\)/);
  assert.match(journey, /localHour >= 18/);
  assert.match(journey, /Available from 6 pm today/);
  assert.match(learning, /action\.availableNow === false/);
  assert.match(learning, /course-week-action-timing/);
  assert.match(diary, /new Date\(\)\.getHours\(\) < 18/);
  assert.doesNotMatch(diary, /getBrisbaneHour/);
  assert.match(checkin, /function isWeeklyCheckinWindowOpen\(date\)/);
  assert.match(checkin, /weekly check-in opens Friday and stays available through Sunday/);
});
