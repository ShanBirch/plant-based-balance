const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const api = require('../lib/fitgotchi-animations');
const inventory = require('./fixtures/fitgotchi-clips.json');
const source = fs.readFileSync(require.resolve('../js/dashboard/dashboard-script-13.js'), 'utf8');
const catalogue = vm.runInNewContext(source.match(/const ANIMATION_UNLOCKS = (\[[\s\S]*?\n        \]);/)[1]);

class Viewer extends EventTarget {
    constructor(file, names) {
        super();
        this.src = 'https://example.test/' + file + '?v=21';
        this.availableAnimations = names || inventory.groups.find(g => g.files.includes(file)).clips.map(c => c[0]);
        this.loaded = true;
        this.updateComplete = Promise.resolve();
        this.currentTime = 8;
        this.calls = [];
        this.updates = [];
    }
    getAttribute() { return this.src; }
    play(options) { this.paused = false; this.calls.push({ clip: this.animationName, time: this.currentTime, ...options }); }
    pause() { this.paused = true; }
    requestUpdate(property) { this.updates.push({ property, paused: this.paused }); }
}

test('all 98 audited assets expose only exact, unique supported clips', () => {
    assert.equal(inventory.groups.flatMap(g => g.files).length, 98);
    for (const group of inventory.groups) for (const file of group.files) {
        const mv = new Viewer(file);
        const moves = api.available(mv, catalogue);
        const clips = moves.map(a => api.resolve(mv, a.name));
        assert.equal(new Set(clips).size, clips.length, file);
        for (const clip of clips) assert.ok(mv.availableAnimations.includes(clip), file + ': ' + clip);
        assert.equal(Boolean(api.restingClip(mv)), group.clips.length > 0, file);
    }
});

test('legacy female slots map to their actual movements and preserve unlock levels', () => {
    const mv = new Viewer('level_1_female_final.glb');
    for (const [action, clip] of Object.entries({ dance: 'dance_2', boxing: 'laugh_2', walk: 'karate', laugh_1: 'die', stretch: 'laugh_1', hit_to_head: 'dance', die: 'dance_1', idle: 'stand' })) {
        assert.equal(api.resolve(mv, action), clip, action);
    }
    assert.equal(api.resolve(mv, 'greet'), null, 'greet is a dance in this export');
    assert.equal(api.resolve(mv, 'dance_3'), null, 'dance_3 is a duplicate standing clip');
    const moves = api.available(mv, catalogue);
    assert.equal(moves.find(a => a.name === 'strut').displayName, 'Forward Flip');
    assert.equal(moves.find(a => a.name === 'dance').unlockLevel, 5);
    assert.equal(moves.find(a => a.name === 'hit_to_head').unlockLevel, 15);
});

test('baby laughter uses the recovered clip; Shanbot uses its own smaller vocabulary', () => {
    assert.equal(api.resolve(new Viewer('baby_full_animations.glb'), 'laugh'), 'NlaTrack.055');
    const mv = new Viewer('shanbot_final.glb');
    assert.equal(api.resolve(mv, 'pushup'), 'push_up');
    assert.equal(api.resolve(mv, 'kick_2'), 'spin_kick');
    assert.equal(api.resolve(mv, 'lose'), 'dissapointed');
    assert.equal(api.resolve(mv, 'boxing'), null);
    assert.equal(api.restingClip(mv), 'stand');
});

test('missing clips never fall back to a similar name, action, or T-pose', () => {
    const mv = new Viewer('unknown.glb', ['dance_1', 'sad_stand', 'T-pose', 'angry_walk']);
    assert.equal(api.resolve(mv, 'dance'), null);
    assert.equal(api.resolve(mv, 'walk'), null);
    assert.equal(api.restingClip(mv), null);
    mv.availableAnimations = ['Armature|Idle', 'Push-Up'];
    assert.equal(api.restingClip(mv), 'Armature|Idle');
    mv.loaded = false;
    assert.equal(api.resolve(mv, 'idle'), null);
});

test('a move starts from frame zero after clip update, finishes once, and returns to a live idle', async () => {
    const mv = new Viewer('level_50_real_final.glb');
    let update;
    mv.updateComplete = new Promise(resolve => { update = resolve; });
    const pending = api.play(mv, 'dance');
    assert.equal(mv.calls.length, 0);
    update();
    assert.equal(await pending, true);
    assert.deepEqual(mv.calls.at(-1), { clip: 'dance', time: 0, repetitions: 1 });
    mv.dispatchEvent(new Event('finished'));
    await Promise.resolve();
    assert.equal(mv.animationName, 'idle');
    assert.equal(mv.calls.at(-1).repetitions, Infinity);
    mv.currentTime = 7;
    await api.rest(mv);
    assert.equal(mv.currentTime, 7, 'repeated resting calls must not restart breathing');
});

test('rapid taps and skin changes cancel old playback ownership', async () => {
    const mv = new Viewer('baby_full_animations.glb');
    let update;
    mv.updateComplete = new Promise(resolve => { update = resolve; });
    const first = api.play(mv, 'laugh');
    const second = api.play(mv, 'dance');
    update();
    assert.equal(await first, false);
    assert.equal(await second, true);
    assert.equal(mv.calls.length, 1);
    mv.src = 'https://example.test/shanbot_final.glb';
    mv.animationName = 'stand';
    mv.dispatchEvent(new Event('finished'));
    await Promise.resolve();
    assert.equal(mv.calls.length, 1, 'old character completion must not reset the new skin');
});

test('a repeated action restarts, while fixed-pose assets never fake movement', async () => {
    const mv = new Viewer('level_50_real_final.glb');
    await api.play(mv, 'dance');
    mv.currentTime = 2;
    await api.play(mv, 'dance');
    assert.equal(mv.calls.at(-1).time, 0);
    assert.ok(mv.updates.length >= 2);
    assert.ok(mv.updates.every(update => update.property === 'animationName' && update.paused), 'clear old faded actions before replaying');
    const fixed = new Viewer('43.glb');
    assert.equal(await api.play(fixed, 'dance'), false);
    assert.equal(await api.rest(fixed), false);
    assert.equal(fixed.calls.length, 0);
});

test('an outgoing crossfade completion cannot cut a move short or freeze resting', async () => {
    const mv = new Viewer('level_50_real_final.glb');
    mv.duration = 3;
    await api.play(mv, 'dance');
    mv.currentTime = 0.2;
    mv.dispatchEvent(new Event('finished'));
    await Promise.resolve();
    assert.equal(mv.animationName, 'dance');
    assert.equal(mv.calls.at(-1).repetitions, 1);
    mv.currentTime = 3;
    mv.dispatchEvent(new Event('finished'));
    await Promise.resolve();
    assert.equal(mv.animationName, 'idle');
    mv.dispatchEvent(new Event('finished'));
    assert.equal(mv.calls.at(-1).repetitions, Infinity);
});
