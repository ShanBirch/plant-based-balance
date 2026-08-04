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

test('each onboarding slide starts at the top of its mobile scroll panel', () => {
    assert.match(onboardingSource, /if \(wizardContent && isChangingSlides\) wizardContent\.scrollTop = 0;/);
});

test('training-day guidance is refreshed after a custom day selection', () => {
    assert.match(
        onboardingSource,
        /function toggleTrainingDay\(day\)[\s\S]+updateWizardFrequencyTip\(\);[\s\S]+updateDaysCounter\(\);/
    );
});

test('new members receive the quick tour rather than the full replay tour', () => {
    assert.doesNotMatch(onboardingSource, /startFeatureTour\(true\)/);
    assert.ok((onboardingSource.match(/startFeatureTour\(\);/g) || []).length >= 2);
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
    assert.match(onboardingSource, /Your \$\{starterMinutes\}-minute minimum:/);
    assert.match(onboardingSource, /The full session is there when you have more\./);
});
