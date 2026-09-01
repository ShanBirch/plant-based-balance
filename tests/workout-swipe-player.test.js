const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const player = require(path.join(root, 'js/dashboard/pbb-workout-swipe-player.js'));

test('workout player stays available to every signed-in user', () => {
    assert.equal(player.isEligibleUser({ id: '00a6605e-8edb-4917-85ba-24a23f179059' }), true);
    assert.equal(player.isEligibleUser({ id: 'd8600000-0000-0000-0000-000000000000' }), true);
    assert.equal(player.isEligibleUser({ id: 'fc500000-0000-0000-0000-000000000000' }), true);
    assert.equal(player.isEligibleUser({}), false);
    assert.equal(player.isEligibleUser(null), false);
});

test('focus mode pilot is fail-closed to Shannon primary account', () => {
    assert.equal(player.isFocusPilotUser({
        id: '00a6605e-8edb-4917-85ba-24a23f179059',
        email: 'shannonbirch@cocospersonaltraining.com'
    }), true);
    assert.equal(player.isFocusPilotUser({
        id: '00a6605e-8edb-4917-85ba-24a23f179059',
        email: 'member@example.com'
    }), false);
    assert.equal(player.isFocusPilotUser({
        id: 'another-user',
        email: 'shannonbirch@cocospersonaltraining.com'
    }), false);
    assert.equal(player.isFocusPilotUser(null), false);
});

test('view preference defaults to swipe and preserves list', () => {
    assert.equal(player.normalizeMode(undefined), 'swipe');
    assert.equal(player.normalizeMode('unexpected'), 'swipe');
    assert.equal(player.normalizeMode('swipe'), 'swipe');
    assert.equal(player.normalizeMode('list'), 'list');
});

test('exercise page index stays inside available cards', () => {
    assert.equal(player.clampIndex(-1, 4), 0);
    assert.equal(player.clampIndex(2, 4), 2);
    assert.equal(player.clampIndex(8, 4), 3);
    assert.equal(player.clampIndex(Number.NaN, 4), 0);
    assert.equal(player.clampIndex(1, 0), 0);
});

test('dashboard loads the player once and cache-busts both main loader paths', () => {
    const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.equal((html.match(/pbb-workout-swipe-player\.js\?v=4/g) || []).length, 1);
    assert.equal((html.match(/dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=227-meal-primary-tabs/g) || []).length, 3);
    assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v457-shannon-workout-focus'/);
    assert.match(html, /id="workout-add-existing-wrap"/);
    assert.match(html, /id="workout-add-existing-exercise-btn"/);
});

test('existing workout views remain available while focus mode is private', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-workout-swipe-player.js'), 'utf8');
    assert.match(source, /workout-player-enabled #workout-swipe-actions/);
    assert.match(source, /workout-player-enabled #workout-form-check-top-btn/);
    assert.match(source, /SHANNON_PRIMARY_USER_ID/);
    assert.match(source, /view\.classList\.toggle\('workout-focus-pilot', focusPilot\)/);
    assert.doesNotMatch(source, /workout-swipe-mode #workout-swipe-actions\s*\{/);
});

test('focus menu and set controls call the live workout functions', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-workout-swipe-player.js'), 'utf8');
    assert.match(source, /Film Form Check[\s\S]*openFormCheck/);
    assert.match(source, /Share a Set[\s\S]*openWorkoutFeedShare/);
    assert.match(source, /Add Exercise[\s\S]*openAddExerciseModal/);
    assert.match(source, /Workout Notes[\s\S]*openActiveExerciseNote/);
    assert.match(source, /Finish & Save Workout[\s\S]*finishWorkout/);
    assert.match(source, /Complete set & start rest/);
    assert.match(source, /root\.startRestTimer\(true\)/);
    assert.match(source, /pbb-theme-dark #view-active-workout\.workout-focus-pilot/);
});

test('private focus mode has gated feature-drop and guided-tour entries', () => {
    const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    assert.match(html, /id: 'shannon-workout-focus-mode-v1'/);
    assert.match(html, /title:'Your private Focus Mode'/);
    assert.ok((html.match(/00a6605e-8edb-4917-85ba-24a23f179059/g) || []).length >= 4);
    assert.ok((html.match(/shannonbirch@cocospersonaltraining\.com/g) || []).length >= 2);
});

test('workout renderers synchronize the alternate player', () => {
    const source = fs.readFileSync(
        path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
        'utf8'
    );
    assert.ok((source.match(/PBBWorkoutSwipePlayer\?\.sync/g) || []).length >= 6);
    assert.match(source, /card\.dataset\.prescribedSets/);
    assert.match(source, /card\.dataset\.prescribedReps/);
});

test('first-time workout rows prefill prescribed reps or time', () => {
    const source = fs.readFileSync(
        path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
        'utf8'
    );
    assert.match(source, /function getPrescribedSetPrefill\(exercise, isTimeBased\)/);
    assert.match(source, /isTimeBased\s*\?\s*\{ time: numericTarget\[0\] \}/);
    assert.match(source, /\{ reps: numericTarget\[0\] \}/);
    assert.match(source, /mergeSetPrefill\(prevSet, prescribedSet\)/);
    assert.match(source, /ex\.video_url \|\| ex\.videoUrl \|\| findVideoMatch\(ex\.name\)/);
});

test('Francesca repaired workout uses four exact video catalog exercises', () => {
    const catalogSource = fs.readFileSync(path.join(root, 'exercise_videos.js'), 'utf8');
    const catalog = vm.runInNewContext(`${catalogSource}\n;EXERCISE_VIDEOS;`);
    const exercises = [
        'Supine Hip Axial Rotations',
        'Clamshell',
        'Glute Bridge',
        'Lying Hip Abductions'
    ];
    assert.equal(exercises.length, 4);
    exercises.forEach((name) => {
        const video = catalog[name];
        assert.equal(typeof video, 'string');
        assert.ok(video.startsWith('https://') || video.startsWith('/assets/'));
        if (video.startsWith('/assets/')) assert.equal(fs.existsSync(path.join(root, video)), true);
    });
});
