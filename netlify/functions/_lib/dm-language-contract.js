const {
    ACQUISITION_MODES,
    isPaidMetaAcquisitionMode,
} = require('./ig-acquisition-mode');

const DM_LANGUAGE_CONTRACT_VERSION = 'dm_language_contract_2026_08_v1';
const ORGANIC_DM_EXPERIMENT = 'organic_recognition_shape_v1';
const ORGANIC_DM_TREATMENT = 'recognition_one_question';
const ORGANIC_DM_CONTROL = 'existing_prompt_control';
const ORGANIC_MODES = new Set([
    ACQUISITION_MODES.ORGANIC_FOLLOWER,
    ACQUISITION_MODES.ORGANIC_OUTREACH,
    ACQUISITION_MODES.ORGANIC_INBOUND,
]);

const STOP_WORDS = new Set([
    'about', 'after', 'again', 'also', 'and', 'are', 'been', 'before', 'being', 'but',
    'can', 'could', 'did', 'does', 'for', 'from', 'have', 'how', 'into', 'its', 'just',
    'like', 'more', 'not', 'now', 'really', 'said', 'that', 'the', 'their', 'them',
    'then', 'there', 'they', 'this', 'too', 'was', 'what', 'when', 'where', 'which',
    'who', 'why', 'will', 'with', 'would', 'you', 'your', 'youre', 'ive', 'im',
]);

function stableBucket(value, bucketCount = 2) {
    const text = String(value || '').trim();
    const size = Math.max(1, Number(bucketCount) || 1);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % size;
}

function buildOrganicTreatmentPromptBlock() {
    return `

ORGANIC DM RESPONSE-SHAPE TEST (TREATMENT):
- This test applies only to this organic lead conversation. It never changes paid-Meta progression, paid-ad timing, proof media, offer variants, preview handoffs or checkout rules.
- Start with recognition grounded in one exact detail from the current conversation episode. Use fresh wording rather than copying an unusual phrase.
- Default simple replies to one bubble and roughly 25 words or fewer. Match the person's effort when the message is substantive, vulnerable, multi-part or needs a direct practical answer.
- Be statement-led. Ask no question when recognition, a direct answer, a useful reflection, practical help, an offer-stage answer or a clean pause completes the turn.
- When a missing answer genuinely changes the next relationship, support, qualification or offer decision, ask exactly one purposeful question. Never bundle questions or append one merely to keep the chat alive.
- After two consecutive Shannon question turns in the current episode, the next reply must be statement-led and question-free unless the newest lead-authored message supplies a fresh fitness, food-structure, consistency, energy, help, support, safety or buyer-intent signal.
- Do not alter the earned commercial move. Direct price, inclusions, link, join or start requests still receive the correct same-turn answer or handoff.`;
}

function resolveDmLanguageExperiment({ acquisitionMode = '', linkedUserId = null, threadId = '', channel = '' } = {}) {
    if (linkedUserId || acquisitionMode === ACQUISITION_MODES.EXISTING_CLIENT) {
        return {
            contractVersion: DM_LANGUAGE_CONTRACT_VERSION,
            experiment: null,
            variant: 'existing_client_not_enrolled',
            enrolled: false,
            protectedLane: true,
            reason: 'existing_client_lane',
            promptBlock: '',
        };
    }
    if (isPaidMetaAcquisitionMode(acquisitionMode)) {
        return {
            contractVersion: DM_LANGUAGE_CONTRACT_VERSION,
            experiment: null,
            variant: 'paid_meta_existing_flow',
            enrolled: false,
            protectedLane: true,
            reason: 'verified_paid_meta_protected',
            promptBlock: '',
        };
    }
    if (!ORGANIC_MODES.has(acquisitionMode)) {
        return {
            contractVersion: DM_LANGUAGE_CONTRACT_VERSION,
            experiment: null,
            variant: 'unknown_lane_not_enrolled',
            enrolled: false,
            protectedLane: true,
            reason: 'acquisition_lane_not_defensible',
            promptBlock: '',
        };
    }
    if (String(channel || '').trim().toLowerCase() !== 'instagram') {
        return {
            contractVersion: DM_LANGUAGE_CONTRACT_VERSION,
            experiment: null,
            variant: 'non_instagram_not_enrolled',
            enrolled: false,
            protectedLane: true,
            reason: 'organic_experiment_is_instagram_only',
            promptBlock: '',
        };
    }
    if (!String(threadId || '').trim()) {
        return {
            contractVersion: DM_LANGUAGE_CONTRACT_VERSION,
            experiment: null,
            variant: 'missing_thread_id_not_enrolled',
            enrolled: false,
            protectedLane: true,
            reason: 'stable_assignment_unavailable',
            promptBlock: '',
        };
    }

    const treatment = stableBucket(`${ORGANIC_DM_EXPERIMENT}:${threadId}`, 2) === 1;
    return {
        contractVersion: DM_LANGUAGE_CONTRACT_VERSION,
        experiment: ORGANIC_DM_EXPERIMENT,
        variant: treatment ? ORGANIC_DM_TREATMENT : ORGANIC_DM_CONTROL,
        enrolled: true,
        protectedLane: false,
        reason: treatment ? 'deterministic_treatment_assignment' : 'deterministic_control_assignment',
        promptBlock: treatment ? buildOrganicTreatmentPromptBlock() : '',
    };
}

