const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const onboardingSource = fs.readFileSync(
    path.join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);
const weeklyGoalsSource = fs.readFileSync(
    path.join(__dirname, '../js/dashboard/pbb-deferred-weeklygoals.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const comebackCss = fs.readFileSync(path.join(__dirname, '../css/dashboard/pbb-onboarding-comeback.css'), 'utf8');
const foundationsCss = fs.readFileSync(path.join(__dirname, '../css/dashboard/pbb-onboarding-foundations.css'), 'utf8');

test('each onboarding slide starts at the top of its mobile scroll panel', () => {
    assert.match(onboardingSource, /if \(wizardContent && isChangingSlides\) wizardContent\.scrollTop = 0;/);
});

test('training-day guidance is refreshed after a custom day selection', () => {
    assert.match(
        onboardingSource,
        /function toggleTrainingDay\(day\)[\s\S]+updateWizardFrequencyTip\(\);[\s\S]+updateDaysCounter\(\);/
    );
});

test('new members and paid preview users enter the correct guided tour mode', () => {
    assert.match(onboardingSource, /start\(true, \{ clientActivation: true \}\)/);
    assert.match(onboardingSource, /start\(false, \{ metaPreview: true \}\)/);
});

test('Balance assigns and persists the first Weekly Goals from onboarding', () => {
    assert.match(weeklyGoalsSource, /function readOnboardingWeeklyGoalFocusIds\(\)/);
    assert.match(weeklyGoalsSource, /async function applyOnboardingDefaults\(\)/);
    assert.match(weeklyGoalsSource, /pbb_auto_weekly_goals_pending_v1/);
    assert.match(weeklyGoalsSource, /const isGuestPreview = userId === 'guest-preview'/);
    assert.match(weeklyGoalsSource, /if \(!isGuestPreview && !state\.lastSaveWasLocalOnly\)/);
    assert.match(weeklyGoalsSource, /goal\.id === 'complete_workouts'/);
    assert.match(onboardingSource, /function inferWizardStarterPlan\(answers = \{\}\)/);
    assert.match(onboardingSource, /weeklyGoalFocusIds = inferredPlan\.weeklyGoalFocusIds/);
});

test('first-run onboarding asks only plan-changing questions and does not ask members to choose goals', () => {
    const stepsBlock = onboardingSource.match(/const WIZARD_CHAT_STEPS = \[[\s\S]*?\n\];/)[0];
    assert.doesNotMatch(stepsBlock, /key: 'goal_intents'/);
    assert.doesNotMatch(stepsBlock, /key: 'weekly_goal_focus'/);
    assert.doesNotMatch(stepsBlock, /key: 'goal_weight'/);
    assert.doesNotMatch(stepsBlock, /key: 'learning_interests'/);
    assert.doesNotMatch(stepsBlock, /key: 'ig_handle'/);
    assert.match(stepsBlock, /key: 'movement_limits'/);
    assert.match(stepsBlock, /key: 'dietary_requirements'/);
});

test('comeback onboarding uses the Balance identity, mobile safe areas, and reduced-motion support', () => {
    assert.match(dashboardSource, /wizard-brand-lockup/);
    assert.match(dashboardSource, /balance_logo_transparent\.svg/);
    assert.match(onboardingSource, /Time for a comeback/);
    assert.match(comebackCss, /env\(safe-area-inset-top/);
    assert.match(comebackCss, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(comebackCss, /comebackLogoSweep/);
});

test('calendar preview explains how to use the easy-session minimum', () => {
    assert.match(onboardingSource, /Your ' \+ starterMinutes \+ '-minute minimum:/);
    assert.match(onboardingSource, /The full session is there when you have more\./);
});

test('onboarding ships a cache-busted authoritative cream-and-gold skin', () => {
    assert.match(comebackCss, /#onboarding-wizard \.wizard-input,[\s\S]*?-webkit-text-fill-color: #17130e !important;/);
    assert.match(foundationsCss, /--foundations-cream: #fffaf2/);
    assert.match(foundationsCss, /html\[data-pbb-theme="dark"\] #onboarding-wizard \.onboarding-modal\.wizard-container/);
    assert.match(foundationsCss, /#onboarding-wizard \.wizard-chat-bubble\.coach:last-child[\s\S]*?-webkit-text-fill-color: var\(--foundations-ink\) !important;/);
    assert.match(foundationsCss, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(dashboardSource, /pbb-onboarding-comeback\.css\?v=8/);
    assert.match(dashboardSource, /pbb-onboarding-foundations\.css\?v=4/);
});

test('Foundations gives each real setup section a compact branded transition', () => {
    assert.equal((dashboardSource.match(/id="wizard-section-transition"/g) || []).length, 1);
    assert.match(dashboardSource, /id="onboarding-wizard"[\s\S]*?id="wizard-section-transition"[\s\S]*?aria-live="polite"/);
    assert.match(dashboardSource, /data-transition-stage="profile"/);
    assert.match(dashboardSource, /data-transition-stage="training"/);
    assert.match(dashboardSource, /data-transition-stage="plan"/);
    assert.match(onboardingSource, /function getWizardSectionTransition\(step\)/);
    assert.match(onboardingSource, /3: \{[\s\S]*?PROFILE MATCHED/);
    assert.match(onboardingSource, /4: \{[\s\S]*?Shaping your training week/);
    assert.match(onboardingSource, /7: \{[\s\S]*?TRAINING MAPPED/);
    assert.match(onboardingSource, /19: \{[\s\S]*?BUILDING YOUR BALANCE/);
    assert.match(onboardingSource, /const wizardSectionTransitionMs = 820/);
    assert.match(onboardingSource, /duration: 1160/);
    assert.match(onboardingSource, /wizardPrefersReducedMotion\(\) \? 80/);
    assert.match(foundationsCss, /\.wizard-section-transition\.is-active/);
    assert.match(foundationsCss, /foundationsTransitionOrbit/);
});

test('question motion confirms a choice, blocks double taps, and respects reduced motion', () => {
    assert.match(onboardingSource, /let wizardChatChoicePending = false/);
    assert.match(onboardingSource, /function confirmWizardChatChoice\(button, callback\)/);
    assert.match(onboardingSource, /choicesEl\.setAttribute\('aria-busy', 'true'\)/);
    assert.match(onboardingSource, /button\.classList\.add\('is-confirmed'\)/);
    assert.match(onboardingSource, /function restartWizardChatQuestionMotion\(\)/);
    assert.match(foundationsCss, /\.wizard-chat-choice\.is-confirmed/);
    assert.match(foundationsCss, /foundationsQuestionIn/);
    assert.match(foundationsCss, /foundationsChoiceIn/);
    assert.match(foundationsCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.wizard-section-transition-orbit > span/);
});

test('long answer lists scroll without overlapping the typed-answer controls', () => {
    assert.match(foundationsCss, /grid-template-rows: auto auto auto minmax\(0, 1fr\) auto !important;/);
    assert.match(foundationsCss, /#onboarding-wizard\.wizard-chat-no-textbox \.wizard-chat-intake[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\) auto auto !important;/);
    assert.match(foundationsCss, /#onboarding-wizard \.wizard-chat-choices[\s\S]*?overflow-y: auto !important;/);
    assert.match(foundationsCss, /#onboarding-wizard\.wizard-chat-no-textbox \.wizard-chat-choices[\s\S]*?overflow-y: auto !important;/);
    assert.match(onboardingSource, /const allowsTypedAnswer = step\.type === 'multi' \|\| Boolean\(step\.textPlaceholder\);/);
    assert.match(onboardingSource, /inputRow\.style\.display = allowsTypedAnswer \? 'flex' : 'none';/);
    assert.match(onboardingSource, /step\.key === 'routine_window' && parseWizardClockTime\(raw\)/);
});
