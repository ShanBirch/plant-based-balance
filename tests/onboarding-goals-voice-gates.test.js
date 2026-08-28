const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const directMessages = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js'), 'utf8');
const weeklyGoals = fs.readFileSync(path.join(root, 'js/dashboard/pbb-deferred-weeklygoals.js'), 'utf8');
const socialJourney = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const learning = fs.readFileSync(path.join(root, 'lib/learning-inline.js'), 'utf8');

test('onboarding no longer silently saves default Weekly Goals', () => {
  assert.match(onboarding, /localStorage\.setItem\('pbb_weekly_goals_selection_required_v1', 'true'\)/);
  assert.doesNotMatch(onboarding, /weeklyGoals\.applyOnboardingDefaults/);
  assert.doesNotMatch(weeklyGoals, /async function applyOnboardingDefaults/);
  assert.match(weeklyGoals, /state\.draftSelected = suggestWeeklyGoalsFromOnboarding\(\)/);
  assert.match(weeklyGoals, /Choose your Weekly Goals/);
  assert.match(weeklyGoals, /Pick up to 3 commitments that feel realistic for this week/);
});

test('both activation tours require an explicit Weekly Goals save', () => {
  assert.match(dashboard, /source:'client_activation_setup', week:'current'/);
  assert.match(dashboard, /source:'meta_preview_setup', week:'current'/);
  assert.ok((dashboard.match(/requiresWeeklyGoals:true/g) || []).length >= 2);
  assert.match(dashboard, /window\.addEventListener\('pbbWeeklyGoalsSaved', saved\)/);
  assert.match(dashboard, /Number\(detail\.selectedCount \|\| 0\) < 1/);
  assert.match(dashboard, /activeTourGate && !activeTourGate\.complete/);
  assert.match(weeklyGoals, /state\.modalSource === 'meta_preview_setup' \|\| state\.modalSource === 'client_activation_setup'/);
  assert.match(weeklyGoals, /state\.draftSelected = \[\]/);
  assert.match(weeklyGoals, /Pick your first goal/);
  assert.match(weeklyGoals, /Recommended match your setup answers/);
  assert.match(weeklyGoals, /Save my weekly goals/);
  assert.match(dashboard, /RECOMMENDED STARTING POINTS/);
  assert.match(dashboard, /These are suggestions only/);
});

test('preview walkthrough only unlocks Next after the welcome audio ends', () => {
  assert.match(dashboard, /id="meta-ad-trial-welcome-audio"/);
  assert.match(dashboard, /title:'Listen to Shannon’s welcome'[\s\S]*?embeddedGuide:true[\s\S]*?requiresWelcomeAudio:true/);
  assert.match(dashboard, /audio\.addEventListener\('ended', complete\)/);
  assert.match(dashboard, /Listen to the full voice note to unlock Next/);
});

test('paid preview opens and requires the real first Foundations lesson', () => {
  assert.match(dashboard, /title:'Read, then take the quiz'[\s\S]*?embeddedGuide:true[\s\S]*?requiresFoundationsLesson:'mind-1-1'/);
  assert.match(dashboard, /window\.startFoundationsLesson\('mind-1-1'\)/);
  assert.match(dashboard, /window\.addEventListener\('pbbLearningLessonFinished', completed\)/);
  assert.match(dashboard, /detail\.completed !== true/);
  assert.match(dashboard, /Finish the first Foundations lesson with a perfect score to unlock Next/);
  assert.match(dashboard, /tour-embedded-guide:not\(\.tour-gate-complete\)[\s\S]*?#guided-tour-bubble/);
  assert.match(dashboard, /sessionStorage\.setItem\('pbb_activation_first_lesson', 'true'\)/);
  assert.match(dashboard, /sessionStorage\.removeItem\('pbb_activation_first_lesson'\)/);
  assert.match(learning, /isGuidedMetaPreviewLesson = !!window\.metaAdTrialMode/);
  assert.match(learning, /isActivationFirstLesson = !isGuidedMetaPreviewLesson/);
  assert.match(dashboard, /showStep\(completedStepIndex \+ 1\)/);
  assert.match(learning, /Meet Karl Friston, a theoretical neuroscientist at University College London/);
  assert.match(learning, /Meet Lisa Feldman Barrett, a psychologist and neuroscientist at Northeastern University/);
  assert.match(learning, /How Emotions Are Made/);
  assert.match(learning, /Karl Friston and Lisa Feldman Barrett personally endorse Balance/);
  assert.match(learning, /Balance draws on ideas from their published work/);
  assert.match(learning, /new CustomEvent\('pbbLearningLessonFinished'/);
  assert.match(dashboard, /#guided-tour-overlay\.tour-action-required:not\(\.tour-gate-complete\)[\s\S]*?\.tour-actions \{ display: none; \}/);
  assert.match(dashboard, /activeTourGate\.followTimer = setInterval/);
});

test('real Coach Shannon inbox also requires the full welcome note', () => {
  assert.match(directMessages, /id="balance-onboarding-welcome-audio"/);
  assert.match(directMessages, /onended="window\.socialJourney\.completeWelcomeAudio\(\)"/);
  assert.match(directMessages, /id="balance-onboarding-welcome-continue"/);
  assert.match(directMessages, /Listen to the full voice note to unlock your first lesson/);
  assert.match(socialJourney, /if \(!hasCompletedWelcomeAudio\(\)\)/);
  assert.match(socialJourney, /function completeWelcomeAudio\(\)/);
  assert.match(socialJourney, /welcomeAudioCompleteUserId/);
});

test('changed onboarding assets are cache-busted', () => {
  assert.match(dashboard, /meta-ad-trial\.js\?v=14-training-summary/);
  assert.match(dashboard, /pbb-deferred-weeklygoals\.js\?v=34-guided-goals/);
  assert.match(dashboard, /pbb-social-journey\.js\?v=37-course-action-evidence/);
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=207-day-one-meal-carousel/);
  assert.match(dashboard, /dashboard-script-6-ai_coach_draft_mode_logic_auth\.js\?v=43-home-canvas/);
  assert.match(dashboard, /learning-inline\.js\?v=29-paid-tour-handoff/);
  assert.match(serviceWorker, /pbb-app-v370-home-guided-tour/);
});
