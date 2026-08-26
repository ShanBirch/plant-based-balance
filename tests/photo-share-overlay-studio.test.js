const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const shareUi = fs.readFileSync(
  path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
  'utf8'
);
const mealUi = fs.readFileSync(
  path.join(root, 'js', 'dashboard', 'dashboard-script-11-calorie_tracker_functions.js'),
  'utf8'
);
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

for (const style of ['classic', 'gold', 'midnight', 'fresh']) {
  assert.ok(shareUi.includes(`id: '${style}'`), `${style} overlay style must be available`);
}
for (const style of ['bold', 'scorecard', 'simple']) {
  assert.ok(shareUi.includes(`id: '${style}'`), `${style} text layout must be available`);
}

assert.match(shareUi, /function renderBalanceShareStylePreview\(/);
assert.match(shareUi, /touchstart[\s\S]*touchend[\s\S]*cycleBalanceShareOverlayStyle/);
assert.match(shareUi, /share_overlay_style:\s*getBalanceShareOverlayStyle\('workout'\)/);
assert.match(shareUi, /share_overlay_style:\s*getBalanceShareOverlayStyle\('pb'\)/);
assert.match(shareUi, /share_overlay_style:\s*getBalanceShareOverlayStyle\('activity'\)/);
assert.match(shareUi, /share_overlay_style:\s*getBalanceShareOverlayStyle\('nutrition'\)/);
assert.match(shareUi, /share_text_style:\s*getBalanceShareTextStyle\('workout'\)/);
assert.match(shareUi, /share_text_style:\s*getBalanceShareTextStyle\('pb'\)/);
assert.match(shareUi, /share_text_style:\s*getBalanceShareTextStyle\('activity'\)/);
assert.match(shareUi, /share_text_style:\s*getBalanceShareTextStyle\('nutrition'\)/);
assert.match(shareUi, /\['workout', 'pb', 'activity', 'nutrition'\]\.includes\(safeContext\)/);
assert.match(shareUi, /data-balance-share-text-style=/);
assert.match(shareUi, /function selectBalanceShareTextStyle\(/);
assert.match(shareUi, /const contentBottom = target === 'feed' \? height - 72 : height - 132;/);
assert.match(shareUi, /textStyle === 'scorecard'/);
assert.match(shareUi, /textStyle === 'simple'/);
assert.match(shareUi, /pbbShareSetFittedFont\(ctx, result, contentW, 156, 104\)/);
assert.ok(!shareUi.includes('pbbShareDrawCelebrationAccents'), 'photo share cards must not draw top-right celebration accents');
assert.match(shareUi, /target === 'feed' \? 600 : 670/);
assert.match(shareUi, /y \+= cardType === 'pb' \? 68 : 108/);
assert.match(shareUi, /let y = cardType === 'pb' \? contentBottom - 300 : contentBottom - 360/);
assert.match(shareUi, /y \+= cardType === 'pb' \? 64 : 114/);
assert.match(shareUi, /let y = contentBottom - 642/);
assert.match(shareUi, /ctx\.fillText\('WORKOUT COMPLETE'[\s\S]{0,140}y \+= 132/);

assert.match(shareUi, /sharePendingPostWorkoutCompositeToFeed[\s\S]*overlayStyle:\s*getBalanceShareOverlayStyle\(pending\.type\)/);
assert.match(shareUi, /sharePendingPostWorkoutCompositeToFeed[\s\S]*textStyle:\s*getBalanceShareTextStyle\(pending\.type\)/);
assert.match(shareUi, /shareWorkoutCardToInstagram[\s\S]*overlayStyle:\s*getBalanceShareOverlayStyle\('workout'\)/);
assert.match(shareUi, /shareWorkoutCardToInstagram[\s\S]*textStyle:\s*getBalanceShareTextStyle\('workout'\)/);
assert.match(shareUi, /sharePBCardToFeed[\s\S]*overlayStyle:\s*getBalanceShareOverlayStyle\('pb'\)/);
assert.match(shareUi, /sharePBCardToFeed[\s\S]*textStyle:\s*getBalanceShareTextStyle\('pb'\)/);
assert.match(shareUi, /shareActivityCardToFeed[\s\S]*overlayStyle:\s*getBalanceShareOverlayStyle\('activity'\)/);
assert.match(shareUi, /shareActivityCardToFeed[\s\S]*textStyle:\s*getBalanceShareTextStyle\('activity'\)/);
assert.match(shareUi, /shareNutritionToFeed[\s\S]*source:\s*'feed_nutrition_photo_overlay'/);
assert.match(shareUi, /shareNutritionToFeed[\s\S]*textStyle:\s*getBalanceShareTextStyle\('nutrition'\)/);
assert.match(shareUi, /shareNutritionToInstagram[\s\S]*photoDataUrl:\s*cachedNutritionShareBase64/);
assert.match(shareUi, /shareNutritionToInstagram[\s\S]*textStyle:\s*getBalanceShareTextStyle\('nutrition'\)/);
assert.match(mealUi, /share_text_style:\s*typeof window\.getBalanceShareTextStyle/);
assert.match(mealUi, /textStyle:\s*cardPayload\.share_text_style/);

for (const id of [
  'workout-share-style-controls',
  'activity-share-style-preview-wrap',
  'activity-share-style-controls',
  'nutrition-share-photo-btn',
  'nutrition-share-style-preview-wrap',
  'nutrition-share-style-controls'
]) {
  assert.ok(dashboard.includes(`id="${id}"`), `${id} must be present in the app UI`);
}

assert.ok(dashboard.includes("id: 'swipeable-photo-share-overlays-v1'"), 'returning users must see the new Feature Drop');
assert.ok(dashboard.includes("title:'Choose colour and text'"), 'new users must see the expanded guided share-style tour step');
assert.ok(dashboard.includes("id: 'workout-pb-text-layouts-v1'"), 'returning users must see the text-layout Feature Drop');
assert.ok(dashboard.includes("title:'Choose your text layout'"), 'new users must see the guided text-layout tour step');
assert.ok(dashboard.includes("id: 'meal-activity-text-layouts-v1'"), 'returning users must see the meal and activity text-layout Feature Drop');
assert.ok(dashboard.includes('dashboard-script-10-points_widget_functions.js?v=49'), 'phones must load the new share composer');
assert.ok(dashboard.includes('dashboard-script-11-calorie_tracker_functions.js?v=34'), 'phones must load the new meal share controls');
assert.match(mealUi, /data-meal-share-overlay-style=/);
assert.match(mealUi, /data-meal-share-text-style=/);
assert.match(mealUi, /function refreshMealSharePromptStyleButtons\(/);
assert.ok(serviceWorker.includes("const CACHE_NAME = 'pbb-app-v345-guided-tour-clarity'"), 'the app shell cache must be refreshed');
assert.ok(serviceWorker.includes('dashboard-script-10-points_widget_functions.js?v=49'), 'the new share composer must be precached');

console.log('Swipeable photo share overlay studio contract passed');
