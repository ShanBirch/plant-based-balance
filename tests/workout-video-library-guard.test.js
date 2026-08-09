const assert = require('assert');

const {
    applyExerciseEditToWorkout,
    normalizeGeneratedProgramSchedule,
} = require('../netlify/functions/_lib/coach-actions');
const {
    hasUsableExerciseVideoUrl,
    loadVideoBackedExerciseCatalog,
    resolveVideoBackedExercise,
} = require('../netlify/functions/_lib/exercise-library-search');

const catalog = loadVideoBackedExerciseCatalog();
assert.ok(catalog.length > 1000, 'video-backed catalog should be available to the program builder');
assert.ok(catalog.every(row => row.name && hasUsableExerciseVideoUrl(row.videoUrl)));
assert.strictEqual(hasUsableExerciseVideoUrl('https://drive.google.com/file/d/demo'), false);
assert.strictEqual(hasUsableExerciseVideoUrl(''), false);
assert.strictEqual(hasUsableExerciseVideoUrl('/assets/exercise-videos/compat/glute-bridge.mp4'), true);
assert.strictEqual(resolveVideoBackedExercise('Glute Bridge').name, 'Glute Bridge');

const goblet = resolveVideoBackedExercise('dumbbell goblet squat');
assert.strictEqual(goblet.name, 'Dumbbell Goblet Squat');
assert.match(goblet.videoUrl, /\.mp4$/i);
assert.strictEqual(resolveVideoBackedExercise('Imaginary Moon Cable Squat'), null);

const generated = normalizeGeneratedProgramSchedule({
    program_name: 'Video-backed plan',
    weekly_schedule: [{
        day: 'Mon',
        workout: {
            name: 'Lower Strength',
            exercises: [{ name: 'dumbbell goblet squat', sets: 3, reps: '10' }],
        },
    }],
}, { resolveExercise: resolveVideoBackedExercise });

const generatedExercise = generated.weekly_schedule[0].workout.exercises[0];
assert.strictEqual(generatedExercise.name, 'Dumbbell Goblet Squat');
assert.strictEqual(generatedExercise.video_url, goblet.videoUrl);

assert.throws(
    () => normalizeGeneratedProgramSchedule({
        weekly_schedule: [{
            day: 'Mon',
            workout: {
                name: 'Made-up workout',
                exercises: [{ name: 'Imaginary Moon Cable Squat' }],
            },
        }],
    }, { resolveExercise: resolveVideoBackedExercise }),
    /No usable exercise video found/
);

const edited = applyExerciseEditToWorkout({
    name: 'Lower Strength',
    exercises: [{ name: 'Bodyweight Squat', sets: 3, reps: '12' }],
}, {
    operation: 'add',
    exercises: [{ name: 'dumbbell goblet squat', sets: 4, reps: '8' }],
}, { resolveExercise: resolveVideoBackedExercise });

assert.strictEqual(edited.workout.exercises[1].name, 'Dumbbell Goblet Squat');
assert.strictEqual(edited.workout.exercises[1].video_url, goblet.videoUrl);

assert.throws(
    () => applyExerciseEditToWorkout({
        name: 'Lower Strength',
        exercises: [{ name: 'Bodyweight Squat', sets: 3, reps: '12' }],
    }, {
        operation: 'replace',
        exercise_name: 'Bodyweight Squat',
        replacement_exercise: { name: 'Imaginary Moon Cable Squat' },
    }, { resolveExercise: resolveVideoBackedExercise }),
    /No usable exercise video found/
);

console.log('workout video library guard tests passed');