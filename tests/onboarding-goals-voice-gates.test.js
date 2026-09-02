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
  assert.match(onboarding, /function selectWizardChatStart\(value\)[\s\S]*?pbbNextSteps\.resetOnboardingCards\(\)/);
  assert.match(onboarding, /localStorage\.setItem\('pbb_weekly_goals_selection_required_v1', 'true'\)/);
  assert.doesNotMatch(onboarding, /weeklyGoals\.applyOnboardingDefaults/);
  assert.doesNotMatch(weeklyGoals, /async function applyOnboardingDefaults/);
  assert.match(weeklyGoals, /state\.draftSelected = suggestWeeklyGoalsFromOnboarding\(\)/);
  assert.match(weeklyGoals, /Choose your Weekly Goals/);
  assert.match(weeklyGoals, /Pick up to 3 commitments that feel realistic for this week/);
});

test('both activation tours require an explicit Weekly Goals save', () => {
  assert.match(dashboard, /source:'meta_preview_setup', week:'current'/);
  assert.match(dashboard, /source:metaPreviewTour \? 'meta_preview_setup' : 'client_activation_setup', week:'current'/);
  assert.ok((dashboard.match(/requiresWeeklyGoals:true/g) || []).length >= 1);
  assert.match(dashboard, /REQUIRED_ONBOARDING_TOUR_TITLES[\s\S]*?'Pick your Weekly Goals'/);
  assert.match(dashboard, /window\.addEventListener\('pbbWeeklyGoalsSaved', saved\)/);
  assert.match(dashboard, /Number\(detail\.selectedCount \|\| 0\) < 1/);
  assert.match(dashboard, /activeTourGate && !activeTourGate\.complete/);
  assert.match(weeklyGoals, /state\.modalSource === 'meta_preview_setup' \|\| state\.modalSource === 'client_activation_setup'/);
  assert.match(weeklyGoals, /state\.draftSelected = \[\]/);
  assert.match(weeklyGoals, /Pick your first goal/);
  assert.match(weeklyGoals, /Recommended match your setup answers/);
  assert.match(weeklyGoals, /Save My Weekly Goals/);
  assert.match(dashboard, /RECOMMENDED STARTING POINTS/);
  assert.match(dashboard, /These are suggestions only/);
});

