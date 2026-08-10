const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const player = require(path.join(root, 'js/dashboard/pbb-workout-swipe-player.js'));

test('workout player is available to every signed-in user', () => {
    assert.equal(player.isEligibleUser({ id: '00a6605e-8edb-4917-85ba-24a23f179059' }), true);
    assert.equal(player.isEligibleUser({ id: 'd8600000-0000-0000-0000-000000000000' }), true);
    assert.equal(player.isEligibleUser({ id: 'fc500000-0000-0000-0000-000000000000' }), true);
    assert.equal(player.isEligibleUser({}), false);
    assert.equal(player.isEligibleUser(null), false);
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
    assert.equal((html.match(/pbb-workout-swipe-player\.js\?v=3/g) || []).length, 1);
    assert.equal((html.match(/dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=176/g) || []).length, 2);
    assert.match(html, /id="workout-add-existing-wrap"/);
    assert.match(html, /id="workout-add-existing-exercise-btn"/);
});

test('all users share the compact workout action row in list and swipe modes', () => {
    const source = fs.readFileSync(path.join(root, 'js/dashboard/pbb-workout-swipe-player.js'), 'utf8');
    assert.match(source, /workout-player-enabled #workout-swipe-actions/);
    assert.match(source, /workout-player-enabled #workout-form-check-top-btn/);
    assert.doesNotMatch(source, /SHANNON_PRIMARY_USER_ID|workout-player-tester|isTester/);
    assert.doesNotMatch(source, /workout-swipe-mode #workout-swipe-actions\s*\{/);
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
