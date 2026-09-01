const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const dashboard = read('dashboard.html');
const picker = read('js/dashboard/pbb-deferred-pickers.js');
const pickerCss = read('css/dashboard/pbb-premium-overlays.css');
const tracker = read('js/dashboard/dashboard-script-11-calorie_tracker_functions.js');
const nativePush = read('lib/native-push.js');
const supabase = read('lib/supabase.js');
const reminderFunction = read('netlify/functions/send-meal-reminders.mjs');

test('meal timing reminder controls are removed from Settings', () => {
  assert.doesNotMatch(dashboard, /Meal timing reminders/);
  assert.doesNotMatch(dashboard, /meal-reminders-toggle|meal-reminder-times|save-meal-reminders-btn/);
  assert.match(dashboard, /Coach messages and app alerts/);
});

test('retired reminder schedules are disabled across client, device and server', () => {
  assert.match(tracker, /async function retireMealReminderSettings\(\)/);
  assert.match(tracker, /existingSettings = JSON\.parse\(localStorage\.getItem\('meal_reminder_settings'/);
  assert.match(tracker, /breakfast_time: existingSettings\.breakfast_time \|\| '08:00:00'/);
  assert.match(tracker, /reminders_enabled: false/);
  assert.match(tracker, /\.from\('meal_reminder_preferences'\)[\s\S]*?\.update\(\{/);
  assert.match(nativePush, /await scheduleMealReminders\(\{ reminders_enabled: false \}\)/);
  assert.match(nativePush, /settings = \{ reminders_enabled: false \}/);
  assert.match(nativePush, /deleteChannel\(\{ id: 'meal-reminders' \}\)/);
  assert.doesNotMatch(nativePush, /createChannel\(\{\s*id: 'meal-reminders'/);
  assert.match(supabase, /reminders_enabled: false,[\s\S]*?breakfast_reminder: false,[\s\S]*?lunch_reminder: false,[\s\S]*?dinner_reminder: false/);
  assert.doesNotMatch(reminderFunction, /export const config\s*=\s*\{[\s\S]*?schedule:/);
});

test('Food Preferences uses readable semantic styles in both themes', () => {
  assert.match(dashboard, /<h3 class="settings-picker-title"[^>]*>Food Preferences<\/h3>/);
  assert.match(dashboard, /class="settings-picker-helper"/);
  assert.match(dashboard, /class="settings-picker-primary"/);
  assert.match(picker, /class="dietary-picker-chip\$\{sel\?' is-selected':''\}"/);
  assert.match(picker, /role="checkbox" aria-checked=/);
  assert.match(picker, /class="dietary-picker-group-title"/);
  assert.doesNotMatch(picker, /color:\$\{sel\?'#166534'/);
  assert.match(pickerCss, /html\[data-pbb-theme\] \.dietary-picker-chip \{/);
  assert.match(pickerCss, /background: var\(--pbb-readable-surface-soft\) !important/);
  assert.match(pickerCss, /color: var\(--pbb-readable-text\) !important/);
  assert.match(pickerCss, /background: var\(--pbb-readable-action-bg\) !important/);
  assert.match(pickerCss, /:focus-visible/);
});

test('returning phones receive the picker and retirement updates', () => {
  assert.match(dashboard, /pbb-premium-overlays\.css\?v=103-daily-score-theme/);
  assert.match(dashboard, /pbb-deferred-pickers\.js\?v=3-food-preferences-direct-load/);
  assert.match(dashboard, /<script src="js\/dashboard\/pbb-deferred-pickers\.js\?v=3-food-preferences-direct-load"><\/script>/);
  assert.doesNotMatch(dashboard, /_pbbDeferredQueue\.push\('js\/dashboard\/pbb-deferred-pickers/);
  assert.match(dashboard, /dashboard-script-11-calorie_tracker_functions\.js\?v=38-meal-history/);
  assert.match(dashboard, /native-push\.js\?v=41-meal-reminders-retired/);
  assert.match(read('sw.js'), /pbb-app-v437-feed-composer-label/);
});
