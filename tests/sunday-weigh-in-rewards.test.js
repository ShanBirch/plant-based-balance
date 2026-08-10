const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('special weigh-in card runs on Sunday', () => {
  const client = read('js/dashboard/dashboard-script-1-daily_weighin_card_logic.js');

  assert.match(client, /function isSundayWeighInDay[\s\S]*date\.getDay\(\) === 0/);
  assert.match(client, /if \(!isSundayWeighInDay\(\)\) \{[\s\S]*card\.style\.display = 'none'[\s\S]*doneCard\.style\.display = 'none'[\s\S]*return;/);
  assert.match(client, /Sunday Weigh-Ins/);
  assert.match(client, /down from last Sunday/i);
  assert.match(client, /if \(weighInDay === 5\)[\s\S]*awardDailyWeighInFallback/);
  assert.doesNotMatch(client, /payload\.is_sunday \|\| payload\.is_friday/);
});

test('Home plan and Weekly Goals default weigh-ins to Sunday once per week', () => {
  const nextSteps = read('js/dashboard/pbb-next-obvious-steps.js');
  const weeklyGoals = read('js/dashboard/pbb-deferred-weeklygoals.js');
  const onboarding = read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');

  assert.match(nextSteps, /function isSundayWeighInDay[\s\S]*getDay\(\) === 0/);
  assert.match(nextSteps, /action\.id === 'weighin'[\s\S]*if \(!isSundayWeighInDay\(\)\) return false/);
  assert.match(nextSteps, /Complete your Sunday weigh-in/);
  assert.match(weeklyGoals, /id: 'weigh_in_days', label: 'Sunday weigh-in', target: 1, unit: 'weigh-in', min: 1, max: 1/);
  assert.match(weeklyGoals, /case 'weigh_in_days':[\s\S]*isSundayDateKey\(row\.weigh_in_date\)/);
  assert.match(onboarding, /weigh_in_days: 'Weigh in once on Sunday'/);
});

test('database compares Sunday weigh-ins and preserves the 5 plus 5 XP split', () => {
  const migration = read('supabase/migrations/20260717090000_move_special_weigh_in_to_sunday.sql');

  assert.match(migration, /EXTRACT\(ISODOW FROM v_weigh\.weigh_in_date::TIMESTAMP\) = 7/);
  assert.match(migration, /EXTRACT\(ISODOW FROM weigh_in_date::TIMESTAMP\) = 7/);
  assert.match(migration, /v_loss_points := 5/);
  assert.match(migration, /share_points_available'[\s\S]*THEN 5 ELSE 0/);
});
