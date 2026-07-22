const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('perfect Mind quizzes award 20 XP in both client and database paths', () => {
  const inline = read('lib/learning-inline.js');
  const config = read('lib/learning-config.js');
  const migration = read('supabase/migrations/20260722090000_raise_mind_quiz_xp.sql');

  assert.match(inline, /LESSON_COMPLETE:\s*10/);
  assert.match(inline, /MIND_LESSON_COMPLETE:\s*20/);
  assert.match(inline, /unit\.moduleId === 'mind'[\s\S]{0,120}LEARNING_XP\.MIND_LESSON_COMPLETE/);
  assert.match(inline, /Math\.max\(0, expectedQuizXp - dbXpEarned\)/);
  assert.match(config, /LESSON_COMPLETE:\s*10/);
  assert.match(config, /MIND_LESSON_COMPLETE:\s*20/);
  assert.match(migration, /p_module_id = 'mind'[\s\S]{0,120}THEN 20[\s\S]{0,40}ELSE 10/);
});

test('daily quiz UI uses the module reward with no stacking', () => {
  const inline = read('lib/learning-inline.js');
  const pointsConfig = read('lib/points-config.js');
  const dashboard = read('dashboard.html');
  const homeQuiz = read('js/dashboard/pbb-home-card-quiz.js');
  const dailyQuiz = read('js/dashboard/pbb-deferred-dailyquiz.js');
  const migration = read('supabase/migrations/20260722090000_raise_mind_quiz_xp.sql');

  assert.match(inline, /const expectedQuizXp = lessonCompletionXp;/);
  assert.doesNotMatch(inline, /dailyQuizBonus = 10/);
  assert.match(pointsConfig, /DAILY_QUIZ_BONUS:\s*0/);
  assert.match(dashboard, /<h3[^>]*>Daily Quiz<\/h3>[\s\S]{0,500}id="daily-quiz-xp-reward"/);
  assert.match(dashboard, /id="daily-quiz-xp-earned"/);
  assert.match(homeQuiz, /HLQ\.module && HLQ\.module\.id === 'mind' \? 20 : 10/);
  assert.match(dailyQuiz, /module\.id === 'mind' \? 20 : 10/);
  assert.match(dailyQuiz, /refreshDailyQuizCard = function\(xpEarned\)/);
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
