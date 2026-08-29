const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..');
const frontend = fs.readFileSync(path.join(repoRoot, 'js/dashboard/pbb-weekly-checkin-preview.js'), 'utf8');
const endpoint = fs.readFileSync(path.join(repoRoot, 'netlify/functions/submit-weekly-checkin.js'), 'utf8');
const nextSteps = fs.readFileSync(path.join(repoRoot, 'js/dashboard/pbb-next-obvious-steps.js'), 'utf8');

function loadEndpointTestHelpers() {
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    console,
    process: { env: {} },
    fetch: async () => { throw new Error('fetch should not run in helper tests'); },
    require(request) {
      if (request === 'crypto') return require('node:crypto');
      if (request === './_lib/client-context') {
        return {
          SUPABASE_URL: '',
          SUPABASE_SERVICE_KEY: '',
          normalizeGeneratedCoachDraftText: (value) => String(value || ''),
        };
      }
      throw new Error(`Unexpected require: ${request}`);
    },
  };
  vm.runInNewContext(endpoint, sandbox, { filename: 'submit-weekly-checkin.js' });
  return module.exports._test;
}

test('weekly client check-in is available Friday through Sunday', () => {
  assert.match(frontend, /day === 5 \|\| day === 6 \|\| day === 0/);
  assert.match(frontend, /current Monday-to-Sunday week/);
});

test('weekly check-in stays hidden until the first program week is complete', () => {
  assert.match(frontend, /FIRST_PROGRAM_WEEK_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(frontend, /function hasCompletedFirstProgramWeek\(\)/);
  assert.match(frontend, /Date\.now\(\) >= start\.getTime\(\) \+ FIRST_PROGRAM_WEEK_MS/);
  assert.match(frontend, /programStartKnown: false/);
  assert.match(frontend, /&& hasCompletedFirstProgramWeek\(\)/);
  assert.match(frontend, /function isGuidedTourActive\(\)/);
  assert.match(frontend, /!isGuidedTourActive\(\)/);
  assert.match(frontend, /syncProgramStartDate\(profile\)/);
});

test('an assigned Wednesday uses the same in-app form as a separate occurrence', () => {
  assert.match(frontend, /midweek_wednesday/);
  assert.match(frontend, /schedule\.additional_days\.indexOf\('wednesday'\)/);
  assert.match(frontend, /occurrence: activeOccurrence\(\) \|\| 'weekly'/);
  assert.match(endpoint, /in_app_checkins/);
  assert.match(endpoint, /weekly_checkins: weeklyCheckins/);
  assert.match(endpoint, /wednesday_accountability_card/);
});

test('the form captures useful goal-aligned coaching context', () => {
  assert.match(frontend, /weeklyGoalSnapshot/);
  assert.match(frontend, /weeklyReflectionGoalContext/);
  assert.match(frontend, /Your goal this week/);
  assert.match(frontend, /Your goals this week/);
  assert.match(frontend, /Your main goal/);
  assert.match(frontend, /What are you most proud of from this week\?/);
  assert.match(frontend, /What made this week harder or got in the way\?/);
  assert.match(frontend, /What support would make next week easier\?/);
  assert.match(frontend, /What did you learn from the Course this week\?/);
  assert.match(frontend, /name="course_learning"/);
  assert.match(frontend, /Optional if you did not complete a Course lesson this week/);
  assert.doesNotMatch(frontend, /name="course_learning"[^>]*required/);
  assert.match(frontend, /How did this week feel overall\?/);
  assert.match(frontend, /How confident do you feel about next week\?/);
  assert.match(frontend, /submit-weekly-checkin/);
});

test('the weekly form uses the same Inter typeface as the app', () => {
  assert.match(frontend, /\.pbb-wci-sheet\{[^}]*font-family:\\'Inter\\',sans-serif/);
  assert.match(frontend, /\.pbb-wci-form button,[^}]*font-family:\\'Inter\\',sans-serif!important/);
  assert.doesNotMatch(frontend, /font:750 \.82rem\/1\.4 inherit/);
});

test('the opened check-in contains the form, not the old full weekly review', () => {
  const openFunction = frontend.slice(frontend.indexOf('function openWeeklyCheckinPreview(){'), frontend.indexOf('function handleKeydown'));
  assert.match(openFunction, /renderWeeklyReflectionForm\(data\)/);
  assert.doesNotMatch(openFunction, /What we made happen/);
  assert.doesNotMatch(openFunction, /Calories and the call/);
  assert.doesNotMatch(openFunction, /Gym progress/);
  assert.doesNotMatch(openFunction, /Recovery snapshot/);
  assert.doesNotMatch(openFunction, /Suggested focus for next week/);
  assert.doesNotMatch(openFunction, /Tracking tip/);
  assert.doesNotMatch(openFunction, /data-wci-action="goals"/);
});

