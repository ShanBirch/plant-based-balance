const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const android = fs.readFileSync(
    path.join(root, 'android', 'app', 'src', 'main', 'java', 'com', 'fitgotchi', 'app', 'MainActivity.java'),
    'utf8'
);
const points = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.ok(
    android.includes('"balance_instagram_" + safeTarget + "_" + UUID.randomUUID() + extension'),
    'each Instagram image handoff must use a fresh content URI'
);
assert.ok(
    android.includes('"balance_instagram_motion_" + safeTarget + "_" + UUID.randomUUID() + extension'),
    'each Instagram video handoff must use a fresh content URI'
);
assert.ok(
    !android.includes('"balance_instagram_" + safeTarget + extension'),
    'image shares must not reuse the previous Instagram cache URI'
);
assert.ok(
    !android.includes('"balance_instagram_motion_" + safeTarget + extension'),
    'motion shares must not reuse the previous Instagram cache URI'
);
assert.ok(
    android.includes('public int getInstagramShareBridgeVersion()') && android.includes('return 2;'),
    'the updated Android shell must advertise the fresh-URI bridge contract'
);
assert.ok(
    points.includes('function canUseFreshAndroidInstagramShareBridge()') &&
        points.includes("typeof androidShare === 'function' && canUseFreshAndroidInstagramShareBridge()"),
    'the remote app must bypass legacy Android bridges that reuse Instagram URIs'
);
assert.ok(
        dashboard.includes('dashboard-script-10-points_widget_functions.js?v=49') &&
        serviceWorker.includes("const CACHE_NAME = 'pbb-app-v342-foundations-actions'") &&
        serviceWorker.includes('./js/dashboard/dashboard-script-10-points_widget_functions.js?v=49'),
    'the repaired share path must be cache-busted for installed apps'
);

console.log('Instagram share cache-busting contract passed');
