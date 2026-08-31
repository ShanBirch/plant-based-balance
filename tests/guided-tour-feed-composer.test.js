const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const mealPlan = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');

test('Feed introduction gives typing a clear, usable surface', () => {
  assert.match(dashboard, /title:'Introduce yourself'[\s\S]*?hideGuideWhileTyping:true/);
  assert.match(dashboard, /#guided-tour-overlay\.tour-typing #guided-tour-bubble,[\s\S]*?#guided-tour-overlay\.tour-typing #guided-tour-spotlight/);
  assert.match(dashboard, /const typingInTarget = !!\(step && step\.hideGuideWhileTyping/);
  assert.match(dashboard, /document\.addEventListener\('focusin', resizeHandler, true\)/);
  assert.match(dashboard, /document\.removeEventListener\('focusout', resizeHandler, true\)/);
});

test('shopping list stays tied to the current active meal plan and week', () => {
  assert.match(mealPlan, /function getAiPlanShoppingWeek\(\)[\s\S]*?_aiMealPlanCache\.weeks\.find\(week => Number\(week\.week_number\) === Number\(_aiMealPlanCurrentWeek\)\)/);
  assert.match(mealPlan, /function getAiPlanShoppingStorageKey\(\)[\s\S]*?_aiMealPlanCache\?\.id[\s\S]*?_aiMealPlanCurrentWeek/);
  assert.match(mealPlan, /async function openAiMealPlanShoppingList\(btn, options = \{\}\)[\s\S]*?renderAiPlanShoppingList\(\);[\s\S]*?toggleAiPlanShoppingList\(true\)/);
});
