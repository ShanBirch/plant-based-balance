const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const weeklyGoals = fs.readFileSync(
  path.join(root, 'js/dashboard/pbb-deferred-weeklygoals.js'),
  'utf8'
);
const review = fs.readFileSync(
  path.join(root, 'js/dashboard/pbb-weekly-checkin-preview.js'),
  'utf8'
);
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

assert.match(
  weeklyGoals,
  /async function refreshCompletedWeek[\s\S]*buildWeekFromStart\(weekStart\)[\s\S]*calculateProgress\(userId, week, selected\)[\s\S]*saveWeeklyRow\(userId, week, selected, result\.progress, result\.arc\)/,
  'completed weeks should be recalculated and persisted from live sources'
);

assert.match(
  weeklyGoals,
  /refreshCompletedWeek: function\(weekStart\)/,
  'Weekly Check-In should be able to request a live week refresh'
);

assert.match(
  review,
  /await window\.weeklyGoals\.refreshCompletedWeek\(week\.startKey\)/,
  'Weekly Check-In should refresh the goal week before building the summary'
);

assert.match(
  review,
  /var sourceRow = liveRow \|\| row \|\| localRow \|\| null;/,
  'a refreshed server snapshot must win over stale local storage'
);

assert.match(dashboard, /pbb-deferred-weeklygoals\.js\?v=35-balance-theme/);
assert.match(dashboard, /pbb-weekly-checkin-preview\.js\?v=27-first-week-gate/);

console.log('weekly review late-sync protection test passed');
