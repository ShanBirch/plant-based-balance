const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
  'utf8'
);

assert.match(
  source,
  /function getMonthlyCustomProgramContext\(dayIndex, date = new Date\(\)\)[\s\S]*?window\.activeCustomProgramCache[\s\S]*?weekly_schedule/,
  'Month view should resolve the active custom program for the displayed date'
);
assert.match(
  source,
  /getMonthlyWorkoutLabel\(dayIndex, isMale, date\)/,
  'Month cells should use the date-aware custom-program label'
);
assert.match(
  source,
  /monday\.getTime\(\) === targetMonday\.getTime\(\) \|\| window\.isAdminViewing/,
  'Read-only admin view should be able to inspect a future assigned date'
);
assert.match(
  source,
  /!isCoachSessionAvailable\(workout\) && !window\.isAdminViewing/,
  'Future session gating must remain enforced for members while allowing admin QA'
);
assert.match(
  source,
  /!isCoachSessionAvailable\(dayWorkout, previewDate\) && !window\.isAdminViewing/,
  'Calendar launch gating should use the selected date while preserving the member gate'
);

console.log('monthly custom-program calendar checks passed');
