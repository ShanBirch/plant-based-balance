const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const plans = require('../../../js/dashboard/pbb-onboarding-workout-plans');
const { resolveVideoBackedExercise } = require('./exercise-library-search');

// Build from the shipped library, never from invented exercise names.
function buildFreeCoachingProgram({ equipment, schedule, sessionMinutes, movementRestrictions }) {
    if (!['gym', 'dumbbells', 'bands', 'none'].includes(equipment)) throw Error('Confirm available equipment first.');
    if (!Array.isArray(schedule) || schedule.length < 1 || schedule.length > 6) throw Error('Agree one to six training days first.');
    if (new Set(schedule.map(slot => slot.weekday)).size !== schedule.length) throw Error('Use one session per agreed day.');
    if (!Number.isInteger(sessionMinutes) || sessionMinutes < 10 || sessionMinutes > 60) throw Error('Confirm a session length from 10 to 60 minutes.');
    if (movementRestrictions !== 'none_reported') throw Error('Movement restrictions need an individually reviewed program.');
    const context = {};
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../../workout_library.js'), 'utf8') + '\n' + fs.readFileSync(path.resolve(__dirname, '../../../workout_library_extended.js'), 'utf8') + '\nthis.library = {...WORKOUT_LIBRARY, ...WORKOUT_LIBRARY_EXTENDED};', context);
    const sequence = plans.getPlan(equipment, schedule.length === 1 ? 3 : schedule.length).sequence;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekly_schedule = schedule.map((slot, index) => {
        if (!Number.isInteger(slot.weekday) || slot.weekday < 1 || slot.weekday > 7 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.time)) throw Error('Confirm each weekday and local time.');
        const definition = plans.definitions[sequence[index % sequence.length]];
        const preferred = plans.getLibraryWorkout(sequence[index % sequence.length], context.library);
        const alternatives = context.library[definition.program]?.subcategories?.[definition.muscleGroup || definition.subcategory]?.workouts || [];
        const original = [preferred, ...alternatives].find(workout => workout?.exercises?.length >= 3
            && workout.exercises.every(exercise => resolveVideoBackedExercise(exercise.name)));
        if (!original) throw Error('No complete video-backed library session for this equipment; individual program review required.');
        const exercises = original.exercises.map(exercise => {
            const video = resolveVideoBackedExercise(exercise.name);
            return { ...exercise, name: video.name, video_url: video.videoUrl };
        });
        if (exercises.length < 3) throw Error('Not enough verified demos for this session; individual review required.');
        const workout = plans.fitWorkoutToMinutes({ ...original, exercises }, sessionMinutes);
        if (workout.exercises.length < 3) throw Error('The session length needs individual review to retain a balanced workout.');
        return { day: days[slot.weekday - 1], time: slot.time, workout: { ...workout, type: 'inline' } };
    });
    // Calendar renderers index Monday through Sunday. Missing rest rows would
    // shift a Tuesday session onto Monday even though its label says Tuesday.
    const fullWeek = days.map(day => weekly_schedule.find(entry => entry.day === day)
        || { day, workout: { type:'rest', name:'Rest Day', exercises:[] } });
    return { program_name: 'Your Balance coaching month', duration_weeks: 5, weekly_schedule:fullWeek };
}
function validateFreeCoachingProgram(program, input) {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    if (!Array.isArray(program?.weekly_schedule) || program.weekly_schedule.length !== 7
        || program.weekly_schedule.some((entry,index)=>entry.day !== days[index])) throw Error('Keep all seven calendar days in order.');
    program.weekly_schedule.forEach((entry,index)=>{
        const slot = input.schedule.find(slot=>slot.weekday === index+1);
        if (!slot) {
            if (entry.workout?.type !== 'rest' || entry.workout.exercises?.length) throw Error('Preserve agreed rest days.');
            return;
        }
        if (entry.time !== slot.time || entry.workout?.type !== 'inline' || !entry.workout.name || !Array.isArray(entry.workout.exercises)
            || entry.workout.exercises.length < 3) throw Error('A complete session must match each agreed day and time.');
        for (const ex of entry.workout.exercises) {
            const demo = resolveVideoBackedExercise(ex.name);
            if (!demo || ex.name !== demo.name || ex.video_url !== demo.videoUrl || !Number.isInteger(ex.sets)
                || ex.sets < 1 || ex.sets > 6 || !String(ex.reps || '').trim()) throw Error('Use exact canonical exercises, matching demos and complete prescriptions.');
        }
        if (plans.estimateSeconds(entry.workout.exercises) > input.sessionMinutes*60) throw Error('The session exceeds the agreed time estimate. Review the volume.');
    });
    return program;
}
module.exports = { buildFreeCoachingProgram, validateFreeCoachingProgram };