test('Home omits the automated review card while retaining the client check-in form', () => {
  const renderFunction = frontend.slice(frontend.indexOf('function renderCard(){'), frontend.indexOf('function showToast'));
  assert.match(renderFunction, /card\.remove\(\)/);
  assert.doesNotMatch(renderFunction, /createElement\('button'\)/);
  assert.doesNotMatch(renderFunction, /Your weekly check-in is ready/);
  assert.match(frontend, /window\.openWeeklyCheckinPreview = openWeeklyCheckinPreview/);
  assert.match(frontend, /window\.isWeeklyCheckinDue = isReviewEnabled/);
});

test('To Do Next routes a due weekly check-in directly into the client form', () => {
  assert.match(nextSteps, /id: 'weekly_review'/);
  assert.match(nextSteps, /function isWeeklyCheckinDue\(\)/);
  assert.match(nextSteps, /if \(isWeeklyCheckinDue\(\)\)/);
  assert.doesNotMatch(nextSteps, /clickSourceCard\('#weekly-checkin-card'\)/);
  assert.match(nextSteps, /openWeeklyCheckinPreview/);
});

test('submission is authenticated, durable, and routed to Shannon', () => {
  assert.match(endpoint, /getAuthedUser/);
  assert.match(endpoint, /daily_checkins\?select=id,additional_data/);
  assert.match(endpoint, /weekly_checkin: response/);
  assert.match(endpoint, /alert_type: 'weekly_checkin'/);
  assert.match(endpoint, /operator_queue: 'needs_you'/);
  assert.match(endpoint, /suggested_message: suggestedMessage/);
  assert.match(endpoint, /client_weekly_checkin_response/);
  assert.match(endpoint, /course_learning: courseLearning/);
  assert.match(endpoint, /Course learning:/);
});

test('Wednesday and end-of-week Course learning answers persist independently', () => {
  const helpers = loadEndpointTestHelpers();
  const weekStart = '2026-08-17';
  const midweek = {
    week_start: weekStart,
    occurrence: 'midweek_wednesday',
    course_learning: 'Wednesday lesson answer',
  };
  const weekly = {
    week_start: weekStart,
    occurrence: 'weekly',
    course_learning: 'Sunday lesson answer',
  };
  const afterWednesday = helpers.mergeWeeklyCheckinResponses({}, midweek);
  const afterWeekly = helpers.mergeWeeklyCheckinResponses({ weekly_checkins: afterWednesday }, weekly);
  assert.equal(afterWeekly.length, 2);
  assert.equal(afterWeekly.find((row) => row.occurrence === 'midweek_wednesday').course_learning, 'Wednesday lesson answer');
  assert.equal(afterWeekly.find((row) => row.occurrence === 'weekly').course_learning, 'Sunday lesson answer');

  const reloaded = JSON.parse(JSON.stringify({ weekly_checkins: afterWeekly }));
  assert.equal(reloaded.weekly_checkins[0].course_learning, 'Wednesday lesson answer');
  assert.equal(reloaded.weekly_checkins[1].course_learning, 'Sunday lesson answer');
});

test('server validation accepts the current Monday week and rejects incomplete answers', () => {
  const helpers = loadEndpointTestHelpers();
  const now = new Date('2026-08-22T02:00:00Z');
  const valid = helpers.validatePayload({
    week_start: '2026-08-17',
    overall: 'mixed',
    win: 'I trained twice even though work was busy.',
    blocker: 'Late meetings.',
    confidence: 4,
    support: 'routine',
    course_learning: 'Planning for the hard week matters more than planning for the perfect week.',
    goals: [{ id: 'complete_workouts', label: 'Complete workouts', current: 2, target: 3 }],
  }, now);
  assert.equal(valid.error, undefined);
  assert.equal(valid.value.week_end, '2026-08-23');
  assert.equal(valid.value.goals.length, 1);
  assert.equal(valid.value.course_learning, 'Planning for the hard week matters more than planning for the perfect week.');

  assert.equal(helpers.occurrenceAllowed('midweek_wednesday', {
    enabled: true,
    additional_days: ['wednesday'],
  }, new Date('2026-08-19T00:00:00Z')), true);
  assert.equal(helpers.occurrenceAllowed('midweek_wednesday', {
    enabled: false,
    additional_days: [],
  }, new Date('2026-08-19T00:00:00Z')), false);

  const invalid = helpers.validatePayload({
    week_start: '2026-08-17',
    overall: 'mixed',
    win: '',
    confidence: 0,
    support: '',
  }, now);
  assert.match(invalid.error, /biggest win/i);
});
