const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const technique = require(path.join(root, 'js/dashboard/pbb-exercise-technique-data.js'));

const representativeExercises = {
    'Rest': 'non_exercise',
    'Foam Roller Calf': 'recovery',
    'Static Calf Stretch': 'mobility',
    'Single Leg Balance': 'balance',
    'Box Jump': 'power',
    'Farmer Carry': 'carry',
    'Pallof Press': 'core_rotation',
    'Dead Bug': 'core_bracing',
    'Neck Flexion': 'neck',
    'Romanian Deadlift': 'hinge',
    'Kettlebell Split Squat': 'single_leg',
    'Back Squat': 'squat',
    'Glute Bridge': 'hip_extension',
    'Machine Seated Hip Abduction': 'hip_abduction',
    'Machine Seated Hip Adduction': 'hip_adduction',
    'Standing Hip Flexion': 'hip_flexion',
    'Machine Seated Leg Curl': 'knee_flexion',
    'Machine Seated Leg Extension': 'knee_extension',
    'Standing Calf Raise': 'calf',
    'Machine Seated Reverse Fly': 'upper_back_rear',
    'Lat Pulldown': 'vertical_pull',
    'Dumbbell Incline Bench Row': 'horizontal_pull',
    'Cable External Rotation': 'shoulder_rotation',
    'Cable Standing High To Low Fly': 'chest_fly',
    'Dumbbell Bench Press': 'horizontal_press',
    'Dumbbell Shoulder Press': 'vertical_press',
    'Dumbbell Lateral Raise': 'shoulder_raise',
    'Wrist Curl': 'forearm',
    'Bicep Curl': 'biceps',
    'Dumbbell Overhead Tricep Extension': 'triceps',
    'Jog On The Spot': 'locomotion'
};

test('representative exercises receive movement-relevant cue families', () => {
    for (const [exerciseName, expectedKey] of Object.entries(representativeExercises)) {
        assert.equal(technique.classifyExercise(exerciseName), expectedKey, exerciseName);
    }
});

test('known ambiguous names do not regress into misleading families', () => {
    assert.equal(technique.classifyExercise('Lateral Bounds'), 'power');
    assert.equal(technique.classifyExercise('Toe Touch Progression Toes Up'), 'core_bracing');
    assert.equal(technique.classifyExercise('Cable Push Pull'), 'core_rotation');
    assert.equal(technique.classifyExercise('Left Right Up Kicks'), 'hip_flexion');
    assert.equal(technique.classifyExercise('Through Legs'), 'core_rotation');
    assert.equal(technique.classifyExercise('Band External Shoulder Rotation'), 'shoulder_rotation');
    assert.equal(technique.classifyExercise('Dumbbell Upright Row'), 'shoulder_raise');
    assert.equal(technique.classifyExercise('Dumbbell High Pull to Press'), 'power');
});

test('every catalog exercise receives a complete, audited cue set', () => {
    const source = fs.readFileSync(path.join(root, 'exercise_videos.js'), 'utf8');
    const catalog = vm.runInNewContext(`${source}\n;EXERCISE_VIDEOS;`);
    const names = Object.keys(catalog);
    const audit = technique.auditExerciseNames(names);

    assert.equal(names.length, 2528);
    assert.deepEqual(audit.invalid, []);
    assert.deepEqual(audit.suspicious, []);
    assert.ok(audit.fallback.length / audit.total <= 0.01);
    assert.equal(audit.fallback.length, 0);

    for (const exerciseName of names) {
        const data = technique.getExerciseTechniqueData(exerciseName);
        assert.equal(data.setup.length, 3, exerciseName);
        assert.equal(data.move.length, 3, exerciseName);
        assert.ok(data.reset, exerciseName);
    }
});

test('dashboard loads the cue engine before the workout implementation', () => {
    const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
    const cueIndex = html.indexOf('pbb-exercise-technique-data.js?v=1');
    const workoutIndex = html.indexOf('dashboard-script-5-initialize_stripe_for_inapp_pu.js?v=155');
    assert.ok(cueIndex >= 0);
    assert.ok(workoutIndex > cueIndex);

    const main = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
    assert.match(main, /PBBExerciseTechnique\?\.getExerciseTechniqueData/);
    assert.match(main, /if \(technique\.hidePanel\) return '';/);
});
