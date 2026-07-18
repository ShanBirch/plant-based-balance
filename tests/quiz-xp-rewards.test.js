const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('perfect quizzes award 10 XP in both client and database paths', () => {
  const inline = read('lib/learning-inline.js');
  const config = read('lib/learning-config.js');
  const migration = read('supabase/migrations/20260718070000_fix_quiz_xp_awards.sql');

  assert.match(inline, /LESSON_COMPLETE:\s*10/);
  assert.match(inline, /Math\.max\(0, expectedQuizXp - dbXpEarned\)/);
  assert.match(config, /LESSON_COMPLETE:\s*10/);
  assert.match(migration, /xp_per_lesson INTEGER := 10/);
});

test('every fresh perfect quiz awards a flat 10 XP with no stacking', () => {
  const inline = read('lib/learning-inline.js');
  const pointsConfig = read('lib/points-config.js');
  const dashboard = read('dashboard.html');
  const homeQuiz = read('js/dashboard/pbb-home-card-quiz.js');
  const migration = read('supabase/migrations/20260718070000_fix_quiz_xp_awards.sql');

  assert.match(inline, /const expectedQuizXp = LEARNING_XP\.LESSON_COMPLETE;/);
  assert.doesNotMatch(inline, /dailyQuizBonus = 10/);
  assert.match(pointsConfig, /DAILY_QUIZ_BONUS:\s*0/);
  assert.match(dashboard, /\+10 XP earned\. Come back tomorrow!/);
  assert.match(homeQuiz, /var xpAmount = perfect \? 10 : 1;/);
  assert.doesNotMatch(migration, /xp_per_lesson \* public\.get_active_challenge_xp_multiplier/);
});

test('learning quizzes are not silently capped after three completions', () => {
  const config = read('lib/learning-config.js');
  const migration = read('supabase/migrations/20260718070000_fix_quiz_xp_awards.sql');

  assert.doesNotMatch(config, /DAILY_LESSON_LIMIT/);
  assert.doesNotMatch(migration, /daily_limit_reached/);
  assert.match(migration, /'lessons_remaining_today', NULL/);
  assert.match(migration, /ON CONFLICT \(user_id, lesson_id, public\.to_date_immutable\(completed_at\)\)/);
});

test('completed lesson replays explain that XP was already claimed', () => {
  const inline = read('lib/learning-inline.js');

  assert.match(inline, /const isXpReplay = result\?\.is_new_lesson === false/);
  assert.match(inline, /\? 'Review Complete!'/);
  assert.match(inline, /isXpReplay \? 'Claimed' : '0'/);
  assert.match(inline, /XP for this lesson was already claimed on your first completion\./);
});
