const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboardSource = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const builderSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-meal-builder.js'),
    'utf8'
);
const calorieTrackerSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-11-calorie_tracker_functions.js'),
    'utf8'
);
const shareRendererSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const baseStyles = fs.readFileSync(
    path.join(root, 'css', 'dashboard', 'dashboard-style-1.css'),
    'utf8'
);
const premiumStyles = fs.readFileSync(
    path.join(root, 'css', 'dashboard', 'pbb-premium-overlays.css'),
    'utf8'
);
const serviceWorkerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.ok(
    !dashboardSource.includes('id="meal-builder-combine-cta"') &&
        !dashboardSource.includes('One meal, separate items?') &&
        dashboardSource.includes('onclick="openMealBuilder()" title="Build a meal"'),
    'the Nutrition tracker must keep Build-a-Meal on its existing icon without a duplicate callout card'
);

assert.ok(
    dashboardSource.includes('saveBuiltMeal({ logNow: false })') &&
        dashboardSource.includes('Save for later') &&
        dashboardSource.includes('saveBuiltMeal({ logNow: true })') &&
        dashboardSource.includes('Log meal &amp; choose share'),
    'the builder must clearly separate reusable saving from logging and sharing the completed meal'
);

assert.ok(
    builderSource.includes("var logNow = !!(options && options.logNow);") &&
        builderSource.includes('await saveMealLogWithType({') &&
        builderSource.includes("inputMethod: 'builder'") &&
        builderSource.includes('mealDescription: name.substring(0, 60)') &&
        builderSource.includes('Choose where to share below.'),
    'logging a built meal must use the normal meal-log pipeline and preserve a clear share handoff'
);

const logBranchStart = builderSource.indexOf('if (logNow) {', builderSource.indexOf('window.saveBuiltMeal'));
const saveOnlyStart = builderSource.indexOf('} else {', logBranchStart);
const logBranch = builderSource.slice(logBranchStart, saveOnlyStart);
assert.ok(logBranchStart >= 0 && saveOnlyStart > logBranchStart, 'the log-now branch must be present');
assert.ok(
    !logBranch.includes(".from('user_saved_meals')") &&
        logBranch.includes('window._builderInterceptNextQuickMeal = false;'),
    'logging now must create one meal log without also creating a saved-meal duplicate or re-intercepting itself'
);

assert.ok(
    dashboardSource.includes("id: 'build-meal-icon-ig-layout-v1'") &&
        dashboardSource.includes("sel: '.meal-icon-btn[onclick*=\"openMealBuilder\"]'") &&
        dashboardSource.includes("title:'Build and share a full meal'") &&
        dashboardSource.includes("sel:'.meal-icon-btn[onclick*=\"openMealBuilder\"]"),
    'both returning-user Feature Drops and the guided tour must teach the icon-based meal flow'
);

assert.ok(
    !baseStyles.includes('.meal-builder-combine-cta') &&
        !premiumStyles.includes('.meal-builder-combine-cta') &&
        baseStyles.includes('.meal-builder-footer-actions') &&
        premiumStyles.includes('html[data-pbb-theme="light"] .meal-builder-save-only-btn'),
    'the removed callout must leave no dead styles while the builder actions retain light-theme contrast'
);

assert.ok(
    calorieTrackerSource.includes("showToast('Choose the meal photo for your Instagram layout', 'info');") &&
        calorieTrackerSource.includes('mealForShare = await attachPhotoToMealForFeedShare(mealForShare, selectedPhoto);') &&
        calorieTrackerSource.includes("if (!photoDataUrl) throw new Error('Meal photo was not available for the Instagram layout');") &&
        shareRendererSource.includes("if (cardType === 'meal' && primaryPhotoDataUrl)") &&
        shareRendererSource.includes('await pbbShareDrawFullBleedMealCard(ctx, cardPayload, width, height, target);'),
    'Instagram sharing must attach a meal photo and render the designed full-bleed nutrition layout over it'
);

assert.ok(
    dashboardSource.includes('dashboard-style-1.css?v=67') &&
        dashboardSource.includes('pbb-premium-overlays.css?v=90') &&
        dashboardSource.includes('dashboard-script-meal-builder.js?v=2') &&
        dashboardSource.includes('dashboard-script-11-calorie_tracker_functions.js?v=27') &&
        serviceWorkerSource.includes("const CACHE_NAME = 'pbb-app-v262'"),
    'phones must fetch the new meal-builder UI, behavior, and styles'
);

console.log('Meal builder log and share flow contracts passed');
