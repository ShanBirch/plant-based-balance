const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'pbb-deferred-formcheck.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(
    path.join(__dirname, '..', 'dashboard.html'),
    'utf8'
);

assert.ok(
    !source.includes('if (!manual) return;'),
    'Share a Set background retries must not immediately return before checking the queue'
);

assert.ok(
    source.includes("window.addEventListener('online'") &&
    source.includes("window.addEventListener('offline'") &&
    source.includes("document.addEventListener('visibilitychange'") &&
    source.includes('refreshWorkoutFeedShareRetryNotice().catch(function () {})'),
    'queued Share a Set uploads should refresh the saved-upload notice when reception changes or the app resumes'
);

assert.ok(
    source.includes('const items = manual ? queuedItems : queuedItems.filter') &&
    source.includes("const nextAttempt = Date.parse(item.nextAttemptAt || item.createdAt || '')") &&
    source.includes('return !Number.isFinite(nextAttempt) || nextAttempt <= now') &&
    source.includes('function postWorkoutFeedShareQueueNow()'),
    'Share a Set retries should only post due queued items and expose the saved-upload Post now action'
);

assert.ok(
    source.includes('autoRetry: true') &&
    source.includes('if (navigator && navigator.onLine === false) {') &&
    source.includes("showWorkoutFeedShareUploadBanner('Waiting for reception', 'queued', { retry: true })"),
    'queued uploads should be marked for retry without trying to post while the phone is offline'
);

assert.ok(
    dashboardSource.includes('pbb-deferred-formcheck.js?v=35'),
    'dashboard should bump Share a Set script version so phones fetch the retry fix'
);

console.log('workout feed share auto retry tests passed');
