const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const onboardingPath = path.join(__dirname, '../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
const contextPath = path.join(__dirname, '../netlify/functions/_lib/client-context.js');
const dashboardPath = path.join(__dirname, '../dashboard.html');
const onboardingSource = fs.readFileSync(onboardingPath, 'utf8');
const contextSource = fs.readFileSync(contextPath, 'utf8');
const dashboardSource = fs.readFileSync(dashboardPath, 'utf8');
const mealPlanPopulatorSource = fs.readFileSync(path.join(__dirname, '../lib/meal-plan-populator.js'), 'utf8');
const { _buildWelcomeDraft } = require('../netlify/functions/onboarding-welcome-draft');
const { _isClearOnboardingSetupConfirmation } = require('../netlify/functions/instant-coach-draft');

test('completed onboarding prepares the first active meal plan before coach assignment', () => {
    assert.match(onboardingSource, /async function ensureInitialOnboardingMealPlan\(\)/);
    assert.match(
        onboardingSource,
        /await ensureInitialOnboardingMealPlan\(\);[\s\S]+assign_coach_shannon_to_user/
    );
    assert.match(onboardingSource, /\.from\('ai_generated_meal_plans'\)[\s\S]+\.eq\('status', 'active'\)/);
});

test('paid preview claim persists the exact meal plan before marking onboarding claimed', () => {
    assert.match(mealPlanPopulatorSource, /async function persistBuiltMealPlan\(supabase, userId, scaled\)/);
    assert.match(mealPlanPopulatorSource, /status: 'generating'[\s\S]+update\(\{ status: 'active' \}\)/);
    assert.match(mealPlanPopulatorSource, /incomplete plan cleanup failed/);
    assert.match(
        onboardingSource,
        /await claimMetaPreviewWorkoutCalendar\(userId\);[\s\S]+await claimMetaPreviewMealPlan\(userId\);[\s\S]+BalanceMetaAdTrial\.markClaimed\(userId\)/
    );
});

test('paid preview builds a personalised plan and first-day meal photos from the chosen restrictions', () => {
    assert.match(onboardingSource, /async function buildFreshMetaPreviewMealPlan\(profile, foodPreferences, signature\)/);
    assert.match(onboardingSource, /foodPreferences[\s\S]+fetchMealPlanDay\(/);
    assert.match(onboardingSource, /ensureExactMealPlanPhotos\(plan, user\.id,[\s\S]+meals: firstDayMeals/);
    assert.match(onboardingSource, /startFreshMetaPreviewMealPlan\(\)[\s\S]+Fresh onboarding meal plan will retry in Nutrition/);
});

test('food preferences finish saving before onboarding advances', () => {
    assert.match(onboardingSource, /async function saveWizardFoodPreferences\(\)/);
    assert.match(onboardingSource, /const prefs = await saveWizardFoodPreferences\(\);/);
});

test('skipping still opens the welcome journey while completing leaves the member in Course', () => {
    assert.match(dashboardSource, /else if \(completedClientActivationTour\) \{[\s\S]+if \(skipped\)[\s\S]+window\.socialJourney\.startActivation\(\)[\s\S]+ensureTab\('learning'\)/);
});

test('the signed-in app tour covers the plan, completes Foundations, then coach support and Weekly Goals', () => {
    const requiredStart = dashboardSource.indexOf('const REQUIRED_ONBOARDING_TOUR_TITLES');
    const requiredEnd = dashboardSource.indexOf('];', requiredStart);
    const requiredTour = dashboardSource.slice(requiredStart, requiredEnd);
    const mealPlan = requiredTour.indexOf("'See every meal on Day 1'");
    const shopping = requiredTour.indexOf("'One shopping list for the week'", mealPlan);
    const foodLog = requiredTour.indexOf("'Log what you eat'", shopping);
    const workout = requiredTour.indexOf("'Check your workout week'", foodLog);
    const community = requiredTour.indexOf("'The Balance community'", workout);
    const course = requiredTour.indexOf("'Read, then take the quiz'", community);
    const coach = requiredTour.indexOf("'Watch Shannon’s coach note'", course);
    const goals = requiredTour.indexOf("'Pick your Weekly Goals'", coach);

    assert.ok(mealPlan >= 0);
    assert.ok(shopping > mealPlan);
    assert.ok(foodLog > shopping);
    assert.ok(workout > foodLog);
    assert.ok(community > workout);
    assert.ok(course > community);
    assert.ok(coach > course);
    assert.ok(goals > coach);
    assert.match(dashboardSource, /title:'Read, then take the quiz'[\s\S]*?requiresFoundationsLesson:'mind-1-1'/);
    assert.match(dashboardSource, /activeSteps = requiredOnboardingTourSteps\(\)/);
    assert.match(dashboardSource, /if \(metaPreviewTour \|\| clientActivationTour\) \{[\s\S]*showMetaTourWelcome\(\)/);
    assert.match(dashboardSource, /\(metaPreviewTour \|\| clientActivationTour\) && step\.promptBeforeAction/);
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

test('first coaching touch welcomes the member and asks for missing Weekly Goals', () => {
    const draft = _buildWelcomeDraft('Taylor Smith', {
        weeklyGoals: [],
        mealPlanReady: true,
        trainingDays: ['monday', 'thursday'],
        starterSessionMinutes: 15,
        routineWindow: 'after_work',
    }).text;

    assert.match(draft, /^hey Taylor, saw you made it in/);
    assert.match(draft, /meal plan is ready in Nutrition/);
    assert.match(draft, /picked your three weekly goals on Home yet\?/);
    assert.doesNotMatch(draft, /first session/);
});

test('first coaching touch waits for a response when Weekly Goals are saved', () => {
    const draft = _buildWelcomeDraft('Taylor', {
        weeklyGoals: [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
        mealPlanReady: true,
        trainingDays: ['tuesday', 'saturday'],
        starterSessionMinutes: 10,
        routineWindow: 'before_day',
    }).text;

    assert.match(draft, /meal plan and weekly goals are all sorted/);
    assert.match(draft, /how did you go with setup\?/);
    assert.doesNotMatch(draft, /first session/);
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

test('clear first reply after the fixed welcome unlocks the automatic first-session question', () => {
    const lastOutboundText = 'hey Taylor, saw you made it in 🙌 welcome. looks like your meal plan and weekly goals are all sorted. how did you go with setup?';

    assert.equal(_isClearOnboardingSetupConfirmation({ message: 'yep all sorted', lastOutboundText }), true);
    assert.equal(_isClearOnboardingSetupConfirmation({ message: 'yeah, got it', lastOutboundText }), true);
});

test('stuck, ambiguous, media, or already-timed onboarding replies stay out of the fixed follow-up', () => {
    const lastOutboundText = 'hey Taylor, saw you made it in 🙌 welcome. your meal plan is ready in Nutrition. have you picked your three weekly goals on Home yet?';

    assert.equal(_isClearOnboardingSetupConfirmation({ message: 'not yet, where are they?', lastOutboundText }), false);
    assert.equal(_isClearOnboardingSetupConfirmation({ message: 'yeah, I will train Monday', lastOutboundText }), false);
    assert.equal(_isClearOnboardingSetupConfirmation({ message: '[AUDIO: https://example.com/note.m4a]', lastOutboundText }), false);
    assert.equal(_isClearOnboardingSetupConfirmation({ message: 'yep', lastOutboundText: 'How did training go?' }), false);
});

test('a pending meal-plan review does not claim the whole setup is complete', () => {
    const lastOutboundText = "hey Taylor, saw you made it in 🙌 welcome. i'm just checking your meal plan against your food preferences. have you picked your three weekly goals on Home yet?";
    assert.equal(_isClearOnboardingSetupConfirmation({ message: 'yes', lastOutboundText }), false);
});
