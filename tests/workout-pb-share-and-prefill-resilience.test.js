const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const workoutSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);
const supabaseSource = fs.readFileSync(path.join(root, 'lib', 'supabase.js'), 'utf8');
const savedWorkoutSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'pbb-deferred-savedworkouts.js'),
    'utf8'
);
const workoutBuilderSource = fs.readFileSync(
    path.join(root, 'js', 'dashboard', 'pbb-deferred-workoutbuilder.js'),
    'utf8'
);
const dashboardSource = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const loaderSource = fs.readFileSync(path.join(root, 'js', 'dashboard', 'script_part_2.js'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.ok(
    workoutSource.includes('const [improvementsResult, milestonesResult, pbResult] = await Promise.allSettled([') &&
        workoutSource.includes("const newPBs = pbResult.status === 'fulfilled' ? (pbResult.value || []) : [];") &&
        workoutSource.includes('await showWorkoutSuccessScreen(duration, improvements, milestones, setsToSave, newPBs);'),
    'a successful PB result must reach the success/share screen even if another progress check fails'
);

assert.ok(
    workoutSource.includes('const [milestonesResult, pbResult] = await Promise.allSettled([') &&
        workoutSource.includes("console.warn('Offline workout PB check failed:', pbResult.reason);"),
    'offline workout sync must preserve successful PB processing independently of milestone failures'
);

assert.ok(
    supabaseSource.includes('async getLatestHistoryForExercises(userId, exerciseNames)') &&
        supabaseSource.includes(".select('workout_date')") &&
        supabaseSource.includes(".eq('workout_date', latestDate)") &&
        supabaseSource.includes(".order('set_number', { ascending: true })") &&
        supabaseSource.includes('const results = await Promise.allSettled(') &&
        supabaseSource.includes('for (let attempt = 0; attempt < 2; attempt += 1)') &&
        supabaseSource.includes('failedCachedRows'),
    'previous-set prefill must fetch the complete latest session for every requested exercise'
);

assert.ok(
    workoutSource.includes('function normalizeWorkoutExerciseHistoryKey(name)') &&
        workoutSource.includes('window.workoutHistoryCache = [...preserved, ...normalized];') &&
        workoutSource.includes('normalizeWorkoutExerciseHistoryKey(h.exercise) === exerciseKey'),
    'a partial mobile history response must preserve other exercise history and tolerate harmless name formatting differences'
);

assert.ok(
    workoutSource.includes('await preloadWorkoutHistoryForExercises(user.id, exercises.map(ex => ex.name));') &&
        savedWorkoutSource.includes('await preloadWorkoutHistoryForExercises(user.id, exerciseNames);') &&
        workoutBuilderSource.includes('await preloadWorkoutHistoryForExercises(user.id, customWorkoutSelection);'),
    'program, library, inline, saved, and builder workout paths must use exact per-exercise history'
);

assert.ok(
    dashboardSource.includes('script_part_2.js?v=15-meal-reminders-retired') &&
    dashboardSource.includes('dashboard-script-5-initialize_stripe_for_inapp_pu.js?v=227-meal-primary-tabs') &&
        dashboardSource.includes('pbb-deferred-workoutbuilder.js?v=10') &&
        dashboardSource.includes('pbb-deferred-savedworkouts.js?v=7') &&
        loaderSource.includes('lib/supabase.js?v=16-meal-reminders-retired') &&
serviceWorkerSource.includes("const CACHE_NAME = 'pbb-app-v455-guided-activity-log'") &&
        serviceWorkerSource.includes('./lib/supabase.js?v=16-meal-reminders-retired') &&
        serviceWorkerSource.includes('./js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js?v=227-meal-primary-tabs'),
    'phones must fetch the repaired PB and previous-session code instead of cached versions'
);

console.log('workout PB share and previous-session prefill resilience tests passed');
