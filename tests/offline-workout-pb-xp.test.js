const assert = require('assert');
const fs = require('fs');
const path = require('path');

const script5 = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);
const pointsScript = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'dashboard', 'dashboard-script-10-points_widget_functions.js'),
    'utf8'
);
const supabaseSource = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'supabase.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const scriptPart2 = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard', 'script_part_2.js'), 'utf8');
const swSource = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

assert.ok(
    script5.includes('async function processSyncedWorkoutProgress(userId, sets)') &&
        script5.includes('dbHelpers.personalBests.checkAndUpdatePBs(userId, sets)') &&
        script5.includes('await awardPointsForNewPersonalBests(newPBs);') &&
        script5.includes("window.db.points.awardPoints(window.currentUser.id, 'personal_best', pbRefId"),
    'offline synced workouts should run the same PB detection and PB XP path as normal saves'
);

assert.ok(
    script5.includes('const progressSets = Array.isArray(item.progressSets) && item.progressSets.length') &&
        script5.includes('const progress = await processSyncedWorkoutProgress(user.id, progressSets);') &&
        script5.includes("console.log('Synced offline workout PBs:', progress.newPBs);"),
    'flushPendingWorkoutSaves should process and report PBs after a queued workout syncs'
);

assert.ok(
    script5.includes('const savedSets = [];') &&
        script5.includes('finalError.failedSets = remaining;') &&
        script5.includes('progressSets: setsToSave,') &&
        script5.includes('queuePendingWorkoutSave(failedSets, {'),
    'partial workout saves should queue only failed sets while retaining the full set list for PB processing'
);

assert.ok(
    pointsScript.includes('const canonicalPbRefId = pbData?.historyId') &&
        pointsScript.includes('|| pbData?.pbHistoryId') &&
        pointsScript.includes('|| pbData?.pb_history_id') &&
        pointsScript.includes('canonicalPbRefId,'),
    'PB XP awards should prefer the canonical pb_history id instead of a generated placeholder'
);

assert.ok(
    supabaseSource.includes(".select('id, achieved_at, workout_date')") &&
        supabaseSource.includes('historyId: weightHistoryRow?.id || null') &&
        supabaseSource.includes('historyId: repsHistoryRow?.id || null'),
    'checkAndUpdatePBs should return pb_history ids for new weight and reps PBs'
);

assert.ok(
    dashboardSource.includes('dashboard-script-5-initialize_stripe_for_inapp_pu.js?v=130') &&
        dashboardSource.includes('dashboard-script-10-points_widget_functions.js?v=17') &&
        dashboardSource.includes('js/dashboard/script_part_2.js?v=9') &&
        scriptPart2.includes('lib/supabase.js?v=9') &&
        swSource.includes('./lib/supabase.js?v=9') &&
        swSource.includes('./js/dashboard/script_part_2.js?v=9') &&
        swSource.includes('./js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js?v=130') &&
        swSource.includes('./js/dashboard/dashboard-script-10-points_widget_functions.js?v=17'),
    'dashboard and service worker cache keys should fetch the PB sync fix'
);

console.log('offline workout PB XP tests passed');
