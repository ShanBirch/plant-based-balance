const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const journey = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
const nextSteps = fs.readFileSync(path.join(root, 'js/dashboard/pbb-next-obvious-steps.js'), 'utf8');
const foundations = journey.slice(journey.indexOf('const WEEK_DEFINITIONS'), journey.indexOf("week: 7,"));

test('Foundations Weeks 1 to 6 expose the intended actionable destinations', () => {
  const expected = [
    ['w1_feed_intro', 'feed'],
    ['w1_wearable_setup', 'wearable'],
    ['w1_weekly_checkin', 'checkin'],
    ['w2_feed_comment', 'feed'],
    ['w2_weekly_checkin', 'checkin'],
    ['w3_workout_feed', 'movement'],
    ['w3_weekly_checkin', 'checkin'],
    ['w4_meal_feed', 'meals'],
    ['w4_diary_feed', 'diary'],
    ['w4_weekly_checkin', 'checkin'],
    ['w5_pb_feed', 'movement'],
    ['w5_weekly_checkin', 'checkin'],
    ['w6_feed_reflection', 'feed'],
    ['w6_weekly_checkin', 'checkin']
  ];

  for (const [id, destination] of expected) {
    assert.match(foundations, new RegExp(`task\\('${id}'[\\s\\S]*?'${destination}'\\)`));
  }
});

test('Home To Do Next opens the due weekly action directly', () => {
  assert.match(journey, /function getNextJourneyTask\(\)/);
  assert.match(journey, /function openUnifiedAction\(\)[\s\S]*?const nextTask = getNextJourneyTask\(\);[\s\S]*?taskAction\(nextTask\.id\);/);
  assert.match(journey, /if \(item\.action === 'feed'\) return 'Open Feed'/);
  assert.match(journey, /if \(item\.action === 'meals'\) return 'Open Nutrition'/);
  assert.match(journey, /if \(item\.action === 'movement'\) return 'Open Movement'/);
  assert.match(journey, /if \(item\.type === 'weekly_checkin'\) return item\.complete \? 'Sent' : 'Open check-in'/);
  assert.match(journey, /if \(action === 'checkin'[\s\S]*?openWeeklyCheckinPreview/);
});

test('Week 2 adds the one-time first-week Activity Insights review', () => {
  assert.match(nextSteps, /id: 'activity_insights_intro'[\s\S]*?title: 'Review your first week in Activity Insights'/);
  assert.match(nextSteps, /hasReachedSecondProgramWeek\(\) && !hasSeenOnboardingStep\('activity_insights_intro'\)/);
  assert.match(nextSteps, /markOnboardingStepSeen\('activity_insights_intro'\);[\s\S]*?openInsightsTarget\(\);/);
});
