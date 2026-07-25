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

test('weekly goal suggestions prioritize the anchors explicitly chosen during onboarding', () => {
    assert.match(weeklyGoalsSource, /function readOnboardingWeeklyGoalFocusIds\(\)/);
    assert.match(
        weeklyGoalsSource,
        /readOnboardingWeeklyGoalFocusIds\(\)\.forEach\(addGoal\);[\s\S]+readOnboardingGoalIntentIds\(\)\.forEach/
    );
});

test('calendar preview explains how to use the easy-session minimum', () => {
    assert.match(onboardingSource, /Your \$\{starterMinutes\}-minute minimum:/);
    assert.match(onboardingSource, /The full session is there when you have more\./);
});
