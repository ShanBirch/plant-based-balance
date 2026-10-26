const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const declarations = [];
for (const file of ['dashboard-script-5-initialize_stripe_for_inapp_pu.js', 'dashboard-script-7-video_logic.js']) {
    const text = fs.readFileSync(path.join(root, 'js/dashboard', file), 'utf8');
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements) {
        if (ts.isFunctionDeclaration(node)) declarations.push(node.getText(ast));
    }
}
const catalog = vm.runInNewContext(fs.readFileSync(path.join(root, 'exercise_videos.js'), 'utf8') + ';EXERCISE_VIDEOS;');

function harness(options = {}) {
    const cards = [], alerts = [], events = [];
    const modal = { style: { display: 'block' } };
    const list = {
        insertAdjacentHTML(position, html) {
            assert.equal(position, 'beforeend');
            events.push('insert');
            cards.push({
                dataset: { exerciseName: html.match(/data-exercise-name="([^"]+)"/)[1] },
                html,
                scrollIntoView() { if (options.focusThrows) throw Error('focus failed'); }
            });
        },
        get lastElementChild() { return cards.at(-1); }
    };
    const context = {
        console: { log() {}, warn() {}, error() {} }, EXERCISE_VIDEOS: catalog,
        window: { currentUser: { id: 'in-memory-only' }, currentWorkoutKey: 'in-memory-only', workoutHistoryCache: [], exerciseNotesCache: {}, coachNotesCache: {} },
        document: {
            createElement() { return { textContent: '', get innerHTML() { return this.textContent; } }; },
            getElementById(id) { return id === 'workout-exercises-list' ? (options.missingList ? null : list) : id === 'add-exercise-modal' ? modal : null; },
            querySelectorAll() { return cards; }
        },
        confirm() { events.push('confirm'); return options.confirm !== false; },
        alert(message) { alerts.push(message); },
        dbHelpers: { workoutCustomizations: { async addExercise() { events.push('save'); if (options.save) await options.save(); } } }
    };
    vm.createContext(context);
    vm.runInContext(declarations.join('\n'), context);
    context.setupVolumeTracking = () => { if (options.volumeThrows) throw Error('volume failed'); };
    return { context, cards, alerts, events, modal };
}

test('OK inserts locally and closes before a permanent save resolves; repeat taps cannot duplicate', async () => {
    let finish;
    const h = harness({ save: () => new Promise(resolve => { finish = resolve; }) });
    const pending = h.context.selectExerciseToAdd('Chin Up');
    assert.equal(h.cards.length, 1);
    assert.equal(h.modal.style.display, 'none');
    assert.deepEqual(h.events, ['confirm', 'insert', 'save']);
    await h.context.selectExerciseToAdd('Chin Up');
    assert.equal(h.cards.length, 1);
    finish(); await pending;
    await h.context.selectExerciseToAdd('Chin Up');
    assert.equal(h.cards.length, 1);
    assert.equal(h.events.filter(e => e === 'save').length, 1);
    assert.match(h.alerts.at(-1), /already in this workout/);
});

test('Cancel adds for today and never invokes permanent persistence', async () => {
    const h = harness({ confirm: false });
    await h.context.selectExerciseToAdd('Chin Up');
    assert.equal(h.cards.length, 1);
    assert.equal(h.modal.style.display, 'none');
    assert.deepEqual(h.events, ['confirm', 'insert']);
    assert.deepEqual(h.alerts, []);
});

test('normal addition retains the real Chin Up preview, notes, history prefill and permanent save', async () => {
    const h = harness();
    h.context.window.exerciseNotesCache = { 'Chin Up': 'Control the descent' };
    h.context.window.coachNotesCache = { 'Chin Up': 'Keep shoulders set' };
    h.context.window.workoutHistoryCache = [{ exercise: 'Chin Up', date: '2026-10-25', set: 1, kg: '5', reps: '8' }];
    await h.context.selectExerciseToAdd('Chin Up');
    assert.match(h.cards[0].html, /<video/);
    assert.match(h.cards[0].html, /workout-rest-period">90s</);
    assert.match(h.cards[0].html, /Control the descent/);
    assert.match(h.cards[0].html, /Keep shoulders set/);
    assert.match(h.cards[0].html, /value="5"/);
    assert.deepEqual(h.events, ['confirm', 'insert', 'save']);
    assert.deepEqual(h.alerts, []);
});

test('missing sign-in or workout key explains that the addition is today-only', async () => {
    const h = harness();
    h.context.window.currentWorkoutKey = null;
    await h.context.selectExerciseToAdd('Chin Up');
    assert.equal(h.cards.length, 1);
    assert.equal(h.events.includes('save'), false);
    assert.match(h.alerts[0], /added for today/);
});

for (const name of ['findVideoMatch', 'isCustomExerciseVideoUploading', 'createExerciseVideoBlockHtml']) {
    for (const mode of ['missing', 'throws']) {
        test(`${name} ${mode} cannot prevent local addition`, async () => {
            const h = harness();
            h.context[name] = mode === 'missing' ? undefined : () => { throw Error('optional helper failed'); };
            await h.context.selectExerciseToAdd('Chin Up');
            assert.equal(h.cards.length, 1);
            assert.equal(h.modal.style.display, 'none');
            assert.deepEqual(h.alerts, []);
        });
    }
}

for (const cache of [null, undefined, [], 'invalid', { 'Chin Up': { invalid: true } }]) {
    test(`invalid note caches (${JSON.stringify(cache)}) cannot prevent local addition`, async () => {
        const h = harness();
        h.context.window.exerciseNotesCache = cache;
        h.context.window.coachNotesCache = cache;
        await h.context.selectExerciseToAdd('Chin Up');
        assert.equal(h.cards.length, 1);
        assert.equal(h.modal.style.display, 'none');
        assert.deepEqual(h.alerts, []);
    });
}

test('optional notes, focus and tracking exceptions do not strand an inserted exercise', async () => {
    const h = harness({ focusThrows: true, volumeThrows: true });
    h.context.getExerciseNotesHtml = () => { throw Error('notes failed'); };
    await h.context.selectExerciseToAdd('Chin Up');
    assert.equal(h.cards.length, 1);
    assert.equal(h.modal.style.display, 'none');
    assert.deepEqual(h.alerts, []);
});

test('offline permanent-save failure retains the local card and explains today-only state', async () => {
    const h = harness({ save: async () => { throw Error('offline'); } });
    await h.context.selectExerciseToAdd('Chin Up');
    assert.equal(h.cards.length, 1);
    assert.equal(h.modal.style.display, 'none');
    assert.match(h.alerts[0], /added for today.*could not be saved for future workouts/);
    await h.context.selectExerciseToAdd('Chin Up');
    assert.equal(h.cards.length, 1);
    assert.equal(h.events.filter(e => e === 'save').length, 1);
});

test('required insertion failure is visible, leaves picker open, never saves, and releases tap guard', async () => {
    const h = harness({ missingList: true });
    await h.context.selectExerciseToAdd('Chin Up');
    assert.equal(h.cards.length, 0);
    assert.equal(h.modal.style.display, 'block');
    assert.match(h.alerts[0], /Could not add this exercise/);
    assert.equal(h.events.includes('save'), false);
    assert.equal(h.context.window._addingWorkoutExercises.size, 0);
});
