const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const onboardingPath = path.join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
const contextPath = path.join(__dirname, '../netlify/functions/_lib/client-context.js');
const onboardingSource = fs.readFileSync(onboardingPath, 'utf8');
const contextSource = fs.readFileSync(contextPath, 'utf8');
const { _buildWelcomeDraft } = require('../netlify/functions/onboarding-welcome-draft');

test('completed onboarding prepares the first active meal plan before coach assignment', () => {
    assert.match(onboardingSource, /async function ensureInitialOnboardingMealPlan\(\)/);
    assert.match(
        onboardingSource,
        /await ensureInitialOnboardingMealPlan\(\);[\s\S]+assign_coach_shannon_to_user/
    );
    assert.match(onboardingSource, /\.from\('ai_generated_meal_plans'\)[\s\S]+\.eq\('status', 'active'\)/);
});

test('food preferences finish saving before onboarding advances', () => {
    assert.match(onboardingSource, /async function saveWizardFoodPreferences\(\)/);
    assert.match(onboardingSource, /const prefs = await saveWizardFoodPreferences\(\);/);
});

test('the curated starter plan is held when preferences need an individual safety review', () => {
    assert.match(onboardingSource, /function mealPlanNeedsPreferenceReview\(preferences = \{\}\)/);
    assert.match(onboardingSource, /held for preference review instead of generating an unsafe template/);
    assert.match(onboardingSource, /allergies\.some\(value => !veganSafeAllergies\.has\(value\)\)/);
    assert.match(onboardingSource, /dislikes\.length > 0/);
    assert.match(
        onboardingSource,
        /held for preference review instead of generating an unsafe template'[\s\S]+_aiMealPlanGenerationInProgress = false;[\s\S]+return;/
    );
});

test('first coaching touch uses saved routine and asks for missing Weekly Goals', () => {
    const draft = _buildWelcomeDraft('Taylor Smith', {
        weeklyGoals: [],
        mealPlanReady: true,
        trainingDays: ['monday', 'thursday'],
        starterSessionMinutes: 15,
        routineWindow: 'after_work',
    }).text;

    assert.match(draft, /^Hey Taylor, you're in/);
    assert.match(draft, /meal plan is ready in Nutrition/);
    assert.match(draft, /Monday and Thursday/);
    assert.match(draft, /15-minute minimum/);
    assert.match(draft, /picked your three Weekly Goals on Home yet\?/);
    assert.doesNotMatch(draft, /How are you doing/);
});

test('first coaching touch moves to first-session timing when Weekly Goals are saved', () => {
    const draft = _buildWelcomeDraft('Taylor', {
        weeklyGoals: [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
        mealPlanReady: true,
        trainingDays: ['tuesday', 'saturday'],
        starterSessionMinutes: 10,
        routineWindow: 'before_day',
    }).text;

    assert.match(draft, /Which day are you thinking for your first session\?/);
    assert.doesNotMatch(draft, /have you picked your three Weekly Goals/);
});

test('welcome is honest when the meal plan needs a food-preference review', () => {
    const draft = _buildWelcomeDraft('Taylor', {
        weeklyGoals: [],
        mealPlanReady: false,
        mealPlanNeedsReview: true,
        trainingDays: ['monday'],
        starterSessionMinutes: 10,
    }).text;

    assert.match(draft, /checking your meal plan against your food preferences/);
    assert.doesNotMatch(draft, /meal plan is ready/);
});

test('DM grounding keeps activation questions state-based and user-controlled', () => {
    assert.match(contextSource, /First coaching touch after completed setup:/);
    assert.match(contextSource, /leaving the final days, time and frequency under their control/);
    assert.match(contextSource, /Only say a plan is ready when an active meal plan exists/);
});
