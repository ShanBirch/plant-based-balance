const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const dashboard = read('dashboard.html');
const standaloneGuide = read('xp-guide.html');
const guideScript = read('js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js');
const learning = read('lib/learning-inline.js');
const pointsConfig = read('lib/points-config.js');
const stories = read('lib/stories.js');
const topPostAward = read('netlify/functions/award-feed-top-post.js');

test('How to Earn XP matches current Learn rewards', () => {
  assert.match(learning, /LESSON_COMPLETE:\s*10/);
  assert.match(learning, /MIND_LESSON_COMPLETE:\s*20/);
  assert.match(learning, /UNIT_COMPLETE_BONUS:\s*20/);
  assert.match(learning, /MODULE_COMPLETE_BONUS:\s*100/);

  assert.match(guideScript, /amount: '\+10', title: 'New lesson complete'/);
  assert.match(guideScript, /amount: '\+20', title: 'Mind lesson complete'/);
  assert.match(guideScript, /amount: '\+20', title: 'Unit complete'/);
  assert.match(guideScript, /amount: '\+100', title: 'Entire topic complete'/);
  assert.match(guideScript, /amount: '\+10\/\+20', title: 'Daily quiz'[^\n]*Mind quizzes earn 20 XP/);

  assert.match(standaloneGuide, />\+10<\/span><span><strong>New lesson complete/);
  assert.match(standaloneGuide, />\+20<\/span><span><strong>Mind lesson complete/);
  assert.match(standaloneGuide, />\+20<\/span><span><strong>Unit complete/);
  assert.match(standaloneGuide, />\+100<\/span><span><strong>Entire topic complete/);
  assert.match(standaloneGuide, />\+10\/\+20<\/span><span><strong>Daily quiz[^\n]*Mind quizzes earn 20 XP/);
});

test('How to Earn XP matches current social and progress rewards', () => {
  assert.match(pointsConfig, /POINTS_PER_SOCIAL_SHARE:\s*15/);
  assert.match(pointsConfig, /POINTS_PER_PROGRESS_PHOTO_SHARE:\s*20/);
  assert.match(pointsConfig, /POINTS_PER_MILESTONE_FEED_SHARE:\s*10/);
  assert.match(pointsConfig, /POINTS_PER_EXERCISE_CONTRIBUTION:\s*15/);
  assert.match(stories, /const pointsAmount = 1;[\s\S]{0,700}First Feed reaction today/);
  assert.match(topPostAward, /const TOP_POST_XP = 5/);

  for (const guide of [guideScript, standaloneGuide]) {
    assert.match(guide, /Meal Instagram Feed share/);
    assert.match(guide, /Workout or PB Instagram Feed share/);
    assert.match(guide, /Activity Instagram Story share/);
    assert.match(guide, /First Feed reaction/);
    assert.match(guide, /Yesterday's top post/);
    assert.match(guide, /Share weekly progress/);
    assert.match(guide, /Exercise contribution/);
  }
});

test('fast route totals and mobile script versions are current', () => {
  assert.match(dashboard, /Log an accepted meal[^\r\n]*\+33 XP/);
  assert.match(dashboard, /Log a workout[^\r\n]*\+31 XP/);
  assert.match(dashboard, /fresh daily quiz[^\r\n]*\+12 XP/);
  assert.match(dashboard, /dashboard-script-6-ai_coach_draft_mode_logic_auth\.js\?v=42-welcome-gate/g);
  assert.match(dashboard, /lib\/learning-inline\.js\?v=13/g);
});

test('public XP guides do not expose internal automation wording or stale Health IQ rewards', () => {
  assert.doesNotMatch(standaloneGuide, /\bAI\b|AI-/);
  assert.doesNotMatch(guideScript, /amount: '\+5', title: 'New lesson complete'/);
  assert.doesNotMatch(guideScript, /amount: '\+2', title: 'Unit complete'/);
  assert.doesNotMatch(guideScript, /title: 'Module complete'/);
  assert.doesNotMatch(guideScript, /amount: '\+15', title: 'Daily quiz'/);
});
