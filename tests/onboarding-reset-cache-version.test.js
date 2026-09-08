const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('the reset-clean-state app bundle is always requested with a new version', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=239-complete-preference-reset/);
  assert.doesNotMatch(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=217-workout-tour-repair/);
});

const vm = require('node:vm');
test('a fresh run removes old diet, exercise, course and wizard selections while retaining login', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
  const reset = source.slice(source.indexOf('function resetFreshOnboardingPreferences()'), source.indexOf('async function checkAndTriggerOnboarding()'));
  function storage() {
    const values = {userProfile:'old',dietaryPreference:'low_fodmap',exercise_preferences:'old',user_food_preferences:'old',ai_meal_plan:'old',workoutCalendar:'old',plant_based_learning_progress:'old',pbb_course_started_v2_test_course:'1','sb-test-auth-token':'keep'};
    Object.defineProperty(values, 'removeItem', {value:key=>delete values[key]});
    return values;
  }
  const context = {window:{currentUser:{id:'test'}}, localStorage:storage(),sessionStorage:storage(),
    wizardFoodAllergies:new Set(['fodmap']),wizardDietaryRequirements:new Set(['vegan']),
    wizardCuisinePreferences:new Set(['old']),wizardFavoriteFoods:new Set(['old']),wizardLearningInterests:new Set(['old']),
    wizardLikedExercises:new Set(['old']),wizardAvoidedExercises:new Set(['old']),wizardSelectedDays:new Set(['Monday']),_aiMealPlanCache:{old:true}};
  vm.createContext(context);
  vm.runInContext(reset + ';resetFreshOnboardingPreferences();',context);
  for (const key of ['dietaryPreference','exercise_preferences','user_food_preferences','ai_meal_plan','workoutCalendar','plant_based_learning_progress','pbb_course_started_v2_test_course']) assert.equal(context.localStorage[key],undefined,key);
  assert.equal(context.localStorage['sb-test-auth-token'],'keep');
  assert.equal(context.wizardFoodAllergies.size,0);
  assert.equal(context.wizardSelectedDays.size,0);
  assert.equal(context._aiMealPlanCache,null);
  assert.equal(context.selectedGender,null);
  assert.match(source,/if \(forcePaidOnboardingTest\) \{\s*resetFreshOnboardingPreferences\(\)/);
  assert.match(source,/if \(userData && userData.is_test_account && !userData.onboarding_complete\) \{\s*resetFreshOnboardingPreferences\(\)/);
});
