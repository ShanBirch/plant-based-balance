const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('special weigh-in card runs on Sunday', () => {
  const client = read('js/dashboard/dashboard-script-1-daily_weighin_card_logic.js');

  assert.match(client, /function isFridayWeighInDay[\s\S]*date\.getDay\(\) === 0/);
  assert.match(client, /Sunday Weigh-Ins/);
  assert.match(client, /down from last Sunday/i);
  assert.match(client, /payload\.is_sunday \|\| payload\.is_friday/);
});

test('database compares Sunday weigh-ins and preserves the 5 plus 5 XP split', () => {
  const migration = read('supabase/migrations/20260717090000_move_special_weigh_in_to_sunday.sql');

  assert.match(migration, /EXTRACT\(ISODOW FROM v_weigh\.weigh_in_date::TIMESTAMP\) = 7/);
  assert.match(migration, /EXTRACT\(ISODOW FROM weigh_in_date::TIMESTAMP\) = 7/);
  assert.match(migration, /v_loss_points := 5/);
  assert.match(migration, /share_points_available'[\s\S]*THEN 5 ELSE 0/);
});