test('Weekly Goals chooser uses one readable cream, white and gold Balance theme', () => {
  assert.match(weeklyGoals, /function styleVarsForMeta\(meta\) \{[\s\S]*?--goal-accent:#765410;--goal-soft:#fff8e7;--goal-border:#d8b25e/);
  assert.match(weeklyGoals, /#weekly-goals-modal \.weekly-goal-sheet\{background:linear-gradient\(180deg,#fffdf8 0%,#f6eddb 100%\) !important/);
  assert.match(weeklyGoals, /font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif !important/);
  assert.match(weeklyGoals, /#weekly-goals-modal \.weekly-goal-hero[^{]*\{[^}]*background:linear-gradient\(135deg,#fffdf8 0%,#f4e6c8 100%\) !important/);
  assert.match(weeklyGoals, /weekly-goal-hero > div > div:first-child\{max-width:calc\(100% - 104px\)/);
  assert.match(weeklyGoals, /#weekly-goals-modal \.weekly-goal-stepper input\{[^}]*background:#fffdf8 !important;[^}]*color:#181713 !important/);
  assert.match(weeklyGoals, /weekly-goal-selected-count\{white-space:nowrap/);
  assert.match(weeklyGoals, /#weekly-goals-modal \.weekly-goal-save-btn\{[^}]*background:#d8b25e !important;[^}]*color:#181713 !important/);
  assert.doesNotMatch(weeklyGoals, /weekly-goal-save-btn\{[^}]*#321a55/);
});

test('preview walkthrough only unlocks Next after the full coach video plays', () => {
  assert.match(dashboard, /id="meta-ad-trial-welcome-video"/);
  assert.match(dashboard, /balance-onboarding-coach-note-captioned\.mp4/);
  assert.match(dashboard, /id="meta-ad-trial-welcome-continue"/);
  assert.match(dashboard, /title:'Watch Shannon’s coach note'[\s\S]*?embeddedGuide:true[\s\S]*?coachNoteGuide:true[\s\S]*?requiresWelcomeVideo:true/);
  assert.match(dashboard, /#guided-tour-overlay\.tour-coach-note #guided-tour-bubble,[\s\S]*?#guided-tour-overlay\.tour-coach-note #guided-tour-spotlight[\s\S]*?display: none/);
  assert.match(dashboard, /if \(step\.coachNoteGuide && continueButton\)[\s\S]*?continueButton\.style\.display = 'block'/);
  assert.match(dashboard, /overlay\.classList\.toggle\('tour-coach-note', !!displayStep\.coachNoteGuide\)/);
  assert.match(dashboard, /video\.addEventListener\('ended', complete\)/);
  assert.match(dashboard, /video\.addEventListener\('seeking', stopSkipping\)/);
  assert.match(dashboard, /duration - furthest > 1\.6/);
  assert.match(dashboard, /Watch the full coach note to unlock Next/);
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
  assert.match(dashboard, /body\.guided-tour-course-locked \.bottom-nav/);
  assert.match(dashboard, /document\.body\.classList\.add\('guided-tour-course-locked'\)/);
  assert.match(dashboard, /document\.body\.classList\.remove\('guided-tour-course-locked'\)/);
  assert.match(learning, /Meet Karl Friston, a theoretical neuroscientist at University College London/);
  assert.match(learning, /Meet Lisa Feldman Barrett, a psychologist and neuroscientist at Northeastern University/);
  assert.match(learning, /How Emotions Are Made/);
  assert.match(learning, /Karl Friston and Lisa Feldman Barrett personally endorse Balance/);
  assert.match(learning, /Balance draws on ideas from their published work/);
  assert.match(learning, /new CustomEvent\('pbbLearningLessonFinished'/);
  assert.match(dashboard, /#guided-tour-overlay\.tour-action-required:not\(\.tour-gate-complete\)[\s\S]*?\.tour-actions \{ display: none; \}/);
  assert.match(dashboard, /activeTourGate\.followTimer = setInterval/);
});

test('real Coach Shannon inbox also requires the full coach video', () => {
  assert.match(directMessages, /id="balance-onboarding-welcome-video"/);
  assert.match(directMessages, /onloadedmetadata="window\.socialJourney\.guardWelcomeVideo\(this\)"/);
  assert.match(directMessages, /id="balance-onboarding-welcome-continue"/);
  assert.match(directMessages, /Watch the full coach note to unlock your first lesson/);
  assert.match(socialJourney, /if \(!hasCompletedWelcomeVideo\(\)\)/);
  assert.match(socialJourney, /function guardWelcomeVideo\(video\)/);
  assert.match(socialJourney, /function completeWelcomeVideo\(\)/);
  assert.match(socialJourney, /welcomeVideoCompleteUserId/);
});

test('every onboarding coach video shows Shannon as its poster frame', () => {
  const poster = 'poster="/assets/balance-onboarding-coach-note-poster.jpg"';
  assert.match(dashboard, new RegExp('id="meta-ad-trial-welcome-video"[^>]*' + poster));
  assert.match(directMessages, new RegExp('id="balance-onboarding-welcome-video"[^>]*' + poster));
  assert.match(socialJourney, new RegExp('id="social-journey-welcome-video"[^>]*' + poster));
});

test('changed onboarding assets are cache-busted', () => {
  assert.match(dashboard, /meta-ad-trial\.js\?v=17-goal-alignment/);
  assert.match(dashboard, /pbb-deferred-weeklygoals\.js\?v=35-balance-theme/);
  assert.match(dashboard, /pbb-social-journey\.js\?v=45-exact-course-label/);
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=227-meal-primary-tabs/);
  assert.match(dashboard, /dashboard-script-6-ai_coach_draft_mode_logic_auth\.js\?v=50-community-games-theme/);
  assert.match(dashboard, /learning-inline\.js\?v=40-tour-quiz-continue/);
assert.match(serviceWorker, /pbb-app-v456-imported-activity-todo/);
});
