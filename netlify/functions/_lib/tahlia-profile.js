const TAHLIA_PROFILE = {
    key: 'tahlia_brooks',
    displayName: 'Tahlia Brooks',
    age: 25,
    gender: 'female',
    pronouns: 'she/her',
    location: 'Gold Coast',
    role: 'Balance challenge member',
    trainingStyle: 'beginner-to-intermediate strength training, walks, simple gym sessions',
    foodStyle: 'mostly plant based in private, no food photo posting',
    portfolio: {
        trainingLevel: 'beginner-to-intermediate',
        estimatedHeightCm: 164,
        estimatedWeightKg: 64,
        calorieTargetRange: '1850-2250 kcal/day',
        proteinTargetRange: '85-110 g/day',
        strengthProfile: 'modest machine and cable PBs, not advanced-lifter numbers',
    },
    goals: [
        'feel stronger and more consistent',
        'build confidence around training',
        'treat weigh-ins as data, not drama',
    ],
    voice: {
        tone: 'warm, casual, slightly self-aware, supportive',
        casing: 'normal phone casing, occasional lowercase sentence starts are okay',
        length: 'one to two short sentences',
        uses: ['haha', 'solid', 'love this', 'amazing', 'good job'],
        avoids: [
            'coach-like advice',
            'medical claims',
            'big motivational speeches',
            'overly polished captions',
            'mentions of AI, bots, automation, seeded accounts, or testing',
        ],
    },
    boundaries: [
        'Never pretend to have seen media details that are not in the post text or type.',
        'Do not give medical, injury, weight-loss, or diet advice.',
        'Support people without correcting them.',
        'Do not use private Shannon/admin context in public feed copy.',
    ],
};

const POST_TEMPLATES = {
    workout: [
        'workout done. feel good now',
        'got my session finished today',
        'workout ticked off',
        'kept it simple and got it done',
    ],
    personal_best: [
        'pb today. feels good',
        'added a little more today',
        'personal best today. nice',
        'stronger than last time',
    ],
    weigh_in: [
        'weigh in done. reminding myself the number is just data, not the whole story',
        'checked in with weight today and staying calm about it. trend over panic',
        'weigh in ticked off. not making it dramatic, just keeping track',
        'scale check done. taking it as information and moving on with the day',
    ],
    fitness_diary: [
        'fitness diary done. energy was a bit up and down but i still did the basics',
        'little check in for future me: sleep matters way more than i pretend it does',
        'logged the day. not perfect, but there were still good choices in there',
        'quick diary note: consistency feels less scary when i keep it simple',
    ],
};

const WORKOUT_CARD_VARIANTS = [
    {
        workout_name: 'Upper Body',
        duration: '42 min',
        total_sets: 18,
        total_volume: '4,956 kg',
        exercises: [
            { name: 'Lat Pulldown', sets: 4, best: '4x10 @ 38 kg' },
            { name: 'Seated Chest Press', sets: 4, best: '4x10 @ 22 kg' },
            { name: 'Cable Row', sets: 4, best: '4x12 @ 31 kg' },
            { name: 'Shoulder Press', sets: 3, best: '3x10 @ 14 kg' },
            { name: 'Tricep Pushdown', sets: 3, best: '3x12 @ 18 kg' },
        ],
    },
    {
        workout_name: 'Lower Body',
        duration: '46 min',
        total_sets: 20,
        total_volume: '9,720 kg',
        exercises: [
            { name: 'Leg Press', sets: 4, best: '4x12 @ 74 kg' },
            { name: 'Romanian Deadlift', sets: 4, best: '4x10 @ 32 kg' },
            { name: 'Seated Leg Curl', sets: 4, best: '4x12 @ 27 kg' },
            { name: 'Hip Thrust', sets: 4, best: '4x10 @ 45 kg' },
            { name: 'Calf Raise', sets: 4, best: '4x14 @ 32 kg' },
        ],
    },
];

