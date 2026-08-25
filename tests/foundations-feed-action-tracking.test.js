const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const journey = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
const stories = fs.readFileSync(path.join(root, 'lib/stories.js'), 'utf8');
const supabase = fs.readFileSync(path.join(root, 'lib/supabase.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260825090000_foundations_feed_action_tracking.sql'), 'utf8');

test('Foundations community progression contains only the intended in-app Feed action for each week', () => {
  const foundations = journey.slice(journey.indexOf('const WEEK_DEFINITIONS'), journey.indexOf("week: 7,"));
  const expected = [
    ['w1_feed_intro', 'foundations_feed_intro'],
    ['w2_feed_comment', 'foundations_feed_comments'],
    ['w3_workout_feed', 'foundations_workout_feed'],
    ['w4_meal_feed', 'foundations_meal_feed'],
    ['w4_diary_feed', 'foundations_diary_feed'],
    ['w5_pb_feed', 'foundations_pb_feed'],
    ['w6_feed_reflection', 'foundations_feed_reflection']
  ];

  for (const [taskId, evidenceType] of expected) {
    assert.match(foundations, new RegExp(`task\\('${taskId}'[\\s\\S]*?'${evidenceType}'`));
  }
  assert.doesNotMatch(foundations, /Instagram|instagram_shares|_instagram_share|daily_manual|task\([^\n]+, 'manual'/);
});

test('each Feed action requires specific durable evidence and cannot be satisfied by an unrelated event', () => {
  assert.match(journey, /course_action_id === actionId && String\(row\.caption \|\| ''\)\.trim\(\)\.length > 0/);
  assert.match(journey, /foundations_feed_intro: linkedTextPostCount\('w1_feed_intro'\)/);
  assert.match(journey, /stories!inner\(user_id\)[\s\S]*?\.neq\('stories\.user_id', currentUserId\(\)\)/);
  assert.match(journey, /foundations_workout_feed: stories\.filter\(row => row\.media_type === 'workout_card' && storyCard\(row\)\.card_type === 'workout' && !!storyCard\(row\)\.workout_date\)/);
  assert.match(journey, /foundations_meal_feed: stories\.filter\(row => row\.media_type === 'meal_card' && storyCard\(row\)\.card_type === 'meal'\)/);
  assert.match(journey, /foundations_diary_feed: linkedDiaryShares/);
  assert.match(journey, /from\('pb_history'\)[\s\S]*?\.gte\('achieved_at', startIso\)[\s\S]*?\.lt\('achieved_at', endIso\)/);
  assert.match(journey, /foundations_pb_feed: stories\.filter\(row => row\.media_type === 'workout_card' && storyCard\(row\)\.card_type === 'pb' && currentWeekPbIds\.has\(String\(storyCard\(row\)\.pb_history_id \|\| ''\)\)\)/);
  assert.match(journey, /foundations_feed_reflection: linkedTextPostCount\('w6_feed_reflection'\)/);
});

test('introduction and reflection links persist on the Feed row and are consumed only after a real text post', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS course_action_id text/);
  assert.match(migration, /'w1_feed_intro'[\s\S]*?'w6_feed_reflection'/);
  assert.match(supabase, /insertData\.course_action_id = storyData\.course_action_id/);
  assert.match(stories, /\['w1_feed_intro', 'w6_feed_reflection'\]\.includes\(foundationsCourseActionId\) \|\| !caption/);
  assert.match(stories, /course_action_id: foundationsCourseActionId \|\| null/);
  assert.match(stories, /sessionStorage\.removeItem\('pbb_foundations_feed_action'\)/);
});

test('PB chooser preserves its pb_history receipt and progress refreshes after Feed events', () => {
  assert.match(stories, /card_type: 'pb',[\s\S]*?pb_history_id: row\.id \|\| null/);
  assert.match(supabase, /window\.socialJourney\.refresh/);
  assert.match(stories, /Foundations comment progress refresh failed/);
});
