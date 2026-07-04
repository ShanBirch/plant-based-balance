const TAHLIA_PROFILE = {
    key: 'tahlia_brooks',
    displayName: 'Tahlia Brooks',
    age: 25,
    gender: 'female',
    pronouns: 'she/her',
    location: 'Gold Coast',
    role: 'Balance challenge member',
    trainingStyle: 'beginner-to-intermediate strength training, walks, simple gym sessions',
    foodStyle: 'mostly plant based, practical meals, not preachy',
    goals: [
        'feel stronger and more consistent',
        'build confidence around training',
        'make simple meals instead of grazing',
        'treat weigh-ins as data, not drama',
    ],
    voice: {
        tone: 'warm, casual, slightly self-aware, supportive',
        casing: 'normal phone casing, occasional lowercase sentence starts are okay',
        length: 'one to two short sentences',
        uses: ['haha', 'solid', 'little win', 'showing up', 'counts'],
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
        'workout done. not the prettiest session but i showed up and that counts',
        'got my session finished today and feel so much better for moving',
        'workout ticked off. trying to be the girl who keeps promises to herself',
        'little gym win today. kept it simple and got through it',
    ],
    meal: [
        'made a proper meal instead of grazing. small win but it counts',
        'quick plant based bowl tonight, nothing fancy, just trying to keep it consistent',
        'meal sorted. future me is very grateful for past me making the effort',
        'actually cooked instead of winging it tonight, proud of that',
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

const COMMENT_TEMPLATES = {
    workout: [
        'this is solid, love seeing you get it done',
        'love this, showing up is the whole thing',
        'love this, getting it done counts',
    ],
    meal: [
        'love this, a proper meal win always counts',
        'yum, such a solid meal win',
        'love this, simple meals are underrated',
    ],
    weigh_in: [
        'love the check in, the consistency is the bit',
        'this is such a good little data point, nice work',
        'steady check ins are such a win',
    ],
    progress: [
        'this is so good, little wins stacking up',
        'love seeing this, the consistency shows',
        'such a good reminder that it all adds up',
    ],
    default: [
        'love this, little wins stacking up',
        'this is so good, nice work',
        'solid effort, love seeing it',
        'that is such a good little win',
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
        weigh_in: 'weigh-in',
        fitness_diary: 'fitness diary',
    })[activityType] || 'feed post';
}

function buildTahliaPostDraft({ activityType, seed }) {
    const type = POST_TEMPLATES[activityType] ? activityType : 'fitness_diary';
    return {
        activityType: type,
        label: activityLabel(type),
        caption: cleanPublicText(pick(POST_TEMPLATES[type], seed), 500),
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
    buildTahliaPostDraft,
    cleanPublicText,
    inferStoryTheme,
    parseCardCaption,
    storyTextFromCardData,
    storyText,
};
