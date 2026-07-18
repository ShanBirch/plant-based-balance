const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('perfect quizzes award 5 XP in both client and database paths', () => {
  const inline = read('lib/learning-inline.js');
  const config = read('lib/learning-config.js');
  const migration = read('supabase/migrations/20260716130000_raise_perfect_quiz_xp.sql');

  assert.match(inline, /LESSON_COMPLETE:\s*5/);
  assert.match(inline, /Math\.max\(0, expectedQuizXp - dbXpEarned\)/);
  assert.match(config, /LESSON_COMPLETE:\s*5/);
  assert.match(migration, /xp_per_lesson INTEGER := 5/);
});

test('daily quiz totals 15 XP before the existing challenge multiplier', () => {
  const inline = read('lib/learning-inline.js');
  const pointsConfig = read('lib/points-config.js');
  const dashboard = read('dashboard.html');
  const homeQuiz = read('js/dashboard/pbb-home-card-quiz.js');

  assert.match(inline, /dailyQuizBonus = 10 \* _quizXpMultiplier/);
  assert.match(pointsConfig, /DAILY_QUIZ_BONUS:\s*10/);
  assert.match(dashboard, /\+15 XP earned\. Come back tomorrow!/);
  assert.match(homeQuiz, /var xpAmount = perfect \? 15 : 1;/);
});
