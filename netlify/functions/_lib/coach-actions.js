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
        const action = detectMoveWorkoutActionFromText(text);
        if (action && !actions.some(a => a.id === action.id)) actions.push(action);
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
        workout: item?.workout && typeof item.workout === 'object' ? { ...item.workout } : item?.workout,
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

module.exports = {
    DAY_ORDER,
    detectProposedCoachActions,
    mergeProposedActions,
    describeMoveWorkoutAction,
    applyMoveWorkoutDaysToSchedule,
};
