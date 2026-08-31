const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const learning = fs.readFileSync(path.join(root, 'lib/learning-inline.js'), 'utf8');

test('paid onboarding previews all six Foundations weeks before the first quiz', () => {
  const required = dashboard.match(/const REQUIRED_ONBOARDING_TOUR_TITLES = \[[\s\S]*?\n  \];/)?.[0] || '';
  const weekTitles = [
    'Week 1: Why change feels hard',
    'Week 2: Work with your energy',
    'Week 3: Build a rhythm that sticks',
    'Week 4: Take the fight out of food',
    'Week 5: Make progress easier to repeat',
    'Week 6: Build your sustainable way forward'
  ];

  let previousIndex = required.indexOf('Introduce yourself');
  weekTitles.forEach((title) => {
    const index = required.indexOf(title);
    assert.ok(index > previousIndex, `${title} should follow the previous preview step`);
    previousIndex = index;
  });
  assert.ok(required.indexOf('Read, then take the quiz') > previousIndex);
});

test('each course-preview card explains the weekly actions and To do next handoff', () => {
  assert.match(dashboard, /Week 1: Why change feels hard[^\n]*five short quizzes[^\n]*introduce yourself[^\n]*complete your check-in[^\n]*To do next/);
  assert.match(dashboard, /Week 2: Work with your energy[^\n]*comment on a Feed post[^\n]*weekly check-in/);
  assert.match(dashboard, /Week 3: Build a rhythm that sticks[^\n]*share a completed workout[^\n]*weekly check-in/);
  assert.match(dashboard, /Week 4: Take the fight out of food[^\n]*share a logged meal[^\n]*Fitness Diary[^\n]*check-in/);
  assert.match(dashboard, /Week 5: Make progress easier to repeat[^\n]*exercise PB[^\n]*check-in/);
  assert.match(dashboard, /Week 6: Build your sustainable way forward[^\n]*course reflection[^\n]*final check-in[^\n]*To do next/);
});

test('the visible Course roadmap uses the same six approved week names as the tour', () => {
  [
    'Why change feels hard',
    'Work with your energy',
    'Build a rhythm that sticks',
    'Take the fight out of food',
    'Make progress easier to repeat',
    'Build your sustainable way forward'
  ].forEach((title) => assert.match(learning, new RegExp(`title: '${title}'`)));
});

test('the tour opens each real course week without starting or completing it', () => {
  assert.match(dashboard, /function openMetaPreviewFoundationsWeek\(weekNumber\)/);
  assert.match(dashboard, /previewBalanceFoundationsWeekForTour\(weekNumber\)/);
  assert.match(learning, /window\.previewBalanceFoundationsWeekForTour = function\(weekNumber\)/);
  assert.match(learning, /learningState\.expandedCourseId = BALANCE_FOUNDATIONS\.id/);
  assert.match(learning, /learningState\.expandedFoundationsWeekNumber = number/);
  const previewFunction = learning.match(/window\.previewBalanceFoundationsWeekForTour = function\(weekNumber\)[\s\S]*?\n    };/)?.[0] || '';
  assert.doesNotMatch(previewFunction, /startFoundationsLesson|lessons_completed\.push/);
});

test('the first quiz starts directly after the Week 6 preview', () => {
  assert.match(dashboard, /title:'Week 6: Build your sustainable way forward'[^\n]*nextLabel:'Start Week 1'/);
  assert.match(dashboard, /Object\.assign\(foundationsTourStep, \{[\s\S]*?tab:'learning'[\s\S]*?promptBeforeAction:false[\s\S]*?openMetaPreviewFirstFoundationsLesson\(\)/);
  assert.match(dashboard, /learning-inline\.js\?v=31-course-preview-tour-handoff/g);
});

test('posting the introduction returns Home before the course To do prompt', () => {
  const feedGate = dashboard.match(/if \(step && step\.requiresFeedPost\)[\s\S]*?if \(step && step\.requiresFoundationsLesson\)/)?.[0] || '';
  assert.match(feedGate, /if \(step\.returnHomeAfter\) await ensureTab\('dashboard'\)/);
  assert.match(feedGate, /showStep\(completedStepIndex \+ 1\)/);
  assert.ok(
    feedGate.indexOf("ensureTab('dashboard')") < feedGate.indexOf('showStep(completedStepIndex + 1)'),
    'Home should be visible before the next required prompt is rendered'
  );
});
