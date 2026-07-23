const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pointsSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const functionStart = pointsSource.indexOf('async function sharePendingPostWorkoutCompositeToFeed()');
const functionEnd = pointsSource.indexOf('\nfunction getPostWorkoutShareViewportBottom()', functionStart);
const shareSource = pointsSource.slice(functionStart, functionEnd);

assert.ok(functionStart >= 0 && functionEnd > functionStart, 'photo overlay Feed share function must exist');
assert.ok(
    shareSource.includes('uploadStoryMediaToBackblaze(compositeFile') &&
        shareSource.includes("source: 'feed_workout_photo_overlay'") &&
        shareSource.includes('preferDirectUpload: true') &&
        shareSource.includes("if (!uploadData?.url) throw new Error('The overlay upload was not confirmed.');"),
    'workout photo overlays must use the confirmed iPhone-safe direct Feed uploader'
);
assert.ok(
    !shareSource.includes("fetch('/api/upload-story-media'") &&
        !shareSource.includes('new FormData()'),
    'workout photo overlays must not use the unreliable iOS multipart relay'
);
assert.ok(
    dashboardSource.includes('dashboard-script-10-points_widget_functions.js?v=34') &&
        serviceWorkerSource.includes("const CACHE_NAME = 'pbb-app-v265'") &&
        serviceWorkerSource.includes('./js/dashboard/dashboard-script-10-points_widget_functions.js?v=34'),
    'phones must fetch the repaired overlay share path'
);

console.log('workout photo overlay Feed upload contract passed');
