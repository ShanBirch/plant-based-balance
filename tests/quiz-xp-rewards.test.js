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

test('daily quiz totals 20 XP before the existing challenge multiplier', () => {
  const inline = read('lib/learning-inline.js');
  const pointsConfig = read('lib/points-config.js');
  const dashboard = read('dashboard.html');
  const homeQuiz = read('js/dashboard/pbb-home-card-quiz.js');

  assert.match(inline, /dailyQuizBonus = 10 \* _quizXpMultiplier/);
  assert.match(pointsConfig, /DAILY_QUIZ_BONUS:\s*10/);
  assert.match(dashboard, /\+20 XP earned\. Come back tomorrow!/);
  assert.match(homeQuiz, /var xpAmount = perfect \? 20 : 1;/);
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
