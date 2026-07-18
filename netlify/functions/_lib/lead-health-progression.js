const HEALTH_PROGRESSION_EVENT_TYPES = Object.freeze({
    attempted: 'lead_health_progression_attempted',
    answered: 'lead_health_progression_answered',
    goal: 'lead_goal_identified',
    blocker: 'lead_blocker_identified',
    problemQualified: 'lead_problem_qualified',
    offerReady: 'lead_offer_ready',
    buyerIntent: 'lead_buyer_intent',
});

const AUTOMATED_MANAGER_SOURCES = new Set([
    'auto_send',
    'balance_lead_client_manager_cron',
    'balance_lead_client_dm_manager',
    'balance_lead_client_manager',
]);

function compactText(value, max = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalized(value) {
    return compactText(value, 2000).toLowerCase();
}

function isAutomatedManagerDelivery(source, alertData = {}) {
    const direct = normalized(source);
    if (AUTOMATED_MANAGER_SOURCES.has(direct)) return true;
    if (direct !== 'scheduled_worker') return false;
    const scheduledVia = normalized(alertData.scheduled_via || alertData.reply_timing_choice?.source);
    return AUTOMATED_MANAGER_SOURCES.has(scheduledVia);
}

function classifyTopics(text) {
    const value = normalized(text);
    const exercise = /\b(fitness|train(?:ing)?|workouts?|gym|exercise|movement|walk(?:ing|s)?|run(?:ning)?|lifting|lift|strength|cardio|sport|active|activity|steps?)\b/i.test(value);
    const health = /\b(health|healthy|energy|energised|energized|sleep|weight|body|feel(?:ing)? fitter|feel(?:ing)? stronger|pain|injur(?:y|ed|ies)|recovery)\b/i.test(value);
    const food = /\b(food|meals?|eating|diet|nutrition|protein|calories?|macros?|plant.?based|vegan)\b/i.test(value);
    const structure = /\b(consistent|consistency|routine|structure|plan|planning|prep|accountability|motivation|stick(?:ing)? to|keep(?:ing)? it up|fall(?:ing)? off|fell off|slip(?:ping)?|getting back|back into|hard to|struggl\w*|goal|help|support)\b/i.test(value);
    const foodStructure = food && structure;
    const consistency = structure && (exercise || health || food || /\b(week|habits?|progress)\b/i.test(value));
    return {
        exercise,
        health,
        food_structure: foodStructure,
        consistency,
    };
}

function topicList(flags = {}) {
    return Object.entries(flags).filter(([, present]) => present).map(([topic]) => topic);
}

function classifyHealthProgressionAttempt(text, { aiAuthored = true } = {}) {
    const value = normalized(text);
    const flags = classifyTopics(value);
    const topics = topicList(flags);
    const asksQuestion = /\?/.test(value);
    const leadDirected = /\b(you|your|you'?re|you've|you’d|yourself)\b/i.test(value);
    const progressionLanguage = /\b(goal|want(?:ing)? to|trying to|work(?:ing)? toward|struggl\w*|hard to|consistent|consistency|routine|structure|accountability|motivation|help|support|keeps? slipping|fall(?:ing)? off|fell off|get(?:ting)? back)\b/i.test(value);
    const genericFoodBanter = /\b(favou?rite|comfort food|tast(?:e|y)|delicious|recipe|homemade|restaurant|snack)\b/i.test(value)
        && !flags.food_structure
        && !flags.exercise
        && !flags.health;
    const isAttempt = Boolean(
        aiAuthored
        && value
        && topics.length
        && !genericFoodBanter
        && ((asksQuestion && leadDirected) || progressionLanguage)
    );
    return {
        is_attempt: isAttempt,
        ai_authored: Boolean(aiAuthored),
        move_type: asksQuestion ? 'question' : 'statement',
        topics,
        evidence: isAttempt ? compactText(text, 500) : '',
    };
}

function classifyHealthProgressionAnswer(text, attempt = {}) {
    const value = normalized(text);
    const flags = classifyTopics(value);
    const topics = topicList(flags);
    const directShortAnswer = /^(?:yeah|yep|yes|nah|no|nope|sometimes|occasionally|not really|a bit|a little|every day|most days)\b/i.test(value);
    const attemptTopics = Array.isArray(attempt.topics) ? attempt.topics.filter(Boolean) : [];
    const isAnswer = Boolean(value && (topics.length || (attemptTopics.length && directShortAnswer)));
    return {
        is_answer: isAnswer,
        topics: topics.length ? topics : attemptTopics,
        answer_type: topics.length ? 'health_detail' : (directShortAnswer ? 'direct_short_answer' : 'none'),
        evidence: isAnswer ? compactText(text, 500) : '',
    };
}

function usefulFact(value) {
    return compactText(value, 1000) || null;
}

function progressionMilestones(priorQualifier = {}, nextQualifier = {}) {
    const priorFacts = priorQualifier?.facts || {};
    const nextFacts = nextQualifier?.facts || {};
    const events = [];
    const nextGoal = usefulFact(nextFacts.motivation);
    const nextBlocker = usefulFact(nextFacts.history_blockers);
    if (!usefulFact(priorFacts.motivation) && nextGoal) {
        events.push({ type: HEALTH_PROGRESSION_EVENT_TYPES.goal, evidence: nextGoal });
    }
    if (!usefulFact(priorFacts.history_blockers) && nextBlocker) {
        events.push({ type: HEALTH_PROGRESSION_EVENT_TYPES.blocker, evidence: nextBlocker });
    }

    const priorCommercial = normalized(priorQualifier?.commercial_stage || 'engaged');
    const nextCommercial = normalized(nextQualifier?.commercial_stage || 'engaged');
    const commercialEvents = {
        problem_qualified: HEALTH_PROGRESSION_EVENT_TYPES.problemQualified,
        offer_ready: HEALTH_PROGRESSION_EVENT_TYPES.offerReady,
        buyer_intent: HEALTH_PROGRESSION_EVENT_TYPES.buyerIntent,
    };
    if (priorCommercial !== nextCommercial && commercialEvents[nextCommercial]) {
        events.push({
            type: commercialEvents[nextCommercial],
            evidence: compactText(nextQualifier?.commercial_reason || `${priorCommercial} -> ${nextCommercial}`, 500),
        });
    }
    return events;
}

module.exports = {
    HEALTH_PROGRESSION_EVENT_TYPES,
    classifyHealthProgressionAnswer,
    classifyHealthProgressionAttempt,
    classifyTopics,
    isAutomatedManagerDelivery,
    progressionMilestones,
};
