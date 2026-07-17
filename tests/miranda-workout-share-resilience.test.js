const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const workoutSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);
const shareSetSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'pbb-deferred-formcheck.js'),
    'utf8'
);
const pointsSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const addSetStart = workoutSource.indexOf('function addWorkoutSet(');
const addSetEnd = workoutSource.indexOf('\nfunction deleteSetRow(', addSetStart);
const addSetSource = workoutSource.slice(addSetStart, addSetEnd);
assert.ok(addSetStart >= 0 && addSetEnd > addSetStart, 'Add Set implementation must be present');
assert.ok(
    addSetSource.indexOf('previouslyFocusedInput.blur()') < addSetSource.indexOf('container.appendChild(newRow)') &&
        addSetSource.indexOf('container.appendChild(newRow)') < addSetSource.indexOf("newRow.querySelector(isTimeBased ? '.input-time' : '.input-kg')") &&
        addSetSource.includes('primaryInput.focus({ preventScroll: true })'),
    'Add Set must release the old iOS field and focus the new row before more typing'
);

assert.ok(
    shareSetSource.includes("caption: '',") &&
        shareSetSource.includes('function captureWorkoutFeedShareCaption()') &&
        shareSetSource.includes('workoutFeedShareState.caption = caption;') &&
        shareSetSource.includes('const caption = optionCaption || workoutFeedShareState.caption || liveCaption;'),
    'Share a Set must snapshot the caption before a native picker can rebuild the WebView'
);

for (const opener of ['openWorkoutFeedShareCapture', 'openWorkoutFeedShareGallery']) {
    const start = shareSetSource.indexOf(`function ${opener}(`);
    const body = shareSetSource.slice(start, shareSetSource.indexOf('\n    function ', start + 20));
    assert.ok(
        body.indexOf('captureWorkoutFeedShareCaption();') >= 0 &&
            body.indexOf('captureWorkoutFeedShareCaption();') < body.indexOf('beginWorkoutFeedShareDiagnosticAttempt('),
        `${opener} must preserve the caption before opening native UI`
    );
}

assert.ok(
    pointsSource.includes("const helpers = window.dbHelpers || (typeof dbHelpers !== 'undefined' ? dbHelpers : null);") &&
        pointsSource.includes("if (!story || !story.id)") &&
        pointsSource.includes("throw new Error('The PB post was not confirmed by the Feed.');") &&
        pointsSource.includes('pbData.previousValue != null'),
    'PB sharing must use the live helper safely, preserve the previous PB, and require a confirmed story receipt'
);

assert.ok(
    dashboardSource.includes('dashboard-script-5-initialize_stripe_for_inapp_pu.js?v=147') &&
        dashboardSource.includes('pbb-deferred-formcheck.js?v=56') &&
        dashboardSource.includes('dashboard-script-10-points_widget_functions.js?v=28') &&
        serviceWorkerSource.includes("const CACHE_NAME = 'pbb-app-v256'") &&
        serviceWorkerSource.includes('./js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js?v=147') &&
        serviceWorkerSource.includes('./js/dashboard/pbb-deferred-formcheck.js?v=56') &&
        serviceWorkerSource.includes('./js/dashboard/dashboard-script-10-points_widget_functions.js?v=28'),
    'phones must fetch all three Miranda workout/share repairs'
);

assert.ok(
    workoutSource.includes('function continueRecoveredWorkout()') &&
        workoutSource.includes('Continue Workout') &&
        workoutSource.includes('startWorkoutTimer(backup.workoutStartTime)') &&
        workoutSource.includes("showToast('Workout restored, keep going where you left off.', 'success')"),
    'an interrupted workout must offer a real continue path and retain its elapsed timer'
);

console.log('Miranda workout and share resilience contracts passed');
