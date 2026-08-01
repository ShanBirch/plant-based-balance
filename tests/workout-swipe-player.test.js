const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const player = require(path.join(root, 'js/dashboard/pbb-workout-swipe-player.js'));

test('private workout player is restricted to Shannon primary account', () => {
    assert.equal(player.isTester({ id: '00a6605e-8edb-4917-85ba-24a23f179059' }), true);
    assert.equal(player.isTester({ id: 'd8600000-0000-0000-0000-000000000000' }), false);
    assert.equal(player.isTester({ id: 'fc500000-0000-0000-0000-000000000000' }), false);
    assert.equal(player.isTester(null), false);
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
    assert.equal((html.match(/pbb-workout-swipe-player\.js\?v=1/g) || []).length, 1);
    assert.equal((html.match(/dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=152/g) || []).length, 2);
    assert.match(html, /id="workout-add-existing-wrap"/);
    assert.match(html, /id="workout-add-existing-exercise-btn"/);
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
