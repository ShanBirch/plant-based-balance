const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const learning = fs.readFileSync(path.join(root, 'lib/learning-inline.js'), 'utf8');
const nextSteps = fs.readFileSync(path.join(root, 'js/dashboard/pbb-next-obvious-steps.js'), 'utf8');

test('paid onboarding skips the six-week preview and starts the real course', () => {
  const required = dashboard.match(/const REQUIRED_ONBOARDING_TOUR_TITLES = \[[\s\S]*?\n  \];/)?.[0] || '';
  const weekTitles = [
    'Week 1: Why change feels hard',
    'Week 2: Work with your energy',
    'Week 3: Build a rhythm that sticks',
    'Week 4: Take the fight out of food',
    'Week 5: Make progress easier to repeat',
    'Week 6: Build your sustainable way forward'
  ];

  weekTitles.forEach((title) => {
    assert.equal(required.indexOf(title), -1, `${title} should not be a required tour stop`);
    assert.doesNotMatch(dashboard, new RegExp(`title:'${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  });
  assert.ok(required.indexOf('Start your course') > required.indexOf('Introduce yourself'));
  assert.ok(required.indexOf('Read, then take the quiz') > required.indexOf('Start your course'));
});

test('the visible Course roadmap still shows the six approved week names', () => {
  [
    'Why change feels hard',
    'Work with your energy',
    'Build a rhythm that sticks',
    'Take the fight out of food',
    'Make progress easier to repeat',
    'Build your sustainable way forward'
  ].forEach((title) => assert.match(learning, new RegExp(`title: '${title}'`)));
});

test('the tour guides the real course start flow before the first quiz', () => {
  const required = dashboard.match(/const REQUIRED_ONBOARDING_TOUR_TITLES = \[[\s\S]*?\n  \];/)?.[0] || '';
  const orderedTitles = [
    'Start your course',
    'Welcome to Balance Foundations',
    'Take your first lesson',
    'Read, then take the quiz'
  ];
  let previousIndex = -1;
  orderedTitles.forEach((title) => {
    const index = required.indexOf(title);
    assert.ok(index > previousIndex, `${title} should follow the previous course step`);
    previousIndex = index;
  });
  assert.match(dashboard, /sel:'#balance-foundations-course-start'[^\n]*title:'Start your course'[^\n]*promptBeforeAction:true[^\n]*data-next-step-id="foundations_intro"[^\n]*requiresHighlightedClick:true/);
  assert.match(dashboard, /sel:'#balance-foundations-welcome-start'[^\n]*fallbackSel:'#course-welcome'[^\n]*title:'Welcome to Balance Foundations'[^\n]*requiresHighlightedClick:true/);
  assert.match(dashboard, /title:'Take your first lesson'[^\n]*requiresHighlightedClick:true/);
  assert.match(dashboard, /title:'Read, then take the quiz'[^\n]*preserveSurface:true/);
  assert.doesNotMatch(dashboard, /title:'Read, then take the quiz'[^\n]*promptBeforeAction:true/);
  assert.match(dashboard, /learning-inline\.js\?v=41-required-course-welcome/);
  assert.match(nextSteps, /learning-inline\.js\?v=41-required-course-welcome/);
  assert.match(learning, /id="balance-foundations-course-start"/);
  assert.match(learning, /id="balance-foundations-welcome-start"/);
  assert.match(learning, /id="course-welcome" class="course-welcome"/);
  assert.match(learning, /course-welcome-glow/);
  assert.match(learning, /course-welcome-logo/);
  assert.match(learning, /const welcomeRequired = consumeCourseWelcomeRequirement\(course\.id\);[\s\S]*if \(welcomeRequired \|\| !isCourseStarted\(course\)\)[\s\S]*renderCourseWelcome\(course\)[\s\S]*course_welcome_opened/);
  assert.match(learning, /id="balance-foundations-first-lesson"/);
  assert.match(learning, /window\.prepareBalanceFoundationsStartForTour = function\(\)[\s\S]*?course\.progress\?\.completed[\s\S]*?localStorage\.removeItem\(getCourseStartedKey\(course\.id\)\)[\s\S]*?requireCourseWelcome\(course\.id\)/);
  assert.match(learning, /function consumeCourseWelcomeRequirement\(courseId\)[\s\S]*?sessionStorage\.removeItem\(key\)/);
  assert.match(learning, /if \(document\.getElementById\('course-welcome'\)\) return;/);
  assert.match(learning, /window\.startCourseFromWelcome = function\(courseId\)[\s\S]*?consumeCourseWelcomeRequirement\(course\.id\)[\s\S]*?markCourseStarted\(course\.id\)/);
  assert.match(dashboard, /learning-inline\.js\?v=41-required-course-welcome/g);
});

test('quiz feedback stays tappable above the guided tour', () => {
  assert.match(learning, /overlay\.id = 'game-feedback-overlay'[\s\S]*?z-index: 400200;[\s\S]*?pointer-events: auto; isolation: isolate/);
  assert.match(learning, /continueBtn\.style\.cssText = `[\s\S]*?pointer-events: auto; touch-action: manipulation/);
  assert.match(learning, /continueBtn\.addEventListener\('click',[\s\S]*?window\.continueAfterFeedback\(\)/);
  assert.match(learning, /window\.continueAfterFeedback = function\(\)[\s\S]*?learningState\.currentGameIndex\+\+[\s\S]*?renderCurrentGame\(\)/);
});

test('the Home course task stays singular and opens the course overview', () => {
  const nextSteps = fs.readFileSync(path.join(root, 'js/dashboard/pbb-next-obvious-steps.js'), 'utf8');
  assert.equal((nextSteps.match(/id: 'foundations_intro'/g) || []).length, 1);
  assert.match(nextSteps, /id: 'foundations_intro'[\s\S]*?title: 'Take your first lesson'[\s\S]*?cta: 'Take Lesson 1'/);
  assert.match(nextSteps, /function openFoundationsTarget\(\)[\s\S]*?openFoundationsCourseOverview\(\)/);
  const overview = nextSteps.match(/async function openFoundationsCourseOverview\(\)[\s\S]*?\n  }/)?.[0] || '';
  assert.match(overview, /openCoursePage\('balance-foundations'\)/);
  assert.doesNotMatch(overview, /openCurrentCourseLesson/);
});

test('posting the introduction returns Home before the course To do prompt', () => {
  const feedGate = dashboard.match(/if \(step && step\.requiresFeedPost\)[\s\S]*?if \(step && step\.requiresFoundationsLesson\)/)?.[0] || '';
  assert.match(feedGate, /if \(step\.returnHomeAfter\) await ensureTab\('dashboard'\)/);
  assert.match(feedGate, /showStep\(completedStepIndex \+ 1\)/);
  assert.ok(
    feedGate.indexOf("ensureTab('dashboard')") < feedGate.indexOf('showStep(completedStepIndex + 1)'),
    'Home should be visible before the next required prompt is rendered'
  );
  assert.match(dashboard, /const promptTab = isPromptBeforeAction \? \(step\.preActionTab \|\| 'dashboard'\) : step\.tab/);
  assert.match(dashboard, /if \(!step\.preserveSurface\) await ensureTab\(promptTab\)/);
});