const PB_CARD_VARIANTS = [
    {
        exercise: 'Lat Pulldown',
        pb_type: 'weight',
        value: 42.5,
        reps: 8,
        improvement: 2.5,
        previous: 40,
    },
    {
        exercise: 'Leg Press',
        pb_type: 'weight',
        value: 80,
        reps: 10,
        improvement: 5,
        previous: 75,
    },
    {
        exercise: 'Seated Chest Press',
        pb_type: 'reps',
        value: 13,
        weight: 22,
        improvement: 1,
        previous: 12,
    },
];

const FITNESS_DIARY_CARD_VARIANTS = [
    {
        day_rating: 'steady',
        energy_level: 'medium',
        goals: 'keep training simple and stay consistent',
        highlight: 'got movement in even though the day was busy',
        struggle: 'nearly talked myself out of it after work',
    },
    {
        day_rating: 'pretty good',
        energy_level: 'okay',
        goals: 'keep showing up without overthinking everything',
        highlight: 'felt calmer after moving',
        struggle: 'sleep was not amazing',
    },
];

function brisbaneDateKeyFromSeed(seed) {
    const parsed = Date.parse(seed || '');
    if (Number.isFinite(parsed)) {
        return new Date(parsed + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }
    return new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function clonePicked(list, seed) {
    return JSON.parse(JSON.stringify(pick(list, seed)));
}

function tahliaPostMediaType(activityType) {
    if (activityType === 'workout' || activityType === 'personal_best') return 'workout_card';
    if (activityType === 'fitness_diary') return 'checkin_card';
    return 'text';
}

function buildTahliaPostCardPayload(activityType, caption, seed) {
    // These cards mirror the real share flow. Members can share the activity,
    // but do not add a separate freeform comment to workout or diary cards.
    if (activityType === 'workout') {
        return {
            card_type: 'workout',
            ...clonePicked(WORKOUT_CARD_VARIANTS, seed),
        };
    }
    if (activityType === 'personal_best') {
        return {
            card_type: 'pb',
            ...clonePicked(PB_CARD_VARIANTS, seed),
        };
    }
    if (activityType === 'fitness_diary') {
        return {
            card_type: 'fitness_diary',
            diary_date: brisbaneDateKeyFromSeed(seed),
            title: 'Fitness Diary',
            timestamp: new Date().toISOString(),
            ...clonePicked(FITNESS_DIARY_CARD_VARIANTS, seed),
        };
    }
    return null;
}

const COMMENT_TEMPLATES = {
    workout: [
        'this is solid',
        'love this!',
        'amazing work!',
    ],
    meal: [
        'love this!',
        'yum, amazing meal',
        'great job!',
    ],
    weigh_in: [
        'good job checking in',
        'this is solid',
        'nice work!',
    ],
    progress: [
        'amazing work!',
        'love seeing this',
        'this is so good!',
    ],
    default: [
        'amazing work!',
        'good job!',
        'this is solid',
        'love this!',
    ],
};

function hashString(value) {
    let hash = 2166136261;
    const s = String(value || '');
    for (let i = 0; i < s.length; i += 1) {
        hash ^= s.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function pick(list, seed) {
    const values = Array.isArray(list) && list.length ? list : [''];
    return values[hashString(seed) % values.length];
}

function cleanPublicText(value, max = 500) {
    return String(value || '')
        // Tahlia's casual Feed voice never uses AI-style dash punctuation.
        // Keep ordinary hyphenated words intact, but turn dash-as-a-pause
        // punctuation into a natural comma before this becomes public text.
        .replace(/\s*--+\s*/g, ', ')
        .replace(/\s*[\u2012-\u2015\uFE58\uFE63\uFF0D]+\s*/g, ', ')
        .replace(/\s-\s/g, ', ')
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, max);
}

function parseCardCaption(caption) {
    if (!caption || typeof caption !== 'string') return null;
    const trimmed = caption.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function formatWorkoutCardText(card = {}) {
    const exercises = Array.isArray(card.exercises) ? card.exercises : [];
    const exerciseText = exercises
        .slice(0, 4)
        .map(ex => [ex?.name, ex?.best].filter(Boolean).join(' '))
        .filter(Boolean)
        .join(', ');
    const stats = [
        card.total_sets ? `${card.total_sets} sets` : '',
        card.duration,
        card.total_volume ? `${card.total_volume} volume` : '',
    ].filter(Boolean).join(', ');
    return cleanPublicText([
        card.share_caption,
        card.workout_name,
        stats,
        exerciseText,
    ].filter(Boolean).join(' '), 500);
}

function storyTextFromCardData(parsed = {}) {
    const cardType = String(parsed.card_type || '').toLowerCase();
    if (cardType === 'workout') {
        return formatWorkoutCardText(parsed) || 'workout';
    }
    if (cardType === 'pb') {
        return cleanPublicText([
            parsed.exercise,
            parsed.pb_type,
            parsed.value,
            parsed.reps ? `${parsed.reps} reps` : '',
            parsed.weight ? `${parsed.weight} kg` : '',
        ].filter(Boolean).join(' '), 500);
    }
    return cleanPublicText([
        parsed.share_caption,
        parsed.caption,
        parsed.meal_name,
        parsed.title,
        parsed.card_type,
    ].filter(Boolean).join(' '), 500);
}

function storyText(story = {}) {
    const parsed = parseCardCaption(story.caption);
    if (parsed) {
        return storyTextFromCardData(parsed);
    }
    return cleanPublicText(story.caption, 500);
}

function inferStoryTheme(story = {}) {
    const mediaType = String(story.media_type || '').toLowerCase();
    const text = `${mediaType} ${storyText(story)}`.toLowerCase();

    if (/\b(meal|breakfast|lunch|dinner|snack|protein|calorie|calories|bowl|smoothie|tofu|tempeh|salad)\b/.test(text)) {
        return 'meal';
    }
    if (/\b(workout|session|gym|sets?|reps?|squat|deadlift|bench|run|walk|training|cardio)\b/.test(text)) {
        return 'workout';
    }
    if (/\b(weigh|weight|scale|check[- ]?in|checkin)\b/.test(text)) {
        return 'weigh_in';
    }
    if (/\b(progress|photo|streak|habit|win|diary|mood|energy)\b/.test(text)) {
        return 'progress';
    }
    return 'default';
}

function activityLabel(activityType) {
    return ({
        workout: 'workout',
        meal: 'meal',
        personal_best: 'PB',
        weigh_in: 'weigh-in',
        fitness_diary: 'fitness diary',
    })[activityType] || 'feed post';
}

function buildTahliaPostDraft({ activityType, seed }) {
    const type = POST_TEMPLATES[activityType] ? activityType : 'fitness_diary';
    const cardPayload = buildTahliaPostCardPayload(type, '', seed);
    const caption = cardPayload ? '' : cleanPublicText(pick(POST_TEMPLATES[type], seed), 500);
    return {
        activityType: type,
        label: activityLabel(type),
        caption,
        mediaType: tahliaPostMediaType(type),
        cardPayload,
        profile: TAHLIA_PROFILE,
    };
}

function buildTahliaCommentDraft({ story, seed }) {
    const theme = inferStoryTheme(story);
    const templates = COMMENT_TEMPLATES[theme] || COMMENT_TEMPLATES.default;
    return {
        theme,
        comment: cleanPublicText(pick(templates, seed), 500),
        profile: TAHLIA_PROFILE,
    };
}

module.exports = {
    TAHLIA_PROFILE,
    activityLabel,
    buildTahliaCommentDraft,
    buildTahliaPostCardPayload,
    buildTahliaPostDraft,
    cleanPublicText,
    inferStoryTheme,
    parseCardCaption,
    storyTextFromCardData,
    storyText,
    tahliaPostMediaType,
};
