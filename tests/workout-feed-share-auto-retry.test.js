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
    source.includes('retryWorkoutFeedShareQueue(false);') &&
    source.includes("window.addEventListener('online'") &&
    source.includes("document.addEventListener('visibilitychange'"),
    'queued Share a Set uploads should retry automatically when reception returns or the app resumes'
);

assert.ok(
    source.includes('const items = manual ? queuedItems : queuedItems.filter') &&
    source.includes('scheduleWorkoutFeedShareRetry(getWorkoutFeedShareNextRetryDelay(queuedItems))'),
    'automatic Share a Set retries should only post due queued items and schedule future attempts'
);

assert.ok(
    source.includes('autoRetry: true') &&
    source.includes('if (navigator && navigator.onLine === false) return;'),
    'newly queued uploads should schedule retry timers without trying while the phone is offline'
);

assert.ok(
    dashboardSource.includes('pbb-deferred-formcheck.js?v=18'),
    'dashboard should bump Share a Set script version so phones fetch the retry fix'
);

console.log('workout feed share auto retry tests passed');
