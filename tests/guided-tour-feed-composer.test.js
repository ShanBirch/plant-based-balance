const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const mealPlan = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');

test('Feed introduction gives typing a clear, usable surface', () => {
  assert.match(dashboard, /title:'Introduce yourself'[\s\S]*?hideGuideWhileTyping:true/);
  assert.match(dashboard, /#guided-tour-overlay\.tour-typing #guided-tour-bubble \{[\s\S]*?opacity: 0 !important/);
  assert.match(dashboard, /#guided-tour-overlay\.tour-typing #guided-tour-spotlight \{[\s\S]*?opacity: 1 !important/);
  assert.match(dashboard, /const typingInTarget = !!\(step && step\.hideGuideWhileTyping/);
  assert.match(dashboard, /composer\.scrollIntoView\(\{ block:'center', behavior:'auto' \}\)/);
  assert.match(dashboard, /visualViewport\.addEventListener\('resize', keepComposerVisible\)/);
  assert.match(dashboard, /document\.addEventListener\('focusin', resizeHandler, true\)/);
  assert.match(dashboard, /document\.removeEventListener\('focusout', resizeHandler, true\)/);
});

test('workout demonstration stays playable during its onboarding tour stop', () => {
  assert.match(dashboard, /title:'Follow the exercise card'[^\n]*allowTargetInteraction:true/);
  assert.match(dashboard, /#guided-tour-overlay\.tour-target-interactive \{ pointer-events: none; \}/);
  assert.match(dashboard, /tour-target-interactive #guided-tour-bubble \{ pointer-events: auto; \}/);
  assert.match(dashboard, /classList\.toggle\('tour-target-interactive', !!displayStep\.allowTargetInteraction\)/);
});

test('shopping list stays tied to the current active meal plan and week', () => {
  assert.match(mealPlan, /function getAiPlanShoppingWeek\(\)[\s\S]*?_aiMealPlanCache\.weeks\.find\(week => Number\(week\.week_number\) === Number\(_aiMealPlanCurrentWeek\)\)/);
  assert.match(mealPlan, /function getAiPlanShoppingStorageKey\(\)[\s\S]*?_aiMealPlanCache\?\.id[\s\S]*?_aiMealPlanCurrentWeek/);
  assert.match(mealPlan, /async function openAiMealPlanShoppingList\(btn, options = \{\}\)[\s\S]*?renderAiPlanShoppingList\(\);[\s\S]*?toggleAiPlanShoppingList\(true\)/);
});

test('a cached page cannot render the legacy guided-tour code as Course text', () => {
  assert.match(mealPlan, /function removeLegacyGuidedTourTextLeak\(\)/);
  assert.match(mealPlan, /#guided-tour-overlay\.tour-keyboard-open/);
  assert.match(mealPlan, /new MutationObserver\(removeLegacyGuidedTourTextLeak\)/);
});
