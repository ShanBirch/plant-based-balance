const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const journey = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
const learning = fs.readFileSync(path.join(root, 'lib/learning-inline.js'), 'utf8');
const diary = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-1-daily_weighin_card_logic.js'), 'utf8');
const checkin = fs.readFileSync(path.join(root, 'js/dashboard/pbb-weekly-checkin-preview.js'), 'utf8');

test('course steps explain and enforce their real Brisbane availability windows', () => {
  assert.match(journey, /function taskAvailability\(item, date\)/);
  assert.match(journey, /\['Fri', 'Sat', 'Sun'\]\.includes\(clock\.weekday\)/);
  assert.match(journey, /Available Friday–Sunday/);
  assert.match(journey, /clock\.hour >= 17/);
  assert.match(journey, /Available from 5 pm today/);
  assert.match(learning, /action\.availableNow === false/);
  assert.match(learning, /course-week-action-timing/);
  assert.match(diary, /function getBrisbaneHour\(date\)/);
  assert.match(diary, /getBrisbaneHour\(\) < 17/);
  assert.match(checkin, /function isWeeklyCheckinWindowOpen\(date\)/);
  assert.match(checkin, /weekly check-in opens Friday and stays available through Sunday/);
});
