const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const plans = require(path.join(root, 'js/dashboard/pbb-onboarding-workout-plans.js'));
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const onboardingSource = fs.readFileSync(
    path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
    'utf8'
);
const foundationsCss = fs.readFileSync(path.join(root, 'css/dashboard/pbb-onboarding-foundations.css'), 'utf8');

function loadData(file, expression) {
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8') + `\nwindow.__result = ${expression};`, context);
    return context.window.__result;
}

const mainLibrary = loadData('workout_library.js', 'WORKOUT_LIBRARY');
const extendedLibrary = loadData('workout_library_extended.js', 'WORKOUT_LIBRARY_EXTENDED');
const exerciseVideos = loadData('exercise_videos.js', 'EXERCISE_VIDEOS');
const library = { ...mainLibrary, ...extendedLibrary };

function rawDefinition(workoutId) {
    const definition = plans.definitions[workoutId];
    assert.ok(definition, `Missing prebuilt definition for ${workoutId}`);
    return definition;
}

function libraryWorkout(workoutId) {
    const definition = rawDefinition(workoutId);
    const categoryKey = definition.program === 'gym' ? 'gym' : definition.program;
    const subcategoryKey = definition.muscleGroup || definition.subcategory;
    const workouts = library[categoryKey]?.subcategories?.[subcategoryKey]?.workouts;
    assert.ok(workouts, `Missing library path ${categoryKey}/${subcategoryKey} for ${workoutId}`);
    const workout = workouts[definition.libraryWorkoutIndex];
    assert.ok(workout, `Missing workout index ${definition.libraryWorkoutIndex} for ${workoutId}`);
    return workout;
}

test('every equipment and frequency choice maps to the requested number of prebuilt strength sessions', () => {
    for (const equipment of ['gym', 'dumbbells', 'bands', 'none']) {
        for (let frequency = 2; frequency <= 7; frequency++) {
            const plan = plans.getPlan(equipment, frequency);
            assert.equal(plan.sequence.length, frequency, `${equipment}/${frequency}`);
            assert.equal(new Set(plan.sequence).size, frequency, `${equipment}/${frequency} repeats a session id`);
            plan.sequence.forEach(workoutId => {
                assert.equal(rawDefinition(workoutId).equipment, equipment);
                assert.ok(libraryWorkout(workoutId).exercises.length > 0);
            });
        }
    }
});

test('onboarding preview names are the exact names later shown by the workout library', () => {
    for (const equipment of ['gym', 'dumbbells', 'bands', 'none']) {
        for (let frequency = 2; frequency <= 7; frequency++) {
            plans.getPlan(equipment, frequency).sequence.forEach(id => {
                assert.equal(plans.getLibraryWorkout(id, library)?.name, libraryWorkout(id).name, id);
            });
        }
    }
    assert.equal(plans.getLibraryWorkout('bands-upper-a', library).name, 'Band Upper 1 - Push Focus');
    assert.doesNotMatch(onboardingSource, /Prebuilt strength session/i);
    assert.match(onboardingSource, /getLibraryWorkout\(workout, window\.WORKOUT_LIBRARY\)/);
});