function normalizedTokens(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, ' ')
        .split(/\s+/)
        .map(token => token.replace(/^'+|'+$/g, ''))
        .filter(token => token.length >= 4 && !STOP_WORDS.has(token));
}

function countSpecificOverlap(inboundText, outboundText) {
    const inbound = new Set(normalizedTokens(inboundText));
    if (!inbound.size) return 0;
    return [...new Set(normalizedTokens(outboundText))].filter(token => inbound.has(token)).length;
}

function inferFunctionTags(text) {
    const value = String(text || '').trim();
    const tags = [];
    const add = (tag, matched) => { if (matched && !tags.includes(tag)) tags.push(tag); };
    add('elicitation', /\?/.test(value));
    add('price', /(?:\$\s?\d|\b(?:aud|payment|price|costs?)\b)/i.test(value));
    add('offer_bridge', /\b(?:balance foundations|founders pass|could help|could be a good fit|built balance)\b/i.test(value));
    add('inclusions', /\b(?:six[- ]week|workout program|meal plan|weekly check[- ]?in|app\/community|community access)\b/i.test(value));
    add('proof', /\b(?:transformation|client result|before and after|quick (?:app )?video|show you .*photo)\b/i.test(value));
    add('autonomy_protection', /\b(?:no pressure|up to you|your call|take your time|if you want|if that suits)\b/i.test(value));
    add('link_handoff', /https?:\/\/|\b(?:here(?:'s| is) the link|send you (?:the )?link|checkout)\b/i.test(value));
    add('shame_relief', /\b(?:not failing|nothing wrong with you|doesn't mean you|not a willpower|hard around your life)\b/i.test(value));
    add('reframe', /\b(?:rather than|instead of|the issue isn't|doesn't mean|what that tells me)\b/i.test(value));
    add('practical_help', /\b(?:try this|start with|first thing|next step|set .* up|give .* a go)\b/i.test(value));
    add('pause', !/\?/.test(value) && !/https?:\/\//i.test(value) && value.split(/\s+/).filter(Boolean).length <= 18);
    return tags;
}

function measureDmLanguageShape({ chunks = [], inboundText = '' } = {}) {
    const bubbles = (Array.isArray(chunks) ? chunks : [chunks])
        .map(value => String(value || '').trim())
        .filter(Boolean);
    const text = bubbles.join(' ');
    const words = text.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g) || [];
    const firstSentence = text.split(/(?<=[.!?])\s+/)[0] || '';
    const questionCount = (text.match(/\?/g) || []).length;
    const overlapCount = countSpecificOverlap(inboundText, text);
    const functionTags = inferFunctionTags(text);
    if (overlapCount > 0) functionTags.unshift('exact_detail_reflection_candidate');
    if (text && !/^\s*(?:yeah|yep|yes|nah|no|okay|ok|sure|thanks|thank you)\b[.!]?\s*$/i.test(text)) {
        functionTags.unshift('recognition_candidate');
    }
    return {
        bubble_count: bubbles.length,
        word_count: words.length,
        character_count: text.length,
        question_count: questionCount,
        statement_led: !!text && !firstSentence.includes('?'),
        simple_length_25_or_less: words.length <= 25,
        specific_detail_overlap_count: overlapCount,
        function_tags_heuristic: [...new Set(functionTags)],
        classifier_version: 'dm_shape_heuristic_v1',
    };
}

module.exports = {
    DM_LANGUAGE_CONTRACT_VERSION,
    ORGANIC_DM_EXPERIMENT,
    ORGANIC_DM_TREATMENT,
    ORGANIC_DM_CONTROL,
    stableBucket,
    buildOrganicTreatmentPromptBlock,
    resolveDmLanguageExperiment,
    measureDmLanguageShape,
};
