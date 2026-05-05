const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY_ALIASES = [
    ['Mon', /\bmon(?:day)?s?\b/g],
    ['Tue', /\btue(?:s|sday|sdays)?\b|\btuesday?s?\b/g],
    ['Wed', /\bwed(?:nesday)?s?\b/g],
    ['Thu', /\bthu(?:r|rs|rsday|rsdays)?\b|\bthursday?s?\b/g],
    ['Fri', /\bfri(?:day)?s?\b/g],
    ['Sat', /\bsat(?:urday)?s?\b/g],
    ['Sun', /\bsun(?:day)?s?\b/g],
];

function normalizeDay(value) {
    const text = String(value || '').toLowerCase();
    for (const [day, re] of DAY_ALIASES) {
        re.lastIndex = 0;
        if (re.test(text)) return day;
    }
    return '';
}

function dayIndex(day) {
    return DAY_ORDER.indexOf(day);
}

function dayPatternSource() {
    return '(?:mon(?:day)?s?|tue(?:s|sday|sdays)?|tuesday?s?|wed(?:nesday)?s?|thu(?:r|rs|rsday|rsdays)?|thursday?s?|fri(?:day)?s?|sat(?:urday)?s?|sun(?:day)?s?)';
}

function uniqueDays(days) {
    const seen = new Set();
    const out = [];
    days.forEach(day => {
        const normalized = normalizeDay(day);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        out.push(normalized);
    });
    return out;
}

function extractDayMentions(text) {
    const out = [];
    for (const [day, re] of DAY_ALIASES) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(text)) !== null) {
            out.push({ day, index: match.index, raw: match[0] });
        }
    }
    return out.sort((a, b) => a.index - b.index);
}

function makeActionId(payload) {
    const bits = [
        'move_workout_days',
        payload.mode || '',
        payload.source_day || '',
        ...(payload.target_days || []),
    ].filter(Boolean);
    return bits.join('_').toLowerCase();
}

function describeMoveWorkoutAction(payload) {
    if (payload.mode === 'move_day' && payload.source_day && payload.target_days?.[0]) {
        return `Move ${payload.source_day} workout to ${payload.target_days[0]}`;
    }
    if (payload.target_days?.length) {
        return `Move workout days to ${payload.target_days.join('/')}`;
    }
    return 'Move workout days';
}

function cleanInstruction(text, max = 520) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
}

function slugPart(value, max = 28) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, max);
}

function shortHash(value) {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36).slice(0, 7);
}

