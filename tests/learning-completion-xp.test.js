const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const inline = fs.readFileSync(path.join(root, 'lib', 'learning-inline.js'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'supabase', 'migrations', '20260718120000_raise_learning_completion_bonuses.sql'),
  'utf8'
);

test('Learn completion bonuses match in the client and database', () => {
  assert.match(inline, /UNIT_COMPLETE_BONUS:\s*20/);
  assert.match(inline, /MODULE_COMPLETE_BONUS:\s*100/);
  assert.match(inline, /\$\{isComplete \? '• Completed' : '• \+10 XP'\}/);
  assert.match(migration, /xp_per_unit INTEGER := 20/);
  assert.match(migration, /xp_per_module INTEGER := 100/);
});

test('completion milestones remain one-time awards', () => {
  assert.match(migration, /ON CONFLICT DO NOTHING\s+RETURNING TRUE INTO milestone_inserted/g);
  assert.match(migration, /'xp_earned', 0, 'already_completed', TRUE/g);
});
