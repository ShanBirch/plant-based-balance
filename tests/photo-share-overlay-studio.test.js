const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const shareUi = fs.readFileSync(
  path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
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
assert.match(shareUi, /data-balance-share-text-style=/);
assert.match(shareUi, /function selectBalanceShareTextStyle\(/);
assert.match(shareUi, /const contentBottom = target === 'feed' \? height - 72 : height - 132;/);
assert.match(shareUi, /textStyle === 'scorecard'/);
assert.match(shareUi, /textStyle === 'simple'/);
assert.match(shareUi, /pbbShareSetFittedFont\(ctx, result, contentW, 156, 104\)/);

assert.match(shareUi, /sharePendingPostWorkoutCompositeToFeed[\s\S]*overlayStyle:\s*getBalanceShareOverlayStyle\(pending\.type\)/);
assert.match(shareUi, /sharePendingPostWorkoutCompositeToFeed[\s\S]*textStyle:\s*getBalanceShareTextStyle\(pending\.type\)/);
assert.match(shareUi, /shareWorkoutCardToInstagram[\s\S]*overlayStyle:\s*getBalanceShareOverlayStyle\('workout'\)/);
assert.match(shareUi, /shareWorkoutCardToInstagram[\s\S]*textStyle:\s*getBalanceShareTextStyle\('workout'\)/);
assert.match(shareUi, /sharePBCardToFeed[\s\S]*overlayStyle:\s*getBalanceShareOverlayStyle\('pb'\)/);
assert.match(shareUi, /sharePBCardToFeed[\s\S]*textStyle:\s*getBalanceShareTextStyle\('pb'\)/);
assert.match(shareUi, /shareActivityCardToFeed[\s\S]*overlayStyle:\s*getBalanceShareOverlayStyle\('activity'\)/);
assert.match(shareUi, /shareNutritionToFeed[\s\S]*source:\s*'feed_nutrition_photo_overlay'/);
assert.match(shareUi, /shareNutritionToInstagram[\s\S]*photoDataUrl:\s*cachedNutritionShareBase64/);

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
assert.ok(dashboard.includes("title:'Swipe your share style'"), 'new users must see the guided share-style tour step');
assert.ok(dashboard.includes("id: 'workout-pb-text-layouts-v1'"), 'returning users must see the text-layout Feature Drop');
assert.ok(dashboard.includes("title:'Choose your text layout'"), 'new users must see the guided text-layout tour step');
assert.ok(dashboard.includes('dashboard-script-10-points_widget_functions.js?v=45'), 'phones must load the new share composer');
assert.ok(serviceWorker.includes("const CACHE_NAME = 'pbb-app-v313'"), 'the app shell cache must be refreshed');
assert.ok(serviceWorker.includes('dashboard-script-10-points_widget_functions.js?v=45'), 'the new share composer must be precached');

console.log('Swipeable photo share overlay studio contract passed');
