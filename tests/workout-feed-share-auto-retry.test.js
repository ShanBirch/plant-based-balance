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
const androidWorkflowSource = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'build-android.yml'),
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
    source.includes('let items = manual ? queuedItems.slice() : queuedItems.filter') &&
    source.includes("const nextAttempt = Date.parse(item.nextAttemptAt || item.createdAt || '')") &&
    source.includes('return !Number.isFinite(nextAttempt) || nextAttempt <= now') &&
    source.includes('function postWorkoutFeedShareQueueNow(targetId)'),
    'Share a Set retries should only post due queued items and expose the saved-upload Post now action'
);

assert.ok(
    source.includes('autoRetry: true') &&
    source.includes('if (navigator && navigator.onLine === false) {') &&
    source.includes("showWorkoutFeedShareUploadBanner('Waiting for reception', 'queued', { retry: true })"),
    'queued uploads should be marked for retry without trying to post while the phone is offline'
);

assert.ok(
    !source.includes('queueWorkoutFeedShareUntilWorkoutExit') &&
    !source.includes('waiting_for_workout_exit') &&
    !source.includes('Saved for after workout'),
    'Share a Set from an open workout should post immediately instead of saving for after the workout'
);

assert.ok(
    source.includes('Saved on this phone. Tap Post now to try again.') &&
    !source.includes('Use Post now from Feed'),
    'saved Share a Set retry banners should keep the action on the current screen'
);

assert.ok(
    source.includes('function isWorkoutFeedSharePostingStagingItem(item)') &&
    source.includes("return !isWorkoutFeedSharePostingStagingItem(item);") &&
    source.includes("String(item && item.lastError || '') === 'posting'"),
    'temporary posting-stage queue items should not render as saved Share a Set cards in Feed'
);

assert.ok(
    source.includes('async function discardWorkoutFeedShareQueue(manual, targetId)') &&
    source.includes('class="share-set-retry-clear"') &&
    source.includes('data-share-set-retry-clear') &&
    source.includes('window.discardWorkoutFeedShareQueue = discardWorkoutFeedShareQueue'),
    'saved Share a Set cards should expose an X action that clears a targeted saved upload'
);

assert.ok(
    source.includes('function compareWorkoutFeedShareQueueNewestFirst') &&
    source.includes('async function retryWorkoutFeedShareQueue(manual, targetId)') &&
    source.includes('const requestedQueueId = targetId ? String(targetId) :') &&
    source.includes("items = items.sort(compareWorkoutFeedShareQueueNewestFirst).slice(0, 1)") &&
    source.includes('data-share-set-retry-post') &&
    source.includes('discardWorkoutFeedShareQueue(true, button.getAttribute') &&
    source.includes('postWorkoutFeedShareQueueNow(button.getAttribute'),
    'manual Share a Set retry controls should target one saved queue item instead of looping through the whole backlog'
);

assert.ok(
    source.includes('async function clearPostedWorkoutFeedShareQueueItems(referenceItem)') &&
    source.includes('function isMatchingPostedWorkoutFeedShareQueueItem(item, referenceItem)') &&
    source.includes('await clearPostedWorkoutFeedShareQueueItems(initialQueueItem)') &&
    source.includes('clearPostedWorkoutFeedShareQueueItems(queueItem).catch(function () {})'),
    'successful Share a Set posts should clear matching staged queue items so saved cards disappear'
);

assert.ok(
    androidWorkflowSource.includes("if: ${{ github.event_name == 'workflow_dispatch' && inputs.upload_to_play == true }}") &&
    !androidWorkflowSource.includes("github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && inputs.upload_to_play == true)") &&
    !androidWorkflowSource.includes("github.event_name == 'push' && 'internal'"),
    'Android pushes should build without automatically uploading to Google Play'
);

assert.ok(
    dashboardSource.includes('pbb-deferred-formcheck.js?v=56'),
    'dashboard should bump Share a Set script version so phones fetch the retry fix'
);

console.log('workout feed share auto retry tests passed');
