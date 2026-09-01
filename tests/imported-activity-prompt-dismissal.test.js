const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const activity = fs.readFileSync('js/dashboard/dashboard-script-10-points_widget_functions.js', 'utf8');
const fitbit = fs.readFileSync('js/dashboard/pbb-deferred-fitbit.js', 'utf8');
const helpers = fs.readFileSync('lib/supabase.js', 'utf8');
const dashboard = fs.readFileSync('dashboard.html', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

test('opening a wearable activity preserves its imported identity', () => {
  assert.match(activity, /isImportedActivity: activity\.source === 'fitbit' \|\| activity\.source === 'native_health'/);
  assert.match(activity, /sharePromptHandled: Boolean\(metadata\.share_prompt_handled \|\| activity\.shared_to_feed\)/);
});

test('closing a handled wearable activity dismisses its optional share prompt', () => {
  assert.match(activity, /async function markImportedActivitySharePromptHandled\(reason\)/);
  assert.match(activity, /share_prompt_handled: reason \|\| 'dismissed'/);
  assert.match(activity, /share_prompt_handled_at: handledAt/);
  assert.match(activity, /window\.pbbPendingImportedActivity = null;[\s\S]*?window\.pbbNextSteps\?\.refresh\?\.\(\)/);
  assert.match(activity, /if \(savedActivityData\?\.isImportedActivity && !savedActivityData\.sharePromptHandled\)[\s\S]*?markImportedActivitySharePromptHandled\('dismissed'\)/);
});

test('a handled newest import cannot reveal an older prompt from the backlog', () => {
  assert.match(fitbit, /const newest = importedActivities\.find/);
  assert.match(fitbit, /if \(!newest \|\| newest\.shared_to_feed \|\| newest\.source_metadata\?\.share_prompt_handled\)/);
  assert.match(fitbit, /const activities = importedActivities\.filter/);
  const crossSourceHelper = helpers.slice(helpers.indexOf('async getRecentImportedFromSources'), helpers.indexOf('async update(activityId'));
  assert.doesNotMatch(crossSourceHelper, /\.eq\('shared_to_feed', false\)/);
});

test('sharing to Feed records the prompt as handled for every grouped activity', () => {
  assert.match(activity, /share_prompt_handled: 'balance_feed'/);
  assert.match(activity, /additionalIds\.map\(id =>[\s\S]*?shared_to_feed: true[\s\S]*?share_prompt_handled: 'balance_feed'/);
});

test('Android receives the repeat-prompt fix', () => {
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=55-approved-share-editor/);
  assert.match(dashboard, /pbb-deferred-fitbit\.js\?v=3-latest-import-only/);
  assert.match(serviceWorker, /pbb-app-v460-imported-activity-dismissed/);
});