function titleCaseExercise(value) {
    const keepLower = new Set(['and', 'of', 'to', 'with', 'the', 'a', 'an']);
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map((word, index) => {
            const lower = word.toLowerCase();
            if (index > 0 && keepLower.has(lower)) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

function makeGenericActionId(type, payload) {
    const bits = [
        type,
        payload.operation || payload.mode || '',
        payload.day || '',
        slugPart(payload.exercise_name || payload.exercises?.[0]?.name || payload.replacement_exercise?.name || ''),
        shortHash(payload.instruction || JSON.stringify(payload)),
    ].filter(Boolean);
    return bits.join('_').toLowerCase();
}

function parseSetsReps(text) {
    const source = String(text || '');
    let match = source.match(/\b(\d+)\s*x\s*([0-9]+(?:\s*[-\u2013]\s*[0-9]+)?(?:\s*(?:each|sec|secs|seconds|min|mins|reps?))?)\b/i);
    if (!match) {
        match = source.match(/\b(\d+)\s*sets?\s*(?:of\s*)?([0-9]+(?:\s*[-\u2013]\s*[0-9]+)?(?:\s*(?:each|sec|secs|seconds|min|mins|reps?))?)?\b/i);
    }
    if (!match) return {};
    const sets = Number(match[1]);
    const reps = String(match[2] || '').trim();
    return {
        ...(Number.isFinite(sets) && sets > 0 ? { sets } : {}),
        ...(reps ? { reps: reps.replace(/\s+/g, ' ') } : {}),
    };
}

function extractTargetSelector(text) {
    const source = String(text || '');
    const dayMention = extractDayMentions(source.toLowerCase())[0];
    const day = dayMention?.day || '';
    const targetMatch = source.match(/\b(?:to|into|in|on|for|from)\s+(?:the\s+)?(.{2,90}?)(?:[.!?]|$)/i);
    let workoutHint = '';
    if (targetMatch) {
        workoutHint = targetMatch[1]
            .replace(new RegExp(dayPatternSource(), 'ig'), ' ')
            .replace(/\b(?:workout|session|day|program|plan|please|pls|thanks|thank you)\b/ig, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (parseSetsReps(workoutHint).sets || /^\d/.test(workoutHint)) workoutHint = '';
    }
    return { day, workout_hint: cleanInstruction(workoutHint, 80) };
}

function splitExerciseNames(segment) {
    let cleaned = String(segment || '')
        .replace(/\b(?:some|a|an|the|exercise|exercises|movement|movements)\b/ig, ' ')
        .replace(/\b\d+\s*(?:sets?\s*(?:of)?|x)\s*/ig, ' ')
        .replace(/\b(?:please|pls|thanks|thank you|for me|if possible)\b/ig, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    cleaned = cleaned.replace(/\s+(?:to|into|onto|in|on|for|from)\s+.+$/i, '').trim();
    return cleaned
        .split(/\s*,\s*|\s+\+\s+|\s+and\s+/i)
        .map(name => name.replace(/^[^\w]+|[^\w\s\-'/]+$/g, '').trim())
        .filter(name => name.length >= 3 && name.length <= 70)
        .slice(0, 6)
        .map(name => titleCaseExercise(name));
}

function normalizeExerciseSpec(name, text = '') {
    const setsReps = parseSetsReps(`${name} ${text}`);
    return {
        name: titleCaseExercise(name),
        sets: setsReps.sets || 3,
        reps: setsReps.reps || '10-12',
        desc: 'Coach-added exercise',
    };
}

function hasProgramRegenerationIntent(text) {
    const normalized = String(text || '').toLowerCase();
    const hasProgramContext = /\b(program|programme|plan|routine|training plan|workout plan|workout schedule|weekly schedule)\b/.test(normalized);
    if (!hasProgramContext) return false;
    if (/\b(move|switch|swap|shift|reschedule)\b/.test(normalized)) return false;
    return /\b(regenerate|redo|rebuild|rewrite|revamp|refresh|start over|new program|new plan|fresh program|fresh plan|build me|make me|create me|change my program|update my program|change the program|update the program)\b/.test(normalized);
}

function detectRegenerateWorkoutProgramActionFromText(text) {
    const instruction = cleanInstruction(text);
    if (!instruction || !hasProgramRegenerationIntent(instruction)) return null;
    const targetDays = uniqueDays(extractDayMentions(instruction.toLowerCase()).map(m => m.day));
    const payload = {
        instruction,
        ...(targetDays.length ? { target_days: targetDays } : {}),
    };
    return {
        id: makeGenericActionId('regenerate_workout_program', payload),
        type: 'regenerate_workout_program',
        status: 'pending',
        source: 'dm_intent_detector',
        label: targetDays.length
            ? `Regenerate program for ${targetDays.join('/')}`
            : 'Regenerate workout program',
        payload,
    };
}

function detectExerciseEditActionFromText(text) {
    const instruction = cleanInstruction(text);
    if (!instruction) return null;
    const normalized = instruction.toLowerCase();
    const hasWorkoutContext = /\b(workout|session|program|plan|exercise|exercises|sets?|reps?|leg day|upper|lower|push|pull|glute|arms|back|chest|shoulders?)\b/.test(normalized);
    if (!hasWorkoutContext) return null;

    let payload = null;
    const selector = extractTargetSelector(instruction);

    const addMatch = instruction.match(/\b(?:add|include|put|throw in|pop in)\s+(.{3,140}?)(?:\s+(?:to|into|onto|in|on|for)\s+.{2,90})?(?:[.!?]|$)/i);
    if (addMatch) {
        const exercises = splitExerciseNames(addMatch[1]).map(name => normalizeExerciseSpec(name, instruction));
        if (exercises.length) {
            payload = {
                operation: 'add',
                ...selector,
                exercises,
                instruction,
            };
        }
    }

    if (!payload) {
        const replaceMatch = instruction.match(/\b(?:replace|swap|change)\s+(.{3,80}?)\s+(?:with|for)\s+(.{3,100}?)(?:\s+(?:in|on|from|for)\s+.{2,90})?(?:[.!?]|$)/i);
        if (replaceMatch && !/\b(program|plan|routine|schedule)\b/i.test(replaceMatch[1])) {
            payload = {
                operation: 'replace',
                ...selector,
                exercise_name: titleCaseExercise(replaceMatch[1]),
                replacement_exercise: normalizeExerciseSpec(replaceMatch[2], instruction),
                instruction,
            };
        }
    }

    if (!payload) {
        const removeMatch = instruction.match(/\b(?:remove|take out|drop)\s+(.{3,100}?)(?:\s+(?:from|in|on)\s+.{2,90})?(?:[.!?]|$)/i);
        if (removeMatch) {
            const exerciseName = splitExerciseNames(removeMatch[1])[0] || titleCaseExercise(removeMatch[1]);
            payload = {
                operation: 'remove',
                ...selector,
                exercise_name: exerciseName,
                instruction,
            };
        }
    }

    if (!payload) {
        const updateMatch = instruction.match(/\b(?:make|change|set|update)\s+(.{3,90}?)\s+(?:to|as)\s+(.{0,80}?\b(?:\d+\s*x\s*\d+|\d+\s*sets?|sets?)\b.{0,50})(?:[.!?]|$)/i);
        if (updateMatch && !/\b(program|plan|routine|schedule)\b/i.test(updateMatch[1])) {
            const setsReps = parseSetsReps(updateMatch[2]);
            if (setsReps.sets || setsReps.reps) {
                payload = {
                    operation: 'update',
                    ...selector,
                    exercise_name: titleCaseExercise(updateMatch[1]),
                    ...setsReps,
                    instruction,
                };
            }
        }
    }

    if (!payload) return null;
    const labelBits = {
        add: `Add ${payload.exercises?.map(ex => ex.name).join(', ') || 'exercise'}`,
        remove: `Remove ${payload.exercise_name || 'exercise'}`,
        replace: `Replace ${payload.exercise_name || 'exercise'}`,
        update: `Change ${payload.exercise_name || 'exercise'} sets/reps`,
    };
    const target = payload.day ? ` in ${payload.day}` : (payload.workout_hint ? ` in ${payload.workout_hint}` : '');
    return {
        id: makeGenericActionId('edit_workout_exercises', payload),
        type: 'edit_workout_exercises',
        status: 'pending',
        source: 'dm_intent_detector',
        label: `${labelBits[payload.operation] || 'Edit workout'}${target}`,
        payload,
    };
}

function detectMoveWorkoutActionFromText(text) {
    const original = String(text || '');
    const normalized = original.toLowerCase().replace(/[\u2019']/g, "'");
    if (!normalized.trim()) return null;
    const hasWorkoutContext = /\b(workout|workouts|program|schedule|strength|training|session|sessions|calendar)\b/.test(normalized);
    if (!/\b(move|switch|swap|shift|change|reschedule|put|set|make|choose|chose)\b/.test(normalized)) return null;

    const dayPattern = dayPatternSource();
    const sourceTarget = new RegExp(`\\b(?:move|switch|swap|shift|change|reschedule)\\b.{0,45}?\\b(${dayPattern})\\b.{0,30}?\\b(?:to|onto|for)\\b.{0,20}?\\b(${dayPattern})\\b`, 'i');
    const sourceMatch = normalized.match(sourceTarget);
    if (sourceMatch) {
        const source = normalizeDay(sourceMatch[1]);
        const target = normalizeDay(sourceMatch[2]);
        if (source && target && source !== target) {
            const payload = { mode: 'move_day', source_day: source, target_days: [target] };
            return {
                id: makeActionId(payload),
                type: 'move_workout_days',
                status: 'pending',
                source: 'dm_intent_detector',
                label: describeMoveWorkoutAction(payload),
                payload,
            };
        }
    }
    if (!hasWorkoutContext) return null;

    let targetDays = [];
    const actionTo = new RegExp('\\b(?:move|switch|swap|shift|change|reschedule|put|set|make)\\b.{0,60}?\\b(?:to|onto|for)\\b', 'ig');
    let actionMatch;
    while ((actionMatch = actionTo.exec(normalized)) !== null) {
        const afterTo = normalized
            .slice(actionMatch.index + actionMatch[0].length)
            .split(/[.!?;]/)[0]
            .slice(0, 80);
        const daysAfterAction = uniqueDays(extractDayMentions(afterTo).map(m => m.day));
        if (daysAfterAction.length) {
            targetDays = daysAfterAction;
            break;
        }
    }
    const allDays = uniqueDays(extractDayMentions(normalized).map(m => m.day));
    const days = targetDays.length >= 1 ? targetDays : allDays;
    if (days.length === 0) return null;
    if (days.length === 1 && !/\b(move|switch|swap|shift|change|reschedule)\b/.test(normalized)) return null;

    const payload = { mode: days.length >= 2 ? 'target_strength_days' : 'target_workout_day', target_days: days.slice(0, 3) };
    return {
        id: makeActionId(payload),
        type: 'move_workout_days',
        status: 'pending',
        source: 'dm_intent_detector',
        label: describeMoveWorkoutAction(payload),
        payload,
    };
}

function detectProposedCoachActions({ messageText, recentInboundMessages = [] } = {}) {
    const texts = [
        ...(Array.isArray(recentInboundMessages) ? recentInboundMessages.map(m => m?.text || '') : []),
        messageText || '',
    ].filter(Boolean);
    const actions = [];
    texts.forEach(text => {
        const moveAction = detectMoveWorkoutActionFromText(text);
        const exerciseAction = detectExerciseEditActionFromText(text);
        const regenerateAction = (!moveAction && !exerciseAction)
            ? detectRegenerateWorkoutProgramActionFromText(text)
            : null;
        [moveAction, exerciseAction, regenerateAction].forEach(action => {
            if (action && !actions.some(a => a.id === action.id)) actions.push(action);
        });
    });
    const now = new Date().toISOString();
    return actions.map(action => ({ ...action, created_at: now }));
}

function mergeProposedActions(existing, incoming) {
    const out = Array.isArray(existing) ? existing.filter(Boolean) : [];
    (Array.isArray(incoming) ? incoming : []).forEach(action => {
        if (!action?.id || out.some(existingAction => existingAction?.id === action.id)) return;
        out.push(action);
    });
    return out.slice(-10);
}

function restWorkout() {
    return { name: 'Rest Day', type: 'rest' };
}

function cloneSchedule(schedule) {
    return (Array.isArray(schedule) ? schedule : []).map(item => ({
        ...item,
        workout: item?.workout && typeof item.workout === 'object'
            ? {
                ...item.workout,
                exercises: Array.isArray(item.workout.exercises)
                    ? item.workout.exercises.map(ex => ({ ...ex }))
                    : item.workout.exercises,
            }
            : item?.workout,
    }));
}

function isRestWorkout(workout) {
    if (!workout) return true;
    const type = String(workout.type || '').toLowerCase();
    const name = String(workout.name || '').toLowerCase();
    return type === 'rest' || name === 'rest day' || name === 'rest';
}

function isStrengthWorkout(workout) {
    if (!workout || isRestWorkout(workout)) return false;
    const text = [workout.name, workout.category, workout.subcategory, workout.type, workout.programName]
        .map(v => String(v || '').toLowerCase())
        .join(' ');
    if (/\b(recovery|reset|yoga|stretch|mobility|walk|cardio)\b/.test(text)) return false;
    return /\b(strength|weights?|dumbbell|barbell|glute|upper|lower|squat|hinge|push|pull|bench|row|home_weights|gym)\b/.test(text);
}

function getScheduleDay(schedule, day) {
    return schedule.find(item => item?.day === day);
}

function summarizeSchedule(schedule) {
    return DAY_ORDER.map(day => {
        const item = getScheduleDay(schedule, day);
        return `${day}: ${item?.workout?.name || 'Rest Day'}`;
    });
}

function applyMoveWorkoutDaysToSchedule(scheduleInput, payload) {
    const schedule = cloneSchedule(scheduleInput);
    DAY_ORDER.forEach(day => {
        if (!getScheduleDay(schedule, day)) schedule.push({ day, workout: restWorkout() });
    });
    schedule.sort((a, b) => dayIndex(a.day) - dayIndex(b.day));

    const before = summarizeSchedule(schedule);
    const targetDays = uniqueDays(payload?.target_days || []);
    if (!targetDays.length) throw new Error('No target days provided');

    if (payload.mode === 'move_day') {
        const sourceDay = normalizeDay(payload.source_day);
        const targetDay = targetDays[0];
        if (!sourceDay || !targetDay) throw new Error('Missing source or target day');
        const source = getScheduleDay(schedule, sourceDay);
        const target = getScheduleDay(schedule, targetDay);
        if (!source || !target || isRestWorkout(source.workout)) throw new Error(`${sourceDay} has no workout to move`);
        const targetHadWorkout = !isRestWorkout(target.workout);
        const movedWorkout = source.workout;
        source.workout = targetHadWorkout ? target.workout : restWorkout();
        target.workout = movedWorkout;
        const after = summarizeSchedule(schedule);
        return {
            schedule,
            before,
            after,
            summary: targetHadWorkout
                ? `Moved ${sourceDay} workout to ${targetDay} and swapped the existing ${targetDay} workout back to ${sourceDay}.`
                : `Moved ${sourceDay} workout to ${targetDay}. ${sourceDay} is now a rest day.`,
        };
    }

    const strengthDays = schedule
        .filter(item => isStrengthWorkout(item.workout))
        .sort((a, b) => dayIndex(a.day) - dayIndex(b.day));
    const sourceItems = strengthDays.length ? strengthDays : schedule.filter(item => !isRestWorkout(item.workout));
    if (!sourceItems.length) throw new Error('No movable workouts found in the active program');
    const selected = sourceItems.slice(0, targetDays.length);
    if (selected.length < targetDays.length) throw new Error(`Only found ${selected.length} movable workout(s) for ${targetDays.length} target day(s)`);

    const moved = selected.map(item => ({ from: item.day, workout: item.workout }));
    selected.forEach(item => { item.workout = restWorkout(); });
    targetDays.forEach((day, index) => {
        const target = getScheduleDay(schedule, day);
        target.workout = moved[index].workout;
    });
    const after = summarizeSchedule(schedule);
    return {
        schedule,
        before,
        after,
        summary: `Moved ${moved.map(m => m.from).join('/')} workout days to ${targetDays.join('/')}.`,
    };
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map(word => word.length > 3 ? word.replace(/s$/, '') : word)
        .join(' ');
}

function exerciseNamesMatch(actual, requested) {
    const a = normalizeSearchText(actual);
    const b = normalizeSearchText(requested);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a.replace(/s$/, ''));
}

function summarizeExercises(workout) {
    const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
    return exercises.map(ex => {
        const sets = ex.sets ? `${ex.sets}x` : '';
        const reps = ex.reps || '';
        return `${ex.name || 'Exercise'}${sets || reps ? ` (${sets}${reps})` : ''}`;
    });
}

function findExerciseIndex(exercises, exerciseName) {
    return exercises.findIndex(ex => exerciseNamesMatch(ex?.name, exerciseName));
}

function normalizeExerciseForWorkout(exercise) {
    const source = exercise && typeof exercise === 'object' ? exercise : { name: exercise };
    const sets = Number(source.sets);
    return {
        name: titleCaseExercise(source.name || 'Exercise'),
        sets: Number.isFinite(sets) && sets > 0 ? Math.min(sets, 8) : 3,
        reps: String(source.reps || '10-12').replace(/\s+/g, ' ').trim(),
        desc: cleanInstruction(source.desc || source.description || 'Coach-added exercise', 120),
    };
}

function findScheduleItemForExerciseEdit(schedule, payload = {}) {
    const day = normalizeDay(payload.day);
    if (day) {
        const item = getScheduleDay(schedule, day);
        if (!item) throw new Error(`No ${day} entry found in the active program`);
        return item;
    }

    const hint = normalizeSearchText(payload.workout_hint || payload.workout_name || '');
    if (hint) {
        const match = schedule.find(item => {
            if (isRestWorkout(item?.workout)) return false;
            const haystack = normalizeSearchText([
                item.day,
                item.workout?.name,
                item.workout?.category,
                item.workout?.subcategory,
                item.workout?.type,
            ].filter(Boolean).join(' '));
            return haystack.includes(hint) || hint.includes(haystack);
        });
        if (match) return match;
    }

    const workoutItems = schedule.filter(item => !isRestWorkout(item?.workout));
    if (workoutItems.length === 1) return workoutItems[0];
    throw new Error('Need a specific day or workout name for this exercise edit');
}

function applyExerciseEditToWorkout(workoutInput, payload = {}) {
    if (!workoutInput || isRestWorkout(workoutInput)) throw new Error('Cannot edit exercises on a rest day');
    const workout = {
        ...workoutInput,
        type: 'inline',
        exercises: Array.isArray(workoutInput.exercises)
            ? workoutInput.exercises.map(ex => ({ ...ex }))
            : [],
    };
    if (!workout.exercises.length && Array.isArray(payload.base_exercises)) {
        workout.exercises = payload.base_exercises.map(ex => ({ ...ex }));
    }
    if (!workout.exercises.length && payload.operation !== 'add') {
        throw new Error(`${workout.name || 'This workout'} has no exercise list to edit`);
    }

    const before = summarizeExercises(workout);
    const op = payload.operation;
    if (op === 'add') {
        const incoming = (Array.isArray(payload.exercises) ? payload.exercises : [])
            .map(normalizeExerciseForWorkout)
            .filter(ex => ex.name);
        if (!incoming.length) throw new Error('No exercise supplied to add');
        incoming.forEach(ex => {
            const exists = findExerciseIndex(workout.exercises, ex.name) !== -1;
            if (!exists) workout.exercises.push(ex);
        });
    } else if (op === 'remove') {
        const index = findExerciseIndex(workout.exercises, payload.exercise_name);
        if (index === -1) throw new Error(`Could not find ${payload.exercise_name || 'that exercise'} in ${workout.name || 'workout'}`);
        workout.exercises.splice(index, 1);
    } else if (op === 'replace') {
        const index = findExerciseIndex(workout.exercises, payload.exercise_name);
        if (index === -1) throw new Error(`Could not find ${payload.exercise_name || 'that exercise'} in ${workout.name || 'workout'}`);
        const current = workout.exercises[index] || {};
        workout.exercises[index] = {
            ...current,
            ...normalizeExerciseForWorkout({
                ...payload.replacement_exercise,
                sets: payload.replacement_exercise?.sets || current.sets,
                reps: payload.replacement_exercise?.reps || current.reps,
            }),
        };
    } else if (op === 'update') {
        const index = findExerciseIndex(workout.exercises, payload.exercise_name);
        if (index === -1) throw new Error(`Could not find ${payload.exercise_name || 'that exercise'} in ${workout.name || 'workout'}`);
        const current = workout.exercises[index] || {};
        workout.exercises[index] = {
            ...current,
            ...(payload.sets ? { sets: Math.min(Number(payload.sets), 8) } : {}),
            ...(payload.reps ? { reps: String(payload.reps).replace(/\s+/g, ' ').trim() } : {}),
        };
    } else {
        throw new Error(`Unsupported exercise edit operation: ${op || 'missing'}`);
    }

    const after = summarizeExercises(workout);
    return {
        workout,
        before,
        after,
        summary: describeExerciseEditSummary(payload, workout),
    };
}

function describeExerciseEditSummary(payload, workout) {
    const workoutName = workout?.name || 'workout';
    if (payload.operation === 'add') {
        return `Added ${(payload.exercises || []).map(ex => ex.name).join(', ')} to ${workoutName}.`;
    }
    if (payload.operation === 'remove') {
        return `Removed ${payload.exercise_name} from ${workoutName}.`;
    }
    if (payload.operation === 'replace') {
        return `Replaced ${payload.exercise_name} with ${payload.replacement_exercise?.name || 'the new exercise'} in ${workoutName}.`;
    }
    if (payload.operation === 'update') {
        const details = [payload.sets ? `${payload.sets} sets` : '', payload.reps ? `${payload.reps} reps` : ''].filter(Boolean).join(', ');
        return `Updated ${payload.exercise_name} in ${workoutName}${details ? ` to ${details}` : ''}.`;
    }
    return `Updated ${workoutName}.`;
}

function applyExerciseEditToSchedule(scheduleInput, payload = {}, options = {}) {
    const schedule = cloneSchedule(scheduleInput);
    DAY_ORDER.forEach(day => {
        if (!getScheduleDay(schedule, day)) schedule.push({ day, workout: restWorkout() });
    });
    schedule.sort((a, b) => dayIndex(a.day) - dayIndex(b.day));

    const before = summarizeSchedule(schedule);
    const item = findScheduleItemForExerciseEdit(schedule, payload);
    const shouldMaterialize = typeof options.materializeWorkout === 'function'
        && (!Array.isArray(item.workout?.exercises)
            || (!item.workout.exercises.length && payload.operation !== 'add'));
    if (shouldMaterialize) {
        item.workout = options.materializeWorkout(item, payload);
    }
    const edit = applyExerciseEditToWorkout(item.workout, payload);
    item.workout = edit.workout;
    const after = summarizeSchedule(schedule);
    return {
        schedule,
        before,
        after,
        exercise_before: edit.before,
        exercise_after: edit.after,
        summary: edit.summary,
    };
}

function normalizeGeneratedProgramSchedule(value) {
    const source = value && typeof value === 'object' ? value : {};
    const rawSchedule = source.weekly_schedule || source.weeklySchedule || source.schedule;
    if (!Array.isArray(rawSchedule)) throw new Error('Generated program did not include weekly_schedule');
    const byDay = new Map();
    rawSchedule.forEach((item, index) => {
        const day = normalizeDay(item?.day) || DAY_ORDER[index];
        if (!day) return;
        const rawWorkout = item?.workout || item;
        let workout;
        if (!rawWorkout || isRestWorkout(rawWorkout)) {
            workout = restWorkout();
        } else {
            const exercises = Array.isArray(rawWorkout.exercises)
                ? rawWorkout.exercises.slice(0, 10).map(normalizeExerciseForWorkout)
                : [];
            if (!exercises.length) throw new Error(`Generated ${day} workout has no exercises`);
            workout = {
                type: 'inline',
                name: cleanInstruction(rawWorkout.name || `${day} Workout`, 80),
                duration: cleanInstruction(rawWorkout.duration || '40 min', 30),
                difficulty: cleanInstruction(rawWorkout.difficulty || 'Intermediate', 30),
                category: cleanInstruction(rawWorkout.category || 'custom', 40),
                icon: cleanInstruction(rawWorkout.icon || '', 8),
                exercises,
            };
        }
        byDay.set(day, { day, workout });
    });
    const weeklySchedule = DAY_ORDER.map(day => byDay.get(day) || { day, workout: restWorkout() });
    return {
        program_name: cleanInstruction(source.program_name || source.programName || 'Refreshed Custom Program', 100),
        duration_weeks: Math.max(1, Math.min(Number(source.duration_weeks || source.durationWeeks || 6) || 6, 16)),
        weekly_schedule: weeklySchedule,
        notes: cleanInstruction(source.notes || source.coach_notes || '', 500),
    };
}

module.exports = {
    DAY_ORDER,
    detectProposedCoachActions,
    mergeProposedActions,
    describeMoveWorkoutAction,
    applyMoveWorkoutDaysToSchedule,
    applyExerciseEditToSchedule,
    applyExerciseEditToWorkout,
    normalizeGeneratedProgramSchedule,
    summarizeSchedule,
};
