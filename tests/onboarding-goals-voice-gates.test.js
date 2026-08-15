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
});

test('preview walkthrough only unlocks Next after the welcome audio ends', () => {
  assert.match(dashboard, /id="meta-ad-trial-welcome-audio"/);
  assert.match(dashboard, /requiresWelcomeAudio:true/);
  assert.match(dashboard, /audio\.addEventListener\('ended', complete\)/);
  assert.match(dashboard, /Listen to the full voice note to unlock Next/);
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
  assert.match(dashboard, /pbb-deferred-weeklygoals\.js\?v=32-goal-confirm/);
  assert.match(dashboard, /pbb-social-journey\.js\?v=29-welcome-gate/);
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=188-mobile-onboarding/);
  assert.match(dashboard, /dashboard-script-6-ai_coach_draft_mode_logic_auth\.js\?v=42-welcome-gate/);
  assert.match(serviceWorker, /pbb-app-v324/);
});
