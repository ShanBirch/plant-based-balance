/* Verified character action mappings. See docs/fitgotchi-animation-audit.md.
 * Keys are stable app actions; values are exact clips in the loaded GLB.
 * Never use substring/index/first-clip fallbacks: legacy exports reuse names.
 */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) {
        root.PbbCharacterAnimations = api;
        // The model can load seconds before the deferred dashboard controller.
        root.document.addEventListener('load', event => {
            if (event.target?.id === 'tamagotchi-model') void api.rest(event.target);
        }, true);
    }
})(typeof window !== 'undefined' ? window : null, function() {
    'use strict';

    // The first 29 tracks of this export were relabelled without moving their
    // animation data. Prefer the correctly named duplicate where one exists.
    const femaleStarter = {
        laugh: null, walk: 'karate', warm_up: 'warm_up', greet: null,
        pitch: null, arms_up_still: 'sad_stand', greet_1: null,
        laugh_1: 'die', angry: 'hit_to_2', karate: 'angry_1',
        sad_stand: null, boxing: 'laugh_2', laugh_2: null,
        stretch: 'laugh_1', hit_to_1: null, dance: 'dance_2',
        hit_to_2: null, fold_arms: null, die: 'dance_1', laugh_3: null,
        angry_1: null, idle: 'stand', stand_hands_on_hips: null,
        hit_to_head: 'dance', strut: 'strut', hit_to_side: 'arms_up_still',
        dance_1: null, dance_2: null, dance_3: null
    };
    const shanbot = {
        laugh: 'laugh', greet: 'greet', agree: 'agree', fold_arms: 'fold_arms',
        dance: 'dance', lose: 'dissapointed', hit_to_head: 'big_hit',
        hit_to_side: 'hit', kick: 'kick', pushup: 'push_up',
        angry_walk: 'angry_walk', block: 'scared', kick_2: 'spin_kick',
        stand: 'idle', idle: 'stand'
    };
    const states = new WeakMap();
    const source = mv => String(mv?.getAttribute?.('src') || mv?.src || '');
    const filename = mv => source(mv).split(/[?#]/)[0].split('/').pop().toLowerCase();
    const normalize = name => String(name || '').split('|').pop().trim().toLowerCase().replace(/[ -]+/g, '_');

    function resolve(mv, action) {
        if (!mv || mv.loaded === false) return null;
        const file = filename(mv);
        let clip = normalize(action);
        if (file === 'shanbot_final.glb') {
            clip = shanbot[clip] || null;
        } else if (file === 'level_1_female_final.glb' && Object.hasOwn(femaleStarter, clip)) {
            clip = femaleStarter[clip];
        } else if (file === 'baby_full_animations.glb' && clip === 'laugh') {
            clip = 'NlaTrack.055';
        }
        if (!clip) return null;
        return (mv.availableAnimations || []).find(name => normalize(name) === normalize(clip)) || null;
    }

    function available(mv, catalogue) {
        const used = new Set();
        return catalogue.filter(action => {
            const clip = resolve(mv, action.name);
            if (!clip || used.has(clip)) return false;
            used.add(clip);
            return true;
        }).map(action => filename(mv) === 'level_1_female_final.glb' && action.name === 'strut'
            ? { ...action, displayName: 'Forward Flip', category: 'special' } : action);
    }

    function cancel(mv) {
        const previous = states.get(mv);
        if (previous?.finished) mv.removeEventListener('finished', previous.finished);
        states.delete(mv);
    }

    function restingClip(mv) {
        // These clips have visible breathing/weight shifts. No action or bind
        // pose is an acceptable fallback for a missing resting animation.
        return resolve(mv, 'idle') || resolve(mv, 'stand') ||
            (mv.availableAnimations || []).find(name =>
                ['breathing_idle', 'idle_loop', 'breathing', 'relaxed_idle'].includes(normalize(name))) || null;
    }

    async function rest(mv) {
        if (!mv) return false;
        const clip = restingClip(mv);
        const wasResting = states.get(mv)?.resting;
        cancel(mv);
        if (!clip) { mv.pause(); return false; }
        const state = { source: source(mv), clip, resting: true };
        states.set(mv, state);
        const unchanged = mv.animationName === clip;
        if (!unchanged || !wasResting) mv.pause();
        mv.animationCrossfadeDuration = 300;
        mv.animationName = clip;
        if (!unchanged || !wasResting) mv.requestUpdate?.('animationName');
        await mv.updateComplete;
        if (states.get(mv) !== state || source(mv) !== state.source) return false;
        if (!unchanged || !wasResting) mv.currentTime = 0;
        mv.timeScale = 1;
        // model-viewer forwards mixer completion from fading-out clips too.
        // Such an event must not leave the new breathing loop paused.
        state.finished = () => {
            if (states.get(mv) === state && source(mv) === state.source && mv.animationName === clip) {
                mv.play({ repetitions: Infinity });
            }
        };
        mv.addEventListener('finished', state.finished);
        mv.play({ repetitions: Infinity });
        return true;
    }

    async function play(mv, action, options = {}) {
        const clip = resolve(mv, action);
        if (!clip) return false;
        cancel(mv);
        const state = { source: source(mv), clip, resting: false };
        states.set(mv, state);
        // Updating while paused clears model-viewer's old faded actions. An
        // already-faded cached action can otherwise disable a later replay,
        // even while the viewer reports paused=false.
        mv.pause();
        mv.animationCrossfadeDuration = 200;
        mv.animationName = clip;
        mv.requestUpdate?.('animationName');
        // model-viewer changes clips during its update. Starting or reading
        // duration before that update can replay/time the previous animation.
        await mv.updateComplete;
        if (states.get(mv) !== state || source(mv) !== state.source) return false;
        mv.currentTime = 0;
        mv.timeScale = 1;
        if (!options.loop) {
            state.finished = () => {
                if (states.get(mv) === state && source(mv) === state.source && mv.animationName === clip) {
                    if (mv.duration > 0 && mv.currentTime < mv.duration - 0.05) {
                        // A previous clip finished during the crossfade. Keep
                        // the requested move playing until its own last frame.
                        mv.play({ repetitions: 1 });
                        return;
                    }
                    void rest(mv);
                }
            };
            mv.addEventListener('finished', state.finished);
        }
        mv.play({ repetitions: options.loop ? Infinity : 1 });
        return true;
    }

    return { resolve, available, restingClip, rest, play, cancel, filename };
});