test('exercise preference chips stay readable and visibly selected on the cream card', () => {
    assert.match(onboardingSource, /classList\.toggle\('is-liked-selected'/);
    assert.match(onboardingSource, /classList\.toggle\('is-avoided-selected'/);
    assert.match(foundationsCss, /wizard-exercise-pref-chip \{[\s\S]*?background: #fffdf8 !important;[\s\S]*?color: #2d261d !important/);
    assert.match(foundationsCss, /wizard-exercise-pref-chip\.is-liked-selected \{[\s\S]*?background: #e8f5e9 !important/);
    assert.match(foundationsCss, /wizard-exercise-pref-chip\.is-avoided-selected \{[\s\S]*?background: #fff0ef !important/);
});

test('five days is a chest, back, legs, shoulders and arms split for every equipment choice', () => {
    for (const equipment of ['gym', 'dumbbells', 'bands', 'none']) {
        const labels = plans.getPlan(equipment, 5).sequence.map(id => plans.definitions[id].label);
        assert.deepEqual(labels, ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms']);
    }
});

test('seven days remains seven genuine strength days with second upper and lower stimuli', () => {
    for (const equipment of ['gym', 'dumbbells', 'bands', 'none']) {
        const plan = plans.getPlan(equipment, 7);
        const labels = plan.sequence.map(id => plans.definitions[id].label);
        assert.deepEqual(labels, ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Chest + Back', 'Legs II']);
        const built = plans.buildCalendar(equipment, 7,
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], true);
        assert.equal(Object.values(built.calendar).filter(id => id === 'rest' || id.startsWith('yoga-')).length, 0);
    }
});

test('two days builds upper and lower only on the member-selected days', () => {
    const built = plans.buildCalendar('bands', 2, ['monday', 'thursday'], false);
    assert.equal(plans.definitions[built.calendar.monday].label, 'Upper Body');
    assert.equal(plans.definitions[built.calendar.thursday].label, 'Lower Body');
    assert.equal(built.calendar.tuesday, 'rest');
    assert.equal(built.calendar.sunday, 'rest');
});

test('bands and mat-only plans never cross into dumbbell or gym exercise libraries', () => {
    for (let frequency = 2; frequency <= 7; frequency++) {
        plans.getPlan('bands', frequency).sequence.forEach(id => {
            const workout = libraryWorkout(id);
            assert.equal(rawDefinition(id).program, 'bands');
            assert.doesNotMatch(workout.exercises.map(exercise => exercise.name).join(' '), /dumbbell|barbell|machine|cable/i);
        });

        plans.getPlan('none', frequency).sequence.forEach(id => {
            const workout = libraryWorkout(id);
            assert.deepEqual(Array.from(workout.equipment), ['None']);
            assert.doesNotMatch(
                workout.exercises.map(exercise => exercise.name).join(' '),
                /dumbbell|barbell|band|machine|cable|pull up|chin up|dip|chair|table/i
            );
        });
    }
});

test('every exercise selected by onboarding has an exact canonical video entry', () => {
    const selectedIds = new Set();
    for (const equipment of ['gym', 'dumbbells', 'bands', 'none']) {
        for (let frequency = 2; frequency <= 7; frequency++) {
            plans.getPlan(equipment, frequency).sequence.forEach(id => selectedIds.add(id));
        }
    }

    selectedIds.forEach(id => {
        libraryWorkout(id).exercises.forEach(exercise => {
            const video = exerciseVideos[exercise.name] || '';
            assert.match(video, /^(?:https:\/\/|\/assets\/).+\.mp4(?:\?.*)?$/, `${id}: ${exercise.name}`);
            if (video.startsWith('/assets/')) {
                assert.ok(fs.existsSync(path.join(root, video.slice(1))), `${id}: missing local video ${video}`);
            }
        });
    });
});

test('the reduced onboarding loads the matrix first and includes workout preferences', () => {
    const matrixPosition = dashboard.indexOf('pbb-onboarding-workout-plans.js?v=2-library-display-names');
    const onboardingPosition = dashboard.indexOf('dashboard-script-5-initialize_stripe_for_inapp_pu.js?v=222-add-exercise-contrast');
    assert.ok(matrixPosition >= 0 && matrixPosition < onboardingPosition);
    assert.match(onboardingSource, /const skippedWizardSlides = \[2, 5, 8,/);
    assert.doesNotMatch(onboardingSource, /wizardTrainingFrequency >= 4 \? 'upper_lower'/);
    assert.match(onboardingSource, /PBBOnboardingWorkoutPlans\?\.buildCalendar/);
    assert.match(onboardingSource, /getEquipmentOptions\(equipment, wizardTrainingFrequency, window\.WORKOUT_LIBRARY\)/);
});
