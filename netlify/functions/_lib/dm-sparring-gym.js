/**
 * DM Sparring Gym
 *
 * Internal simulator for Balance Instagram lead conversations.
 * It creates fake IG leads, drafts Shannon-style replies, scores the thread,
 * and writes no live Supabase/ManyChat data.
 */

const {
    supabaseQuery,
    callVertexAIModel,
    callGeminiFallback,
    buildCoachBioBlock,
    buildNameUsePolicyBlock,
    buildRelationshipDiscoveryBlock,
    buildHeardFirstConversationBlock,
    buildShannonDmTuningBlock,
    normalizeCoachDraftText,
    splitCoachDraftIntoDmBubbles,
    stripLeadingGreeting,
    formatCoachLocalTimestamp,
} = require('./client-context');

const {
    freshQualifier,
    evaluateQualifier,
    isUnsafeStockDiscoveryQuestion,
    isChallengeOfferWarningText,
    hasChallengeInviteReadinessSignal,
    hasEarnedChallengeInviteMoment,
    countMeaningfulLeadReplies,
    isPrematureChallengeInvite,
} = require('./qualifier-engine');

const DEFAULT_PERSONAS = [
    {
        key: 'body_image_lurker',
        name: 'Mia',
        route: 'generic',
        hookContext: 'Shannon replied to her story about hating how she looks in photos.',
        hiddenProfile: '29, works in admin, has tried calorie cuts, embarrassed about starting again, responds warmly if she feels seen.',
        behaviour: 'vulnerable but not dramatic. Shorter replies at first, then opens up if Shannon does not rush the challenge.',
        objections: ['does not want another restrictive diet', 'worried she will quit after a week'],
        opening: 'haha yeah i feel like every photo lately is a jumpscare',
    },
    {
        key: 'sceptical_vegan',
        name: 'Tara',
        route: 'vegan',
        hookContext: 'Shannon reacted to her vegan meal prep story.',
        hiddenProfile: '34, long-term vegan, hates fitness influencer energy, likes direct practical talk.',
        behaviour: 'sharp and a bit sceptical. Tests whether Shannon is actually plant-based friendly.',
        objections: ['does not want bro dieting', 'thinks challenges are usually a bit cringe'],
        opening: 'lol please tell me this is not another chicken and broccoli plan but vegan',
    },
    {
        key: 'busy_mum',
        name: 'Jess',
        route: 'generic',
        hookContext: 'Shannon replied to a chaotic school-run coffee story.',
        hiddenProfile: '38, two kids, used to train, feels guilty taking time for herself.',
        behaviour: 'friendly, scattered, often answers only part of the question.',
        objections: ['time', 'mum guilt', 'too tired at night'],
        opening: 'honestly my fitness plan right now is surviving until bedtime',
    },
    {
        key: 'gym_beginner',
        name: 'Alyssa',
        route: 'generic',
        hookContext: 'Shannon replied to a story about joining a gym.',
        hiddenProfile: '24, beginner, nervous in the weights area, wants confidence more than scale loss.',
        behaviour: 'curious and polite. Will ask what the challenge involves if Shannon makes it feel safe.',
        objections: ['intimidated by gyms', 'does not know what exercises to do'],
        opening: 'i joined but i basically just walk around pretending i know what the machines do',
    },
    {
        key: 'emotional_eater',
        name: 'Nikki',
        route: 'generic',
        hookContext: 'Shannon replied to a late-night snack joke.',
        hiddenProfile: '31, stress eats, has a good sense of humour, hates being lectured.',
        behaviour: 'bantery on the surface, honest underneath if Shannon does not moralise food.',
        objections: ['stress eating', 'all-or-nothing weekends'],
        opening: 'my toxic trait is thinking a family block of chocolate is a single serve',
    },
    {
        key: 'ghosty_story_reply',
        name: 'Bec',
        route: 'undecided',
        hookContext: 'Shannon replied to a beach walk story.',
        hiddenProfile: '27, friendly but not yet looking for coaching, may vanish if it feels like sales.',
        behaviour: 'low-commitment, one-liners, easily spooked by pitches.',
        objections: ['not actively looking', 'does not want to be sold to'],
        opening: 'haha yeah was such a nice morning',
    },
    {
        key: 'hot_start_help',
        name: 'Courtney',
        route: 'vegan',
        hookContext: 'Shannon replied to her post about wanting to feel healthy before summer.',
        hiddenProfile: '33, plant-curious, tired of starting over, ready for help if the next step is simple.',
        behaviour: 'warm and direct. Gives clear help signals early.',
        objections: ['overcomplicates food', 'needs structure'],
        opening: "i actually need help, i dunno what i'm doing anymore",
    },
];

const SCORE_FIELDS = [
    'felt_human',
    'heard_first',
    'context_use',
    'not_boring',
    'not_salesy',
    'question_quality',
    'invite_timing',
    'likely_reply',
    'likely_join',
];

const MEDIA_MARKER_RE = /\[(PHOTO|AUDIO|VIDEO|attachment|IG_STORY_REPLY_CONTEXT)[^\]]*\]/gi;

function hashSeed(value) {
    let h = 2166136261;
    const input = String(value || 'balance');
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return function random() {
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function seededRandom(seed) {
    return mulberry32(hashSeed(seed));
}

function choosePersonas({ personas = DEFAULT_PERSONAS, count = 3, seed = 'balance' } = {}) {
    const source = Array.isArray(personas) && personas.length ? personas : DEFAULT_PERSONAS;
    const random = seededRandom(seed);
    const picked = [];
    const pool = [...source];
    while (picked.length < count && pool.length) {
        const index = Math.floor(random() * pool.length);
        picked.push(pool.splice(index, 1)[0]);
    }
    while (picked.length < count) {
        picked.push(source[picked.length % source.length]);
    }
    return picked;
}

function parseJsonObject(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    let text = rawText.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            const parsed = JSON.parse(match[0]);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
}

function clampScore(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function normalizeScorecard(raw = {}) {
    const scores = {};
    for (const field of SCORE_FIELDS) {
        scores[field] = clampScore(raw[field], 0);
    }
    const overall = SCORE_FIELDS.reduce((sum, field) => sum + scores[field], 0) / SCORE_FIELDS.length;
    return {
        ...raw,
        ...scores,
        overall: clampScore(raw.overall, clampScore(overall, 0)),
        risk_flags: normalizeRiskFlags(raw.risk_flags),
        best_moment: String(raw.best_moment || '').trim(),
        weakest_moment: String(raw.weakest_moment || '').trim(),
        prompt_rule_suggestion: String(raw.prompt_rule_suggestion || '').trim(),
        likely_outcome: String(raw.likely_outcome || '').trim(),
    };
}

const ALLOWED_RISK_FLAGS = new Set([
    'premature_invite',
    'too_salesy',
    'stock_question',
    'too_many_questions',
    'validation_loop',
    'no_progression',
    'missed_specific_hook',
    'too_generic',
    'ignored_direct_question',
    'ghosted',
    'privacy_leak',
    'ai_disclosure',
]);

function normalizeRiskFlag(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const lower = text.toLowerCase();
    if (/premature|too early|early invite|challenge.*soon/.test(lower)) return 'premature_invite';
    if (/sales|pitch|funnel/.test(lower)) return 'too_salesy';
    if (/stock|generic question|normal day|goals/.test(lower)) return 'stock_question';
    if (/too many questions|multiple questions/.test(lower)) return 'too_many_questions';
    if (/validation loop|stuck.*validation|only validat/.test(lower)) return 'validation_loop';
    if (/no probing|no progress|progression|stagnant|not progress/.test(lower)) return 'no_progression';
    if (/missed|hook|specific detail/.test(lower)) return 'missed_specific_hook';
    if (/generic|bland|boring/.test(lower)) return 'too_generic';
    if (/direct question|ignored.*question/.test(lower)) return 'ignored_direct_question';
    if (/ghost|seen|no reply/.test(lower)) return 'ghosted';
    if (/privacy|identifying|private/.test(lower)) return 'privacy_leak';
    if (/\b(ai|automation|model|gemini|chatgpt)\b/.test(lower)) return 'ai_disclosure';
    const slug = lower.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
    return slug || '';
}

function normalizeRiskFlags(flags) {
    if (!Array.isArray(flags)) return [];
    return [...new Set(flags
        .filter(Boolean)
        .map(normalizeRiskFlag)
        .filter(Boolean)
        .map(flag => ALLOWED_RISK_FLAGS.has(flag) ? flag : flag))];
}

function hasQuestion(text) {
    return /\?/.test(String(text || ''));
}

function isDirectAdviceRequest(text) {
    const s = String(text || '');
    if (/\bthanks?\s+for\s+(?:the\s+)?tips?\b/i.test(s) && !hasQuestion(s)) return false;
    return /\b(any|quick|general|specific|got|have|give me|need|looking for|some)\s+(tips?|advice|suggestions?|recommendations?|pointers?|tricks?|cues?|drills?)\b/i.test(s)
        || /\b(tips?|advice|suggestions?|recommendations?|pointers?|tricks?|cues?|drills?)\s+(for|on|with)\b/i.test(s)
        || /\b(?:i'?d|i would|would)\s+love\s+to\s+hear\b.{0,90}\b(?:go-?tos?|easy|quick|minimal(?:\s+effort)?|meals?|recipes?|ideas?|options?|favou?rites?)\b/i.test(s)
        || /\b(?:what(?:\s+are|'?s)|got|have|share|send|tell me|give me)\b.{0,90}\b(?:go-?tos?|favou?rites?|easy|quick|minimal(?:\s+effort)?|meal ideas?|meals?|recipes?|options?)\b/i.test(s)
        || /\b(?:a couple|some|one or two)\s+of\s+(?:your\s+)?(?:favou?rites?|go-?tos?)\b/i.test(s)
        || /\bhow\s+(do|can|should)\s+i\b|\bwhat\s+(should|would|can)\s+i\b|\bwhat'?s\s+the\s+best\s+way\b|\bwhat'?s\s+the\s+magic\s+trick\b|\bwhat'?s\s+the\s+real\s+deal\b|\bwhat\s+makes\s+.*different\b|\bwhat\s+(?:are\s+)?your\s+thoughts\s+on\b|\bwhat\s+do\s+you\s+think\s+about\b|\bdo\s+you\s+(?:usually\s+)?recommend\b|\bwhat\s+.*recommend\b|\bis\s+it\s+actually\b|\bjust\s+another\s+program\b|\bhow\s+does\s+it\s+adapt\b/i.test(s);
}

function isTrackingAccuracyRequest(text) {
    const s = String(text || '');
    return /\b(tracking|numbers?|graphs?|data|stats?)\b/i.test(s)
        && /\b(accurate|reflect|looking at .* wrong|numbers wrong|graphs? don'?t|how do i know|how do i really know|back it up)\b/i.test(s);
}

function hasActionableAdvice(text) {
    const withoutChallengeOffers = String(text || '')
        .replace(/[^.!?\n]*(?:30\s*day|30-day|free challenge|challenge|send.*link|link)[^.!?\n]*/gi, ' ');
    const adviceVerb = /\b(try|aim|start|keep|use|swap|reduce|scale|back off|leave|stop|stopping|rest|pause|next time|one thing|easiest|simple rule|rule of thumb|good sign|quick tip|tip would be|i'd|i would|i usually|i'll|think about|focus on|cue|key is|sweet spot|reach|reaching|drive|pushing|push|not totally black and white|not black and white|promising research|not like a magic bullet|magic bullet|complex area|evidence|research for specific things|specific things)\b/i.test(withoutChallengeOffers);
    const practicalFoodSpecific = /\b(one-?pot|pasta|ramen|beans?|cannellini|lentils?|tofu|edamame|frozen (?:veg|veggies|vegetables)|wraps?|burrito|curry|stir.?fry|smoothie|overnight oats|microwave|pantry|meal idea|recipe)\b/i.test(withoutChallengeOffers)
        && /\b(go-?tos?|option|meal|recipe|add|throw|keep|use|do|make|works?|barely any work|minimal effort|quick|easy ones?|ones are)\b/i.test(withoutChallengeOffers);
    return adviceVerb || practicalFoodSpecific;
}

function hasTrackingAccuracyAdvice(text) {
    const s = String(text || '').toLowerCase();
    return /\b(trend|patterns?|weekly average|week to week|few days|over a week|same inputs?|logging consistency|logged consistently|sets?|reps?|loads?|performance|bodyweight|photos?|measurements?|compare|check|cross.?check|look for)\b/i.test(s)
        && /\b(tracking|numbers?|graphs?|data|stats?|accurate|reflect|progress|effort|work)\b/i.test(s);
}

function isUnresolvedPlateauSignal(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    const stuckSignal = /\b(plateau|stuck|no progress|not progressing|same weight|pb for months|won'?t budge|nothing shifts|nothing seems to (make|be making) a difference|nothing makes a difference|not making a difference|not moving)\b/i.test(s);
    const triedSignal = /\b(i'?ve tried|i have tried|tried|already tried|done|deload|volume|rep ranges?|accessory work|tracking|eating well|sleep'?s decent|programs?)\b/i.test(s);
    const trainingSignal = /\b(squat|bench|deadlift|lift|lifting|training|gym|strength|stronger|pb|quads?|glutes?|sets?|reps?)\b/i.test(s);
    const goodEnoughButNotChanging = /\bgood enough\b.*\bnothing'?s? changing\b|\bnothing'?s? changing\b.*\bgood enough\b/i.test(s)
        && /\b(trainer|macros?|protein|sleep|consistent|track(?:ing)?|review)\b/i.test(s);
    return (stuckSignal && (triedSignal || trainingSignal)) || goodEnoughButNotChanging;
}

function isMindMuscleCueRequest(text) {
    return /\b(mind.?muscle|brain to (my )?glutes|connect.*glutes|feel.*(glutes|hamstrings)|glutes?.*fire|back.*taking over|deadlifts?)\b/i.test(String(text || ''))
        && /\b(tricks?|tips?|cues?|drills?|not sure|thinking about it right)\b/i.test(String(text || ''));
}

function hasMindMuscleCueTip(text) {
    return /\b(hip hinge|hips back|push your hips|wall tap|rdl|romanian deadlift|glute bridge|pause rep|pause before|hamstring stretch|squeeze.*glutes|brace first|lats|armpits|push(?:ing)? the floor away|film.*side|side angle|warm.?up.*glute|activation)\b/i.test(String(text || ''));
}

function isBracingCueSignal(text) {
    return /\b(brac(?:e|ing)|core|stable|stability|holding my breath|hold(?:ing)? breath|lightheaded|belly button|squat)\b/i.test(String(text || ''))
        && /\b(not sure|unsure|enough|normal|doing it right|lightheaded|holding my breath|unstable|form was off|felt off|disconnect|soft|under load|heavy lift|tough|can'?t keep)\b/i.test(String(text || ''));
}

function hasBracingCueTip(text) {
    return /\b(360|three sixty|brace around|brace like|cough|belt|ribs down|breathe behind|breathe into|pressure|belly button out|don'?t pull|do not pull|expand|exhale|inhale|air|lightheaded|holding your breath|not just pulling|warm.?up sets?|lighter|before (?:you )?pull|before the pull|reset(?: the)? brace|own that brace|load light)\b/i.test(String(text || ''));
}

function isDeadliftFormBreakdownSignal(text) {
    const s = String(text || '');
    return /\b(deadlifts?|pull(?:ing)?|lift(?:ing|s)?)\b/i.test(s)
        && /\b(form breaks? down|lower back round(?:ing|s)?|hips? shoot(?:ing)? up|can'?t keep .*tight|soft midsection|core.*(?:soft|disconnect|engag)|brace|bracing|heavy lift|under load)\b/i.test(s);
}

function hasDeadliftFormProgression(text) {
    const s = String(text || '');
    return hasBracingCueTip(s)
        || /\b(film|side angle|drop the weight|drop load|reduce load|lighter set|warm.?up set|bar close|lats?|armpits?|wedge|push the floor|hips and chest|pause off the floor|reset(?: your)? brace|stop adding weight|own the rep)\b/i.test(s);
}

function isAdvancedBiohackAdviceRequest(text) {
    const s = String(text || '');
    const advancedTopic = /\b(ipamorelin|cjc[-\s]?1295|no dac|bpc[-\s]?157|tb[-\s]?500|peptide stacks?|peptides?.*stack|gh pulse|nad\+?|nadh|nr\b|nmn\b|senolytics?|mitochondrial|cellular efficiency|genetic limits|biohack(?:ing)?|advanced protocols?)\b/i.test(s);
    const adviceAsk = /\b(what (?:are )?your thoughts|what do you think|recommend|protocols?|stack(?:ing)?|combo|synergy|optim(?:i|y)zing|next edge|real deal|legit)\b/i.test(s);
    return advancedTopic && adviceAsk;
}

function hasAdvancedBiohackBoundary(text) {
    const s = String(text || '');
    const boundary = /\b(doctor|clinician|medical|prescriber|bloodwork|not something i'?d recommend|wouldn'?t recommend|can'?t advise|not my lane|outside my lane|careful|risk|legal|supervised)\b/i.test(s);
    const practicalRedirect = /\b(training|sleep|recovery|load|programming|nutrition|protein|calories|steps|stress|baseline|fundamentals|boring basics|performance habits|periodi[sz]ation)\b/i.test(s);
    return boundary && practicalRedirect;
}

function isProgramExplanationRequest(text) {
    return /\b(what'?s\s+the\s+real\s+deal|what\s+makes\s+.*different|just\s+another\s+program|is\s+it\s+actually|actually\s+customi[sz]ed|how\s+does\s+it\s+adapt|specific techniques|what'?s\s+the\s+magic\s+trick|making\s+.*stick|how\s+do\s+you\s+.*sweet\s+spot|falling\s+off\s+the\s+wagon)\b/i.test(String(text || ''));
}

function hasProgramExplanationSpecifics(text) {
    return /\b(progressive overload|periodi[sz]ation|rpe|tempo|rest.?pause|drop sets?|deload|sticking points?|customi[sz]ed|1:1|one.?to.?one|baseline|minimum floor|all.?or.?nothing|habit floor|daily check|structure|framework|specific techniques?|tracked|adjust|not totally black and white|not black and white|promising research|magic bullet|complex area|evidence|research for specific things|specific things)\b/i.test(String(text || ''));
}

function hasPlateauDiagnosticProgression(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    if (hasActionableAdvice(s)) return true;
    if (/\b(sticking point|where.*breaks down|which part|what part|technique|form|depth|bracing|tempo|pause|rest periods?|recovery|calories|protein|warm.?up|film|video|check.*set|top set|back.?off|load|intensity|frequency|specific tweak|small tweak|next variable)\b/i.test(s)) {
        return true;
    }
    return hasQuestion(s) && /\b(why|what|where|which|how).*\b(stall|stuck|plateau|breaks down|fails?|hardest|tried|changed|squat|lift|pb)\b/i.test(s);
}

function isPlateauAdviceRequest(text) {
    const s = String(text || '');
    const plateauSignal = /\b(plateaus?|stuck|stall(?:ed|ing)?|pushing past|push past|won'?t budge)\b/i.test(s);
    const trainingSignal = /\b(leg strength|strength|lifts?|deadlifts?|squats?|bench|leg press|rep ranges?|training|gym)\b/i.test(s);
    return plateauSignal
        && trainingSignal
        && /\b(what'?s your take|your take|ideas?|angles?|approach|tweaks?|rep ranges?|how do i|how to|best way|ways? to)\b/i.test(s);
}

function hasConcretePlateauAngle(text) {
    const s = String(text || '').toLowerCase();
    if (hasActionableAdvice(s)) return true;
    return /\b(tempo|pauses?|pause reps?|rep schemes?|heavy singles?|heavy doubles?|singles\/doubles|rdls?|accessor(?:y|ies)|deload|volume|frequency|intensity|recovery|foot position|stance|range of motion|sticking point|top set|back.?off|load management)\b/i.test(s);
}

function isAdvancedPlantBasedSignal(text) {
    return /\b(fully plant.?based|non.?negotiable ethical|ethical stance|ethical alignment|elite performance|macros plant.?based|micronutrients?|smart planning|meticulous planning|demanding schedule|protein and variety are handled|no eggs|no dairy)\b/i.test(String(text || ''));
}

function isEthicalFoundationSignal(text) {
    return /\b(non.?negotiable ethical|ethical stance|animal welfare|ethical foundation|not just a belief|how i operate daily|life is structured around|ethical commitment|not about easy)\b/i.test(String(text || ''));
}

function hasEthicalFoundationProgression(text) {
    const s = String(text || '').toLowerCase();
    if (!hasQuestion(s)) return false;
    const genericMealProbe = /\b(go-?to meals?|few go-?to|fall back on|cook at home|easier to cook|meal prep|recipes?)\b/i.test(s);
    const ethicalAnchor = /\b(ethical|ethics|compassion|animal|welfare|values|advocacy|misunderstand|social|logistic|tested|daily choices|shapes|carry|commitment|foundation|non.?negotiable|compromise|alignment)\b/i.test(s);
    if (genericMealProbe && !ethicalAnchor) return false;
    return /\b(what|which|how|where|when|does|do).*\b(misunderstand|ethical|ethics|compassion|animal|welfare|values|advocacy|social|logistic|daily choices|shapes|structure|commitment|tested|carry|pressure|burnout|hardest|non.?negotiable|foundation|compromise|thriv(?:e|ing)|performance|alignment|discipline|knowledge|physical pursuits?)\b/i.test(s);
}

function isVeganEthicalChallengeToVegetarianism(text) {
    const s = String(text || '').toLowerCase();
    return /\b(vegetarianism|vegetarian|fully plant.?based|vegan|animal welfare)\b/i.test(s)
        && /\b(what made you|why did you|why not|settle back|go back|after trying|with animal welfare in mind|beyond just tradition)\b/i.test(s);
}

function hasPlantBasedProcessProgression(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    if (/\b(protein|variety|easy to get enough|stay on track)\b/i.test(s) && !/\b(already|handled|standard|elite|process|system|demanding schedule)\b/i.test(s)) return false;
    return hasQuestion(s) && /\b(what|which|how|where).*\b(track|plan|micros?|macros?|protein|iron|b12|omega|meals?|staples?|process|pay attention|hardest|schedule|training|performance|elite|standard|systems?|shapes|structure|daily choices|misunderstand|tested|social|advocacy|burnout|emotional|load|stamina|welfare|helpless|carry|thriv(?:e|ing)|physical pursuits?|discipline|knowledge|compromise|values|alignment)\b/i.test(s);
}

function trivializesEthicalFoundation(text) {
    return /\b(easy to stay on track|stay on track|make it easy|mostly plant.?based|busy days|with training)\b/i.test(String(text || ''));
}

function mishandlesVeganEthicalChallenge(text) {
    const s = String(text || '').toLowerCase();
    return /\b(good balance|fits my day-to-day|too restrictive|still aligns with animal welfare|aligns with the animal welfare|settled back into vegetarian|personally sustainable)\b/i.test(s)
        && !/\b(imperfect|not a clean answer|compromise|i get why that may not land|i know that is not the same)\b/i.test(s);
}

function isAppOrWorkoutPlanSupportRequest(text) {
    return /\b(app|glitch|glitched|bug|display|log my workout|logging|tracking|graphs?|numbers?|workout plan|workout plans|full.?body plan|full.?body plans|m\/w\/f|mon\/wed\/fri|movement on off days|same exercises|rep schemes?|new challenges|fresh plans?|fresh workouts?|routine|plans? delivered|another app|tech hassle|face recognition|face id|password reset|reset link|login|log in|locked out|old email|spam|manual(?:ly)? reset)\b/i.test(String(text || ''));
}

function isPlantBasedFamilyMealPlanningSignal(text) {
    const s = String(text || '');
    if (isEthicalFoundationSignal(s)) return false;
    const plantSignal = /\b(plant.?based|ethical|healthy|vegan)\b/i.test(s);
    const familySignal = /\b(kids?|children|toddler|family|palates?)\b/i.test(s);
    const planningSignal = /\b(meal planning|planning|grocery|groceries|same few things|same few|rotation|varied|quick wins?|exhaustion|full.?time job|dinner|cook(?:ing)?)\b/i.test(s);
    return plantSignal && planningSignal && (familySignal || /\b(dinner|meals?|recipes?|dishes|cook(?:ing)?)\b/i.test(s));
}

function isGenericFamilyGoToMealProbe({ leadText, coachText } = {}) {
    const lead = String(leadText || '');
    const coach = String(coachText || '');
    return /\b(constant battle|battle with family|picky kids?|everyone will actually eat|what'?s for dinner arguments?)\b/i.test(lead)
        && /\b(go-?to meals?|usually get approved|safe bet)\b/i.test(coach)
        && !/\b(one repeatable|base meal|meal base|rotation|fallback|pasta|bean burgers?|beans|lentils|tofu|wraps?|tacos?|tray bake|quick|minimum|hide enough veggies|approved most weeks)\b/i.test(coach);
}

function hasPlantBasedFamilyMealProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\b(one repeatable|two repeatable|base meal|meal base|rotation|template|batch|quick win|grocery|shopping list|kid-friendly|toddler|palates?|protein|lentils|tofu|beans|wraps?|pasta|tacos?|stir.?fry|tray bake|minimum|fallback|approved by everyone|safe bet|same toppings|picky eaters?)\b/i.test(s)
        && (hasQuestion(s) || /\b(try|use|start|keep|make|pick|build)\b/i.test(s))) {
        return true;
    }
    return hasQuestion(s) && /\b(what|which|where|how|are there any).*\b(planning|recipe|recipes|grocery|kids?|toddler|palates?|rotation|same few|quick|healthy|varied|protein|dinner|weeknight|approved|everyone|picky|safe bet|fallback|meals?)\b/i.test(s);
}

function isSimpleWorkoutPlanPreferenceSignal(text) {
    const s = String(text || '');
    const simpleOnly = /\b(simple|not too complicated)\b/i.test(s);
    const trainingContext = /\b(workouts?|training|routine|plan|machines?|full.?body|sets?|reps?|gym|exercises?)\b/i.test(s);
    return /\b(machines?|full.?body|in and out|no crazy setups?|obscure exercises?|deciphering|understand the plan|actually stick to|fresh routine)\b/i.test(s)
        || (simpleOnly && trainingContext);
}

function hasSimpleWorkoutPlanProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\b(3\s*days?|three\s*days?|m\/w\/f|mon\/wed\/fri|machines?|full.?body|push|pull|legs?|upper|lower|sets?|reps?|exercise slots?|template|simple plan|swap|progression|track|log|in and out|no crazy setup|easy to follow)\b/i.test(s)
        && (hasQuestion(s) || /\b(start|use|try|keep|pick|build|structure|template)\b/i.test(s))) {
        return true;
    }
    return hasQuestion(s) && /\b(what|which|how).*\b(machines?|full.?body|simple|stick|setup|days?|routine|plan|gym|equipment)\b/i.test(s);
}

function wordCount(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function isLowEnergyLeadReply(text) {
    const s = String(text || '').trim().toLowerCase();
    if (!s) return false;
    const words = wordCount(s);
    return wordCount(s) <= 4
        || (words <= 9 && /^(not really|nah|nope|yeah|yep|ok|okay|haha|lol|a bar|out|busy|dunno)\b/i.test(s))
        || (wordCount(s) <= 9 && /\b(yeah|thanks|trying|honestly|just|it'?s a lot|a lot|same)\b/i.test(s));
}

function isBlandSmallTalkChase(text) {
    return /\b(anywhere fun|any good music|how'?s your night|what are you up to|that'?s just how it goes|oh nice|haha nice|sounds good|fair enough)\b/i.test(String(text || ''));
}

function hasLowEnergySave(text) {
    return /\b(i'?ll leave you|leave you to it|enjoy the night|survive it|if it gets better|if the night improves|dead or chaotic|not your scene|strong \d\/10|give me a review|report back)\b/i.test(String(text || ''));
}

function isValidationOnlyChase(text) {
    const s = String(text || '').toLowerCase();
    if (hasActionableAdvice(s) || hasMindMuscleCueTip(s) || hasProgramExplanationSpecifics(s)) return false;
    return !hasQuestion(s)
        && /\b(totally get|makes such a difference|hard to|still in limbo|that feeling|hope you|massive effort|for sure|yeah that'?s)\b/i.test(s);
}

function isCaregiverExhaustionSignal(text) {
    const s = String(text || '');
    if (/\blook(?:s|ed)? sick\b/i.test(s)) return false;
    if (/\bold-school\b/i.test(s)) return false;
    if (/\b(app|tech|workout).{0,40}\bwip(?:ed|e)|\bwip(?:ed|e).{0,40}\b(rest|sets?|data|workout|restart|re-enter|manual(?:ly)?)\b/i.test(s)) return false;
    return /\b(parent|kids?|children|school|lunch|packed lunch|chores?|couch|fall asleep|fell asleep|conk(?:ed)? out|brain off|brain feels|cold|sick|juggle|schedules?|family life|family|rocket science|support worker|care work|elderly|relative|snacks? are easiest|too tired|exhausted|wiped|drained|long shift|long one|big shifts?|not much energy|zone out|zoning out)\b/i.test(s);
}

function isGenericExhaustionCommiseration(text) {
    const s = String(text || '').toLowerCase();
    if (/\b(harder to keep on top of things|keep on top of things|hope everyone got fed|couch just wins|couch is undefeated|brain off mode|hypnotic power|conked out|collapsing and conking out|daily logistics.*whole other level)\b/i.test(s)) {
        return true;
    }
    return !hasQuestion(s) && /\b(so real|totally get|for sure|rough|that feeling|whole other level|couch|conk|brain off|collapsing|juggle)\b/i.test(s);
}

function hasSpecificExhaustionProgression(text) {
    const s = String(text || '').toLowerCase();
    if (!hasQuestion(s)) return false;
    return /\b(what|which|where|how|is there anything|anything you(?:'ve| have)? found|does|do).*\b(gets squeezed|back burner|first thing|one thing|tiny|lowest|easier|5%|five percent|food|sleep|training|move|moving|energy|time to yourself|yourself|for yourself|things you want|support|load|pressure|hardest|easiest|switch off|unwind|reset|chill|mind racing|brain racing|helps?|help)\b/i.test(s);
}

function isMovingIsolationSignal(text) {
    const s = String(text || '');
    const movingAnchor = /\b(mov(?:e|ed|ing)|new place|settle(?:d|ing)? in|still trying to settle|find(?:ing)? my people|meet people|social circle|isolated|disconnected|step backward)\b/i.test(s);
    const strainAnchor = /\b(overwhelmed|hard|tough|a lot|isolated|disconnected|meet people|find(?:ing)? my people|social circle|step backward|new place|settle(?:d|ing)? in)\b/i.test(s);
    return movingAnchor && strainAnchor;
}

function hasMovingIsolationProgression(text) {
    const s = String(text || '').toLowerCase();
    return /\b(settl(?:e|ing)|new place|isolat(?:ed|ion)|disconnect(?:ed)?|meet people|social|people|groups?|activities|home|routine|grounded|overwhelm|support|small|tiny|outside|walk|reset|week|community|rhythm|find your people)\b/i.test(s)
        && (hasQuestion(s) || /\b(takes time|small|tiny|worth|helps|starting point|one starting point)\b/i.test(s));
}

function isSwampedLifestyleDeferralSignal(text) {
    const s = String(text || '');
    return /\b(apartment isn'?t .*friendly|not .*friendly|would love to|maybe in the future|swamped with work|too swamped|work these days)\b/i.test(s)
        && /\b(dog|pet|apartment|work|future|swamped)\b/i.test(s);
}

function hasSwampedLifestyleProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\bwhat kind of work keeps you so busy|what work keeps you busy\b/i.test(s)) return false;
    return /\b(swamped|work|capacity|time|switch off|future|apartment|space|routine|walk|energy|what would have to change|busy|make room|one day)\b/i.test(s)
        && (hasQuestion(s) || /\b(totally makes sense|one day|worth|helps)\b/i.test(s));
}

function isOverloadedMovementSignal(text) {
    const s = String(text || '');
    if (/\b(food|meals?|cooking|eat(?:ing)?|snacks?|kid|kids?|healthy eating|quick)\b/i.test(s)
        && !/\b(workouts?|training|movement|exercise|runs?|running|gym|lifting|dance|classes)\b/i.test(s)) {
        return false;
    }
    return /\b(any consistent movement|consistent movement|workouts?.*impossible|finding the time and energy|time and energy is tough|tried different things|studies|nursing|family life|me time|rushing|without rushing|long hours|squeeze in|work piles up|life happens|burn out|burnout|sidetracked|momentum|zero follow-through|good intentions)\b/i.test(s);
}

function hasLowestBarMovementBridge(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    return /\b(10\s*min|ten\s*min|5\s*min|five\s*min|tiny|minimum|lowest|smallest|floor|doable|low.?bar|micro|walk|stretch|after study|between study|before bed|one song|one set|no equipment|home|remove decision|make it automatic|pocket of time|time for yourself|mental reset|protect that)\b/i.test(s)
        || /\b(consistent rhythm|what usually makes that possible|what makes that possible|dance classes|lifting, work, and rest|fixed dance)\b/i.test(s)
        || (hasQuestion(s) && /\b(what|which|where|how).*\b(tiny|smallest|lowest|doable|easiest|realistic|fit|squeeze|energy|study|family|movement|walk|stretch|home|mental reset|pocket of time|time for yourself|lifesaver|consistent rhythm|dance|lifting|rest)\b/i.test(s));
}

function isReciprocalPersonalQuestion(text) {
    const s = String(text || '');
    return /\b(what kind of workouts are you into|what workouts are you into|what are you into|are you more of|what about you|what about sunshine|what kind of chaos does sunshine|what chaos does sunshine|sunshine usually get into|how about you|any furry friends|do you have any pets?|have you got any pets?|pets? keeping you|how'?s your day|got any plans|plans for the evening|where are you based|where do you train|do you listen to podcasts?|are you into podcasts?|what kind of stuff do you usually do for a challenge|what do you usually do for a challenge|what challenges do you do)\b/i.test(s)
        || /\byou\?\s*$/i.test(s.trim());
}

function hasReciprocalPersonalBridge(text) {
    const s = String(text || '').toLowerCase();
    if (!hasQuestion(s)) return false;
    return /\b(you|your|you'?re).*\b(work|busy|juggling|focus|focused|switch gears|workouts?|training|legs?|pets?|animals?|cats?|dogs?|names?|bunn(?:y|ies)|shelter|sanctuary|day|weekend|vibe|excited|keeping you company|mind racing|brain|switch off|helps?|reset|unwind|travel|trip|village|hiking|explor(?:e|ing)|wander(?:ing)?|local|podcasts?|episode|expert|listening|grabbed|stuck with|challenge|rope climb|fun|runs?|running|consistency|consistent|time|energy|motivation|music|artists?|electronic|folk)\b/i.test(s)
        || /\b(specific village|wherever you ended up|did you do much hiking|village vibe|local exploring|where did you|favourite spot|favorite spot)\b/i.test(s)
        || /\b(what (?:did|was).*(?:expert|podcast|episode).*(?:stuck with you|grabbed you|interesting)|what stuck with you|what grabbed you)\b/i.test(s)
        || /\b(what about you|how about you)\b/i.test(s);
}

function isTravelViewLoopSignal(text) {
    const s = String(text || '').toLowerCase();
    return /\b(view|views|skyline|mountains?|hills?|rooftop|landscape|scenery|escape|hidden gem|hidden gems|water spot|park bench|cafe with a view|travel|trip|hiking|explor(?:e|ing)|wander(?:ing)?|rockies|canada|nyc|burleigh|green hills|captivate)\b/i.test(s)
        && /\b(favourite|favorite|go-to|special|captivate|amazing|incredible|calming|peaceful|world away|soaking in|exploring|hiking|what about you|how about you)\b/i.test(s);
}

function hasTravelViewProgression(text) {
    const s = String(text || '').toLowerCase();
    return /\b(reset|switch off|unwind|clear head|mental|energy|stress|grounded|recharge|movement|walk|walking|hiking|outside|active|routine|week|day|work|training|escape|headspace|body|calm)\b/i.test(s)
        && (hasQuestion(s) || /\b(calming|helps|useful|needed|good for you)\b/i.test(s));
}

function isGenericTravelViewQuestion(text) {
    const s = String(text || '').toLowerCase();
    if (!hasQuestion(s)) return false;
    return /\b(favourite|favorite|go-to|epic|captivate|best|special|type of view|kind of view|place you'?ve seen|views? you|skyline|mountain view|hidden gems?)\b/i.test(s)
        && /\b(view|views|skyline|mountains?|hills?|landscape|scenery|place|spot|hidden gems?|travel|trip)\b/i.test(s)
        && !hasTravelViewProgression(s);
}

function isNostalgiaMemoryLoopSignal(text) {
    const s = String(text || '');
    return /\b(miss the old|old buzz|record store|vinyl|coffee shop|arcade|street fighter|button mashing|joysticks?|blockbuster|movie rental|magazine racks?|photos? to develop|slow reveal|old menus?|takeout order|back in the day|everything'?s so digital|scrolling just isn'?t|half-expecting|mural)\b/i.test(s);
}

function hasNostalgiaCurrentNeedBridge(text) {
    const s = String(text || '').toLowerCase();
    if (/\b(were you any good|what kind of takeout|usually on rotation|remember|favourite old|favorite old|old menus?|button mashing|street fighter|blockbuster|vhs|arcade)\b/i.test(s)
        && !/\b(now|these days|current|pace|slow|offline|switch off|reset|head|miss|need|space)\b/i.test(s)) {
        return false;
    }
    return /\b(now|these days|current|today|pace|slow(?:er)?|slow down|offline|digital|scrolling|switch off|reset|unwind|headspace|clear head|physical|real-world|miss|need|space|grounded|routine|outside|walk|training|energy|what that gave you|what you miss most)\b/i.test(s)
        && (hasQuestion(s) || /\b(sounds like|seems like|makes sense|worth|helps|missing)\b/i.test(s));
}

function isVagueCreativeChaosBanter(text) {
    const s = String(text || '');
    return /\b(creative chaos|continuous flow|fun stuff|creative adventures|whatever creative chaos|how'?s your day|how'?s the rest of your day|fun plans|what are you up to this weekend|hope you squash|bug|sunshine|curry|de-stress|😉)\b/i.test(s)
        && !/\b(need help|struggl|stuck|training|workout|food|energy|fitness|health|sore|pain|goal|challenge|link)\b/i.test(s);
}

function hasCreativeChaosProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\b(what kind of stuff|what kind of fun stuff|any plans|creative adventure|favourite kind of creative|favorite kind of creative|continuous flow)\b/i.test(s)
        && !/\b(reset|switch off|drain|energy|head|focus|training|movement|pressure|routine)\b/i.test(s)) {
        return false;
    }
    if (/\b(i'?ll leave you|leave you to it|hope you get|enjoy|catch you|talk soon|good luck with)\b/i.test(s) && !hasQuestion(s)) {
        return true;
    }
    return /\b(reset|switch off|unwind|de-?stress|clear (?:your )?head|headspace|energy|drain|focus|pressure|routine|training|movement|walk|outside|body|busy|creative work|creative chaos)\b/i.test(s)
        && (hasQuestion(s) || /\b(training later|good reset|helps|sounds like|worth|low pressure)\b/i.test(s));
}

function isAnimalPassionSignal(text) {
    return /\b(rescue bunn(?:y|ies)|bunn(?:y|ies).*(world|rescue)|animal shelter|volunteer(?:ing)? at (?:a|the) shelter|sanctuary|ethical sanctuary|animals?.*(world|calm|joy)|pip and squeak)\b/i.test(String(text || ''));
}

function isPetCalmFocusSignal(text) {
    const s = String(text || '');
    const petAnchor = /\b(cat|cats|kitten|dog|rabbit|bunn(?:y|ies)|pet|mittens|sunshine|zen master)\b/i.test(s);
    const calmFocusAnchor = /\b(zen|calm|peace|focus|concentrate|keyboard|work|desk|stress|unwind|presence|bed|3\s*am|2\s*am|zoomies|chaos)\b/i.test(s);
    return petAnchor && calmFocusAnchor;
}

function isPetOnlyBanter(text) {
    const s = String(text || '').toLowerCase();
    return (/\b(cat|cats|kitten|dog|pupp(?:y|ies)|rabbit|bunn(?:y|ies)|pet|mittens|sunshine|shelf|shelves|keyboard|lap|zoomies|chaos|menace|adorable|destructive|curtains?|couch|cables?|cords?|chargers?|headphones?|shoelaces?|claws?|chew(?:ed|ing)?|redecorat(?:e|ing)|secret meeting)\b/i.test(s)
        || /\b(focus killer|trying to concentrate|they know exactly|go-to target|target next)\b/i.test(s))
        && !/\b(stress|calm|peace|unwind|reset|movement|walk|training|exercise|routine|clear head|mental clarity|after work|energy|switch[-\s]?off|grounded|capacity)\b/i.test(s);
}

function isPetDeflectionSignal(text) {
    const s = String(text || '').toLowerCase();
    return /\b(cat|cats|kitten|dog|rabbit|bunn(?:y|ies)|pet|shoelaces?|claws?|dust bunn(?:y|ies)|redecorat(?:e|ing)|pays rent|hunt(?:ing)?)\b/i.test(s)
        && /\b(balance|classic|haha|lol|zen|chaos|mostly|tried to|trying to)\b/i.test(s);
}

function hasPetDeflectionBridge(text) {
    const s = String(text || '').toLowerCase();
    return hasQuestion(s)
        && /\b(outside|apart from|besides|actual|real|you|your|week|day|energy|training|food|routine|movement|stress|health|feel better|balance)\b/i.test(s);
}

function isPetNameQuestion(text) {
    return hasQuestion(text)
        && /\b(what(?:'s| is| are)?\s+(?:your\s+)?(?:cats?|dogs?|pets?|bunn(?:y|ies)|rabbits?)'?s?\s+names?|what(?:'s| is)\s+(?:her|his|their)\s+name|what\s+are\s+they\s+called|names?\?)\b/i.test(String(text || ''));
}

function hasFocusStressBridge(text) {
    const s = String(text || '').toLowerCase();
    return /\b(stress|focus|calm|peace|unwind|reset|movement|walk|training|exercise|routine|clear head|mental clarity|after work|energy|switch[-\s]?off|grounded|capacity)\b/i.test(s)
        && (hasQuestion(s) || /\b(tiny|small|low pressure|gentle|mindful|helps)\b/i.test(s));
}

function isChaoticQuietMomentSignal(text) {
    return /\b(chaotic|chaos|quiet moment|calm moment|wishing for a quiet|need a quiet)\b/i.test(String(text || ''))
        && /\b(day|today|moment|quiet|calm|drain|switch off|app building|sunshine|pet)\b/i.test(String(text || ''));
}

function hasChaoticQuietMomentBridge(text) {
    const s = String(text || '').toLowerCase();
    if (/\bwhat does that usually feel like\b/i.test(s)) return false;
    return /\b(quiet moment|calm moment|switch off|reset|unwind|drain|energy|what helps|helps you|tiny|small|break|walk|screen break|space|breathe)\b/i.test(s)
        && (hasQuestion(s) || /\b(worth|helps|tiny|small|protect)\b/i.test(s));
}

function isTediousProjectSignal(text) {
    const s = String(text || '').toLowerCase();
    if (isAppOrWorkoutPlanSupportRequest(s) || isPetOnlyBanter(s)) return false;
    const projectAnchor = /\b(renovat(?:e|ing|ion)|reno\b|diy|flatpack|sanding|paint job|dust sheet|dusty|main structure|house project|garage project|room project|moving house|declutter|massive redesign|client changes|moving parts|project is a beast|project.*beast)\b/i.test(s)
        || (/\bproject\b/i.test(s) && /\b(tedious|dusty|dust|slow|messy|forever|phase|grind|weekend|finished|done|beast|head spin|moving parts|client changes|redesign)\b/i.test(s));
    return projectAnchor
        && /\b(tedious|dusty|dust|mess|chaos|slow|forever|phase|grind|getting through|main structure|done|finished|deserves better|weekend|draining|drained|beast|head spin|moving parts|client changes|redesign)\b/i.test(s);
}

function hasTediousProjectEnergyBridge(text) {
    const s = String(text || '').toLowerCase();
    return (hasQuestion(s) || /\b(tiny|small|helps|worth|survive|keep|momentum)\b/i.test(s))
        && /\b(energy|focus|mental|brain|head|stress|drain(?:ed|ing)?|switch off|unwind|reset|momentum|motivation|patience|overwhelm|sane|capacity|routine|movement|training|body|tired|fatigue|recharge|recover)\b/i.test(s);
}

function isBuilderProjectSignal(text) {
    const s = String(text || '').toLowerCase();
    if (isTrackingAccuracyRequest(s) || /\b(password|reset link|face recognition|face id|login|log in|locked out|old email|spam|manual(?:ly)? reset|uninstall|reinstall)\b/i.test(s)) {
        return false;
    }
    return /\b(coding|developer|dev work|ui|ux|user experience|recommendation engine|fine.?tun(?:e|ing)|tech rabbit hole|wellness app|models?|algorithm|building (?:an? )?(?:app|platform|tool|system)|building .*app|tinkering|solo project|learning curve)\b/i.test(s);
}

function isBuilderEnergyContext(text) {
    return /\b(energy|workouts?|training|ankle|knee|pain|niggle|injur(?:y|ed)|playing up|acting up|consistent|consistency|long coding session|after coding|drain(?:ed|ing)?|movement|cycling|cycle|squat|rehab)\b/i.test(String(text || ''));
}

function hasBuilderOverloadBridge(text) {
    const s = String(text || '').toLowerCase();
    return (hasQuestion(s) || /\b(one thing|tiny|lowest|minimum|worth|helps|start with)\b/i.test(s))
        && /\b(energy|training|workouts?|movement|ankle|knee|pain|rest|recovery|coding|after coding|long sessions?|lowest|tiny|minimum|walk|cycle|cycling|stretch|routine|consistent|consistency|screen|switch off|brain|fried|reset|no.?thinking|interview)\b/i.test(s);
}

function isTemporaryDistractionLongTermSignal(text) {
    const s = String(text || '').toLowerCase();
    return /\b(temporary distraction|distract(?:ion|ing)?|rarely feels like it actually helps|rarely.*helps?.*long.?term|actually helps?.*long.?term|something that actually sticks|something that sticks|looking for something that sticks|helps?.*stick)\b/i.test(s)
        && /\b(mind|brain|racing|buzzing|switch off|quiet|meditat(?:e|ion)|podcast|pupp(?:y|ies)|dog|sleep|unwind|reset)\b/i.test(s);
}

function hasLongTermResetBridge(text) {
    const s = String(text || '').toLowerCase();
    if (!hasQuestion(s)) return false;
    if (/\b(what kind of podcasts?|which podcasts?|true crime|comedy stuff)\b/i.test(s)) return false;
    return /\b(stick|long.?term|actually helps?|beyond distraction|instead of distraction|quiet moments?|mind|brain|racing|buzzing|switch off|reset|unwind|meditat(?:e|ion)|smallest|doable|puppy sleeps?|when.*quiet|helps? even a little)\b/i.test(s)
        && /\b(what|which|how|when|would|could|does|is there anything|anything you)\b/i.test(s);
}

function isPainRecoverySignal(text) {
    const s = String(text || '');
    if (/\bhip[-\s]?hop\b/i.test(s)) return false;
    const hasBodyPainAnchor = /\b(knee|shoulder|hip|ankle|joint|joints|lower back|back pain|sore back|bad back|injur(?:y|ed)|niggle|flare|flaring|playing up|acting up|sore|soreness|overdo)\b/i.test(s);
    if (/\b(such a pain|what a pain|pain in the (?:ass|arse|neck)|this whole thing is such a pain)\b/i.test(s) && !hasBodyPainAnchor) return false;
    if (/\b(deadlifts?|form breaks? down|lower back round(?:ing|s)?|hips? shoot(?:ing)? up|brace|bracing)\b/i.test(s)
        && !/\b(pain|sore|injur(?:y|ed)|niggle|flare|playing up|acting up)\b/i.test(s)) {
        return false;
    }
    return /\b(knee|shoulder|hip|ankle|pain|niggle|injur(?:y|ed)|flare|playing up|bag of peas|ice pack|old thing|careful not to overdo|overdo it|lower back|back pain|sore back|bad back)\b/i.test(s);
}

function hasPainRecoveryProgression(text) {
    const s = String(text || '').toLowerCase();
    const painTerms = /\b(knee|shoulder|hip|ankle|pain|niggle|injur(?:y|ed)|flare(?:s|d)?|flaring|playing up|acting up|old thing|overdo|dial it back|load|range|movement|recovery|recover|warm.?up|soreness|exception|usually|affect your day|limits?|standing|easier|energy|food|lower back|back pain|sore back|bad back)\b/i;
    if (/\b(comes and goes|come and go|new thing|new or old|how long|when did it start|what sets it off)\b/i.test(s)) return true;
    const questionText = s
        .split(/(?<=[?.!])\s+/)
        .filter(hasQuestion)
        .join(' ');
    if (questionText) return painTerms.test(questionText);
    return painTerms.test(s) && /\b(one thing|worth|careful|keep|avoid|ease|protect)\b/i.test(s);
}

function isProcedureRecoverySafetySignal(text) {
    const s = String(text || '');
    return /\b(procedure|surgery|post[-\s]?surgery|post[-\s]?op|operation|recovery|recovering)\b/i.test(s)
        && /\b(back|pain|ache|safe|pressure|mess(?:ing)? up|worried|nervous|pushing too hard|too hard|lighter|machines?|rdls?)\b/i.test(s);
}

function hasProcedureRecoverySafetyBridge(text) {
    const s = String(text || '');
    const safety = /\b(clinician|doctor|gp|physio|surgeon|cleared|clearance|pain.?free|sharp|worse|worsen|pressure|range|lighter|machines?|avoid|stop|dial back|recovery|safe|low.?load|regress|conservative)\b/i.test(s);
    return safety && (hasQuestion(s) || /\b(i'?d|i would|keep|start|stick|avoid|stop|worth|priority)\b/i.test(s));
}

function isMentalNoiseSwitchOffSignal(text) {
    const s = String(text || '');
    if (/\bfocus is on\b/i.test(s) && !/\b(brain|head|mind|background noise|million tabs|switch off|settle down|draining|drained)\b/i.test(s)) {
        return false;
    }
    if (/\bfocus(?:ing|ed)? on what (?:i|we) know\b|\bfocus(?:ing|ed)? on what works\b/i.test(s)
        && !/\b(brain|head|mind|background noise|million tabs|switch off|settle down|draining|drained|hard to focus|can'?t focus|cannot focus)\b/i.test(s)) {
        return false;
    }
    if (/\bfocus(?:ing|ed)? on (?:his|her|their|my|your|our) own thing\b/i.test(s)
        && !/\b(brain|head|mind|background noise|million tabs|switch off|settle down|draining|drained|hard to focus|can'?t focus|cannot focus)\b/i.test(s)) {
        return false;
    }
    const hasMentalAnchor = /\b(brain|head|background noise|million tabs|switch off|settle down|focus|focused|short breaks|breaks)\b/i.test(s)
        || (/\bmind\b/i.test(s) && /\b(racing|busy|won'?t|can'?t|cannot|switch off|settle down)\b/i.test(s));
    return hasMentalAnchor
        && /\b(can'?t|cannot|hard to focus|difficult to focus|struggling to focus|running|noise|juggling|settle|cut through|draining|drained|million tabs|background)\b/i.test(s);
}

function hasMentalResetProgression(text) {
    const s = String(text || '').toLowerCase();
    return /\b(brain|mind|head|noise|tabs|switch off|settle|focus|focused|switch gears|reset|unwind|walk|break|quiet|sleep|write|dump|tiny|small|cut through)\b/i.test(s)
        && (hasQuestion(s) || /\b(one thing|tiny|small|worth|helps|try|start|reset)\b/i.test(s));
}

function isIllnessRecoverySignal(text) {
    const s = String(text || '');
    if (/\blook(?:s|ed)? sick\b/i.test(s)) return false;
    if (/\b(app|tech|workout).{0,40}\bwip(?:ed|e)|\bwip(?:ed|e).{0,40}\b(rest|sets?|data|workout|restart|re-enter|manual(?:ly)?)\b/i.test(s)) return false;
    if (isPainRecoverySignal(s) && !/\b(under the weather|flu|sick|illness|long recovery|recovering from|drains? you|drained|wiped|run down|rest up|proper rest|push through)\b/i.test(s)) {
        return false;
    }
    if (isProcedureRecoverySafetySignal(s) && !/\b(under the weather|flu|cold|sick|ill|illness|drains? you|drained|wiped|run down)\b/i.test(s)) {
        return false;
    }
    return /\b(under the weather|flu|cold|sick|ill|illness|long recovery|recovering|recovery|drains? you|drained|wiped|run down|rest up|proper rest|push through)\b/i.test(s);
}

function hasIllnessRecoveryProgression(text) {
    const s = String(text || '').toLowerCase();
    return /\b(rest|recovery|recover|flu|cold|sick|drained|wiped|energy|work|family|commitments?|push through|back burner|support|sleep|tiny|lowest|easier|switch off)\b/i.test(s)
        && (hasQuestion(s) || /\b(one thing|tiny|lowest|minimum|worth|helps|easy|easier)\b/i.test(s));
}

function isAcutePersonalCrisisSignal(text) {
    return /\b(rough family thing|family thing|grief|grieving|loss|lost someone|bereav(?:ed|ement)|funeral|bad news|hospital|drained|overwhelmed by everything)\b/i.test(String(text || ''));
}

function hasNoPressureSupport(text) {
    const s = String(text || '').toLowerCase();
    return /\b(no need to rush|no rush|take your time|don'?t need to reply|no need to reply|thinking of you|here if|hope you'?re okay|sending love|that sounds really tough)\b/i.test(s)
        && !isChallengeOfferWarningText(s);
}

function isSelfSufficientProgressSignal(text) {
    const s = String(text || '');
    if (/\benjoy (?:your|the) stuff\b/i.test(s)) return false;
    if (/\benjoy\b/i.test(s) && /\b(vegan|spot|food|nuggets?|burgers?|pasta|pizza|meal|album|music|song)\b/i.test(s)) return false;
    return /\b(enjoy(?: it|ing)?|doesn'?t feel like a chore|not a chore|seeing progress|keeps me motivated|good balance|feeling strong|energized|self-sufficient|i know what works|routine feels good|keeps things fresh)\b/i.test(s);
}

function hasSelfSufficientNextEdgeProgression(text) {
    const s = String(text || '').toLowerCase();
    return /\b(next|chasing|aim|target|goal|progress|stronger|strength|performance|pr|pb|excited|stale|fresh|edge|weak point|challenge|improve|what would make|where do you want|what are you working toward|what keeps it interesting)\b/i.test(s)
        && (hasQuestion(s) || /\b(one thing|worth|sounds like|useful|next layer)\b/i.test(s));
}

function isTimeCapacityBarrierSignal(text) {
    return /\b(not sure i have the time|don'?t have the time|no time|time poor|low energy|energy low|no energy left|no energy for|energy left for|juggling a lot|too busy|capacity|not sure.*time|never enough hours|not enough hours|not enough time|everything.*never enough|work,?\s+errands|life stuff|feels? never[-\s]?ending|never[-\s]?ending list|personal projects?.*fall apart|falling apart|brain fried|fried from|headspace)\b/i.test(String(text || ''));
}

function hasTimeCapacityBridge(text) {
    const s = String(text || '').toLowerCase();
    return /\b(time|capacity|energy|low.?energy|juggling|busy|tiny|smallest|lowest|low.?pressure|5%|five percent|fit|movement|week|support|easier|no.?thinking|next step|bad week|chaotic day|chaos|quick meals?|save the day|cooking|healthy eating|food|first thing.{0,40}eats? up.{0,30}hours|what'?s usually the first thing.{0,60}hours)\b/i.test(s)
        && (hasQuestion(s) || /\b(one thing|tiny|smallest|lowest|worth|helps|low pressure|no pressure|no.?thinking|next step)\b/i.test(s));
}

function isFoodAfterthoughtCapacitySignal(text) {
    const s = String(text || '');
    const foodSignal = /\b(forgot to eat|forget to eat|food.*afterthought|eating.*afterthought|no time to stop|dizzy|fuel up|fuel|quick healthy food|quick,? healthy|temporary setup.*routine)\b/i.test(s);
    const capacitySignal = /\b(job|work|demanding|focused|focus|move|moving|city|routine|busy|time)\b/i.test(s);
    return foodSignal && capacitySignal;
}

function hasFoodAfterthoughtProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\b(routine settles?|settles? down|once you'?re in the new city|go-to type of meal|favourite spot|favorite spot|usually look for|pick them up from wherever)\b/i.test(s)) {
        return false;
    }
    const practicalFoodAnchor = /\b(food|eat|eating|meal|snack|fuel|protein|salad|poke|bowl|fresh|grab|backup|fallback|anchor|no.?thinking|reminder|minimum|non.?negotiable|before (?:you )?get dizzy|stop and think|survive|busy day|workday|desk|bag|keep on hand)\b/i.test(s);
    const capacityBridge = /\b(time|busy|demanding|focused|focus|move|moving|routine|capacity|energy|easier|low.?pressure|simple|tiny|smallest)\b/i.test(s);
    return practicalFoodAnchor && capacityBridge && (hasQuestion(s) || /\b(try|keep|make|start|use|worth|helps|simple|tiny|backup|fallback|anchor)\b/i.test(s));
}

function isLostPastFitnessSignal(text) {
    const s = String(text || '');
    return /\b(used to be so active|miss(?:ed|ing)? (?:being )?(?:active|fit|strong)|hard to even remember that feeling|hard to remember that feeling|body dictates|miss just being spontaneous)\b/i.test(s)
        || (/\b(felt amazing|clear head|strong and capable|tackle anything)\b/i.test(s)
            && /\b(active|fitness|energy|clear head|strong|capable|spontaneous)\b/i.test(s));
}

function hasLostPastFitnessProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\bwhat usually .*get(?:s|ting)?.*\b(?:way|stop|block)|what.*getting in the way|what.*stopping you\b/i.test(s)) return false;
    return (hasQuestion(s) || /\b(tiny|smallest|lowest|first|worth|start)\b/i.test(s))
        && /\b(energy|clear head|strong|capable|active|fit|spontaneous|feeling|back first|want back|tiny|smallest|lowest|low.?pressure|5%|five percent|first piece|version)\b/i.test(s);
}

function isChallengePositiveFeedbackSignal(text) {
    return /\b(first session was great|session was great|workout was such a good mental break|workouts? have been a lifesaver|keeping me sane|just finished another one|glad i did|good mental break|needed that escape)\b/i.test(String(text || ''));
}

function hasChallengePositiveProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\bwhat are you keen to work on next|what'?s next|what do you want to work on next\b/i.test(s)) return false;
    return (hasQuestion(s) || /\b(keep|protect|repeat|build on|lock in|use that)\b/i.test(s))
        && /\b(what worked|what made it|mental break|reset|escape|lifesaver|keeping you sane|sane|push to get started|glad you did|next one|repeat|keep that|same window|energy|head|clear|stress)\b/i.test(s);
}

function isCasualTrainingBanterSignal(text) {
    const s = String(text || '').toLowerCase();
    if (isProcedureRecoverySafetySignal(s)) return false;
    return /\b(chest day|pump|gaming|warzone|recover|recovery|next sesh|session|gym later|with the boys|sparring|muay thai|boxing|martial arts|proper workout)\b/i.test(s)
        || (/\b(looks sick|looked sick|looks intense|looked intense)\b/i.test(s) && /\b(sparring|workout|training|gym|session)\b/i.test(s))
        || (/\bswitch off\b/i.test(s) && /\b(gym|training|workout|gaming|warzone|recover|recovery|session|boys)\b/i.test(s));
}

function hasCasualTrainingProgression(text) {
    const s = String(text || '').toLowerCase();
    if (hasPainRecoveryProgression(s)) return true;
    return /\b(recover|recovery|sleep|upper chest|plateau|progress|program|plan|next sessions?|sessions?|training|volume|sets?|reps?|pump|routine|chasing|goal|weak point|deload|sparring|muay thai|boxing|martial arts|heart rate|trained|train)\b/i.test(s)
        && (hasQuestion(s) || /\b(quick thought|one thing|worth|helps|keep|plan|use|try)\b/i.test(s));
}

function isSimpleSustainableNoTimeSignal(text) {
    const s = String(text || '');
    return /\b(conflicting info|sheer volume|keto is king|plant.?based only|intense workout plans?|impossible to keep up|barely have time to breathe|simple and sustainable|another full.?time job|practical,? quick|complicated routine|abandon because i have no time)\b/i.test(s);
}

function hasSimpleSustainableNoTimeProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\b(if you could make one thing simpler|what would be the biggest win|what kind of routines have you tried|tried in the past)\b/i.test(s)
        && !/\b(minimum|tiny|quick|no.?thinking|low.?pressure|10\s*min|ten\s*min|simple structure|practical|sustainable|fallback|stick|busy week)\b/i.test(s)) {
        return false;
    }
    return /\b(simple|sustainable|practical|quick|minimum|tiny|no.?thinking|low.?pressure|10\s*min|ten\s*min|5\s*min|five\s*min|fallback|busy week|one thing|stick|full.?time job|less complicated|decision|structure|habit floor)\b/i.test(s)
        && (hasQuestion(s) || /\b(start|use|try|keep|worth|make it easier|one thing)\b/i.test(s));
}

function isCreativeTasteSubstanceSignal(text) {
    return /\b(actual substance|recycled beats|proper indie|old-school hip hop|psych-rock|killer psych|takes effort|manufactured|chasing trends|creative energy|formula)\b/i.test(String(text || ''));
}

function hasCreativeTasteProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\b(any bands in particular|bands .* lately|what kind of music usually gets you hyped|how do you usually stumble on new artists|finding new artists|sounds that resonate)\b/i.test(s)
        && !/\b(substance|effort|manufactured|creative|trend|formula|what makes|why|training|standard|standards?|body|performance|progress)\b/i.test(s)) {
        return false;
    }
    return /\b(substance|effort|manufactured|creative|trend|formula|recycled|proper|what makes|why|album|artist|band|sound|song|lyrics|production|pulls you back|training|standard|standards?|trust your own|your own judgement|own judgment|decide for yourself|independent|performance|progress)\b/i.test(s)
        && (hasQuestion(s) || /\b(exactly|that contrast|interesting)\b/i.test(s));
}

function isRecoveryRoutineRhythmSignal(text) {
    const s = String(text || '');
    if (isProcedureRecoverySafetySignal(s)) return false;
    const recoveryRoutine = /\b(recovery|foam roll(?:ing)?|stretch(?:ing)?|protein|light stretch|consistent routine|routine locked|stick to (?:a )?(?:pretty )?consistent routine)\b/i.test(s);
    const rhythmCost = /\b(next session feels harder|session feels harder|takes longer|throws off my rhythm|rhythm gets thrown off|consistent rhythm|rhythm is key|harder next session|recover(?:y)? takes longer)\b/i.test(s);
    return recoveryRoutine || rhythmCost;
}

function hasRecoveryRoutineRhythmProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\bdo you notice a big difference\b/i.test(s)
        && !/\b(next sessions?|sessions?|protein|stretch|foam|sleep|rhythm|fallback|protect|slips?|non.?negotiable)\b/i.test(s)) {
        return false;
    }
    if (/\b(can't stick to it|what usually throws that rhythm off)\b/i.test(s)
        && !/\b(recovery|session|protein|stretch|foam|sleep|routine|rhythm|fallback|protect|slips?|non.?negotiable)\b/i.test(s)) {
        return false;
    }
    return /\b(recovery|next sessions?|sessions?|knee|flare|next session|foam|stretch|protein|sleep|routine|rhythm|warm.?down|cool.?down|fallback|protect|slips?|miss(?:ed|ing)?|non.?negotiable|harder|takes longer|sprint|training week)\b/i.test(s)
        && (hasQuestion(s) || /\b(one thing|worth|protect|fallback|keep|make it easier)\b/i.test(s));
}

function isBusyGymFallbackSignal(text) {
    const s = String(text || '');
    const busyGym = /\b(equipment (?:being )?busy|gym'?s busy|machines? .*taken|weights? .*taken|whatever'?s free|can'?t consistently hit|same machines?|same weights?|partner needs to focus|partner'?s training|work schedules?.*unpredictable|all over the place)\b/i.test(s);
    const progressAnchor = /\b(general strength|not getting totally out of shape|not lose all my progress|hold onto|progress|strength|routine|consistent(?:ly)?|specific)\b/i.test(s);
    return busyGym && progressAnchor;
}

function hasBusyGymFallbackProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\bwhat does that usually look like.*day-to-day|what does that look like.*day-to-day|normal day\b/i.test(s)) return false;
    return /\b(fallback|plan b|backup|swap|substitute|alternate|template|same movement pattern|machine|equipment|weights?|busy gym|taken|partner|schedule|full.?body|general strength|strength|out of shape|progress|consistent|minimum session|if .* taken|when .* taken)\b/i.test(s)
        && (hasQuestion(s) || /\b(one thing|simple|worth|use|keep|protect|build)\b/i.test(s));
}

function isHomeGymTransitionSignal(text) {
    const s = String(text || '');
    const gearAnchor = /\b(home setup|old setup|old place|gym vibe|full racks?|machines?|dumbbells?|resistance bands?|mat|iron den|gym.*closed|place.*closes?)\b/i.test(s);
    const lossAnchor = /\b(flat|limited|not the same|without the old setup|no real energy|progress|buzz|routine|gear|space|home)\b/i.test(s);
    return gearAnchor && lossAnchor;
}

function hasHomeGymTransitionProgression(text) {
    const s = String(text || '').toLowerCase();
    if (!hasQuestion(s) && !/\b(try|use|build|keep|start|fallback|template)\b/i.test(s)) return false;
    return /\b(dumbbells?|bands?|mat|home|limited|fallback|template|progress|energy|old gym|iron den|routine|space|gear|full.?body|swap|movement pattern|make it feel|small win|strength)\b/i.test(s);
}

function isGenericHomeGymVibeQuestion(text) {
    const s = String(text || '').toLowerCase();
    if (!hasQuestion(s)) return false;
    return /\b(what was it about (?:the )?gym vibe|what made (?:the )?gym.*(?:easier|better)|what did you miss about (?:the )?(?:gym|old setup)|what was it about .*going somewhere)\b/i.test(s)
        && !/\b(home|dumbbells?|bands?|fallback|template|minimum|swap|movement pattern|progress|plan|equipment|lighter)\b/i.test(s);
}

function isMomentumLossAfterTryingSignal(text) {
    return /\b(lose momentum after a bit|lost momentum after a bit|lose momentum|tried a few things|tried things before|always end up stopping|end up stopping|hard to stick with things|hard to stay consistent|keep you on track)\b/i.test(String(text || ''));
}

function hasMomentumLossAfterTryingProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\bwhat kind of things have you tried|what have you tried|tried before that.*stick|what usually helps you get back\b/i.test(s)) return false;
    return /\b(momentum|stick|stopping point|where it drops|drops off|week two|after a bit|accountability|check.?ins?|habit tracking|small wins|structure|keep you on track|follow.?through|restart|make it easier|what would keep|support)\b/i.test(s)
        && (hasQuestion(s) || /\b(daily|small wins|that is exactly|one thing|worth|helps)\b/i.test(s));
}

function isHypermobilityRoutineSignal(text) {
    const s = String(text || '');
    return /\b(hypermobility|hypermobile|joint laxity)\b/i.test(s)
        || (/\bmobility\b/i.test(s) && /\b(strong|strength|pain.?free|without pain|routine|daily life|sit too long)\b/i.test(s));
}

function hasHypermobilityProgression(text) {
    const s = String(text || '').toLowerCase();
    if (/\b(did you figure|figure out that routine|someone help|biggest errors|learned from)\b/i.test(s)) return false;
    if (/\b(one thing|what'?s one thing|make sure to keep|no matter how crazy|crazy things get|when things get crazy)\b/i.test(s)
        && !/\b(hypermobility|hypermobile|stable|stability|joint|pain.?free|flare|range|safe|protect)\b/i.test(s)) {
        return false;
    }
    return /\b(stable|stability|pain.?free|without pain|joints?|mobility|strong|strength|daily life|sit too long|flare|safe|non.?negotiable|keeps you|helps you|current routine|maintain|protect)\b/i.test(s)
        && (hasQuestion(s) || /\b(worth|smart|keep|protect|maintain|non.?negotiable)\b/i.test(s));
}

function hasAnimalPassionProgression(text) {
    const s = String(text || '').toLowerCase();
    if (!hasQuestion(s)) return false;
    return /\b(what|how|where|when|which).*\b(bunn(?:y|ies)|animals?|shelter|sanctuary|volunteer|rescue|pip|squeak|dream|world|started|got you)\b/i.test(s);
}

function isPoliteClosingSignal(text) {
    const s = String(text || '');
    return /\b(bye|goodbye|thanks|thank you|you too|enjoy|have a good|hope you|talk soon|catch you|appreciate it|good luck)\b/i.test(s)
        && !/\b(but|hard|difficult|drained|overwhelmed|work|family|rest|trying|can'?t|cannot|commitments?)\b/i.test(s)
        && !hasQuestion(s);
}

function isRoutineProbe(text) {
    return /\b(go-to|usual|usually|routine|habit|what do you do|what do you usually)\b/i.test(String(text || ''));
}

function isLeadOptOutOrAccidentalText(text) {
    const s = String(text || '').trim().toLowerCase();
    return /^(bye|goodbye|nah|no thanks|not interested|wrong person|oops|sorry wrong chat|accident|accidental)$/i.test(s);
}

function isLowBandwidthExitSignal(text) {
    return /\b(gotta jump|got to jump|have to jump|need to jump|back into it|back to it|back in|swamped|barely have a sec|no time|talk later|chat later|catch you later|i'?ll leave you to it|gotta run|have to run|busy here|busy with this)\b/i.test(String(text || ''));
}

function isAcceptedNoReplyConversation({ persona, history = [] } = {}) {
    const firstLead = history.find(item => item.role === 'lead' && !item.no_reply);
    const coachMessages = history.filter(item => item.role === 'coach' && !item.no_reply);
    const last = history[history.length - 1];
    if (!firstLead || !last?.no_reply || !coachMessages.length) return false;
    const lastCoachIndex = history.map(item => item.role).lastIndexOf('coach');
    const leadBeforeLastCoach = lastCoachIndex > 0
        ? [...history.slice(0, lastCoachIndex)].reverse().find(item => item.role === 'lead' && !item.no_reply)
        : null;

    const personaText = [
        persona?.hookContext,
        persona?.hiddenProfile,
        persona?.storyNotes,
    ].filter(Boolean).join(' ');
    const zeroIntentPersona = /\b(zero intent|intent to engage is genuinely zero|accidental|accidentally|trying to dismiss|navigate away|not looking for|not interested)\b/i.test(personaText);
    const clearExit = isLeadOptOutOrAccidentalText(firstLead.text);
    const gracefulLateExit = leadBeforeLastCoach
        && (isPoliteClosingSignal(leadBeforeLastCoach.text) || isLowBandwidthExitSignal(leadBeforeLastCoach.text));
    if (!zeroIntentPersona && !clearExit && !gracefulLateExit) return false;

    const coachText = coachMessages.map(item => item.text || '').join('\n');
    const respectedExit = !isChallengeOfferWarningText(coachText)
        && !/\b(send|sent|try|join|start).{0,30}\b(challenge|link|program)\b/i.test(coachText);
    return respectedExit;
}

function suppressAcceptedNoReplyTurnIssues(turnIssues = [], { persona, history = [] } = {}) {
    if (!isAcceptedNoReplyConversation({ persona, history })) return turnIssues;
    const allowedExitNoise = new Set(['too_generic', 'no_progression', 'validation_loop']);
    return turnIssues
        .map(issue => ({
            ...issue,
            issues: (issue.issues || []).filter(flag => !allowedExitNoise.has(flag)),
        }))
        .filter(issue => issue.issues.length);
}

function adjustScorecardForAcceptedNoReply(scorecard, { persona, history = [] } = {}) {
    const normalized = normalizeScorecard(scorecard);
    if (!isAcceptedNoReplyConversation({ persona, history })) return normalized;
    const riskFlags = normalized.risk_flags.filter(flag => flag !== 'ghosted');
    return normalizeScorecard({
        ...normalized,
        felt_human: Math.max(normalized.felt_human, 8.2),
        heard_first: Math.max(normalized.heard_first, 8.4),
        context_use: Math.max(normalized.context_use, 8),
        not_boring: Math.max(normalized.not_boring, 7.5),
        not_salesy: Math.max(normalized.not_salesy, 9.5),
        question_quality: Math.max(normalized.question_quality, 8.5),
        invite_timing: Math.max(normalized.invite_timing, 10),
        likely_reply: Math.max(normalized.likely_reply, 4),
        overall: Math.max(normalized.overall, 8.6),
        risk_flags: riskFlags,
        likely_outcome: normalized.likely_outcome || 'respected opt-out / accepted no reply',
        weakest_moment: normalized.weakest_moment && normalized.weakest_moment !== 'ghosted'
            ? normalized.weakest_moment
            : 'lead had no intent to engage, no reply is acceptable',
        prompt_rule_suggestion: normalized.prompt_rule_suggestion || 'Treat clear opt-outs and accidental DMs as polite exits, not failed conversions.',
    });
}

function isNaturalClarifyingQuestionPair(questionSentences = []) {
    if (questionSentences.length !== 2) return false;
    const rawJoined = questionSentences.join(' ').toLowerCase();
    if (/\bwhat makes it feel like\b/i.test(rawJoined)
        && /\bis it\b/i.test(rawJoined)
        && /\b(planning|shopping|finding|trying|everyone|actually eat|equipment|time|energy)\b/i.test(rawJoined)) {
        return true;
    }
    const questionCores = questionSentences.map(sentence => {
        const raw = String(sentence || '');
        const matches = [...raw.matchAll(/(?:^|[\n.!]\s*)(what|why|how|when|where|which|who|do|does|did|is|are|was|were|has|have|can|could|would|should)\b[\s\S]*\?/gi)];
        if (!matches.length) return raw;
        return matches[matches.length - 1][0].replace(/^[\n.!?\s]+/, '');
    });
    const joined = questionCores.join(' ').toLowerCase();
    const words = joined.split(/\s+/).filter(Boolean);
    if (words.length > 24) return false;
    const firstQuestion = String(questionCores[0] || '');
    const secondQuestion = String(questionCores[1] || '');
    const secondAsOptionList = secondQuestion
        .replace(/^[\s"']*(?:is it|is that|are you|are they|was it|were they|more)\b[\s,:-]*/i, '')
        .replace(/\bor something else\b/i, '');
    if (/\b(what|which|how)\b/i.test(firstQuestion)
        && /\bor\b/i.test(secondQuestion)
        && !/\b(what|why|how|when|where|which|who|do|does|did|can|could|would|should)\b/i.test(secondAsOptionList)) {
        return true;
    }
    if (/^like,?\s+/i.test(String(questionSentences[1] || ''))) return true;
    if (/what'?s got you thinking|what got you thinking/i.test(String(questionSentences[0] || ''))
        && /^more\b.*\bor\b/i.test(String(questionSentences[1] || ''))) {
        return true;
    }
    if (/\b(is|are|was|were|has|have)\s+(he|she|it|they)\s+still\b/i.test(questionSentences[1])) return true;
    if (/\b(what|which)\b/i.test(questionSentences[0])
        && /,/.test(questionSentences[1])
        && /\bor\b/i.test(questionSentences[1])
        && !/\b(what|why|how|when|where|which|who|do|does|did|is|are|can|could|would|should)\b/i.test(questionSentences[1].replace(/\bor something else\b/i, ''))) {
        return true;
    }
    if (/\b(what|which|where|how)\b/i.test(questionSentences[0])
        && /,/.test(questionSentences[1])
        && wordCount(questionSentences[1]) <= 12
        && !/\b(what|why|how|when|where|which|who|do|does|did|is|are|can|could|would|should)\b/i.test(questionSentences[1])) {
        return true;
    }
    return /\b(knee|shoulder|back|pain|niggle|injury|flare|playing up|joints?|stiffness|aching|hands?|stale|routine|plan|menace|chaos|pet|rabbit|dog|cat)\b/i.test(joined)
        && /\b(has|is|was|does|did|do|are|have|what'?s|where)\b/i.test(questionSentences[1]);
}

function isRhetoricalQuestionFragment(sentence) {
    const s = String(sentence || '').trim().toLowerCase().replace(/[?!.\s]+$/g, '');
    if (!s) return false;
    if (/,\s*(is it|isn'?t it|aren'?t they|don'?t they|doesn'?t it|right|hey|eh)$/.test(s)) return true;
    if (/^and that feeling\b/.test(s)) return true;
    if (/\bwhat'?s the point\b/i.test(s) && (wordCount(s) <= 16 || /['"`][^'"`]*what'?s the point\b/i.test(s))) return true;
    if (/\bright$/.test(s) && wordCount(s) <= 8 && /^(yeah|haha+|hahaha|that'?s|it'?s|sounds|classic|wild|rough|dream|goal)\b/i.test(s)) return true;
    if (/\banother one$/.test(s) && wordCount(s) <= 4) return true;
    if (wordCount(s) > 5) return false;
    return /^(haha+|haha right|hahaha right|right|yeah right|eh|that'?s the goal right|chat bot hey|fair hey|rough hey|wild hey|classic hey|good question|sounds good|seriously|for real|no kidding)$/i.test(s);
}

function detectCoachTurnIssues({ coachText, leadText, qualifier, leadStage = 'qualifying', leadReplyCount } = {}) {
    const text = String(coachText || '').trim();
    const issues = [];
    const normalizedLeadReplyCount = Math.max(0, Math.round(Number(
        leadReplyCount ?? qualifier?.meaningful_lead_reply_count ?? countMeaningfulLeadReplies([], leadText)
    ) || 0));
    const earnedChallengeInviteSignal = hasEarnedChallengeInviteMoment({
        qualifier,
        currentMessage: leadText,
        leadReplyCount: normalizedLeadReplyCount,
    });
    const programExplanationRequest = isProgramExplanationRequest(leadText);
    const answeredProgramExplanation = programExplanationRequest && hasProgramExplanationSpecifics(text);
    const trackingAccuracyRequest = isTrackingAccuracyRequest(leadText);
    const answeredTrackingAccuracy = trackingAccuracyRequest && hasTrackingAccuracyAdvice(text);
    const advancedBiohackRequest = isAdvancedBiohackAdviceRequest(leadText);
    const answeredAdvancedBiohack = advancedBiohackRequest && hasAdvancedBiohackBoundary(text);
    const directAdviceRequest = isDirectAdviceRequest(leadText);
    const answeredDirectAdvice = directAdviceRequest && (hasActionableAdvice(text) || answeredTrackingAccuracy || answeredAdvancedBiohack);
    const mindMuscleCueRequest = isMindMuscleCueRequest(leadText);
    const answeredMindMuscleCue = mindMuscleCueRequest && hasMindMuscleCueTip(text);
    const bracingCueRequest = isBracingCueSignal(leadText);
    const answeredBracingCue = bracingCueRequest && hasBracingCueTip(text);
    const deadliftFormBreakdown = isDeadliftFormBreakdownSignal(leadText);
    const answeredDeadliftFormBreakdown = deadliftFormBreakdown && hasDeadliftFormProgression(text);
    const procedureRecoverySafety = isProcedureRecoverySafetySignal(leadText);
    const answeredProcedureRecoverySafety = procedureRecoverySafety && hasProcedureRecoverySafetyBridge(text);
    const unresolvedPlateauSignal = isUnresolvedPlateauSignal(leadText);
    if (!text) {
        issues.push('empty_coach_reply');
        return issues;
    }
    if (isLeadOptOutOrAccidentalText(leadText)) {
        if (isChallengeOfferWarningText(text)) {
            issues.push('premature_challenge_invite');
            issues.push('too_salesy');
        }
        if (/\b(ai|automation|model|trained on|gemini|vertex|chatgpt)\b/i.test(text)) {
            issues.push('ai_disclosure_risk');
        }
        return [...new Set(issues)];
    }
    if (isChallengeOfferWarningText(text) && !hasChallengeInviteReadinessSignal(leadText) && !earnedChallengeInviteSignal) {
        issues.push('possible_premature_challenge_invite');
    }
    if (isPrematureChallengeInvite({
        draftText: text,
        currentMessage: leadText,
        qualifier,
        leadStage,
        linkedUserId: null,
        leadReplyCount: normalizedLeadReplyCount,
    })) {
        issues.push('premature_challenge_invite');
    }
    const questionSentences = text
        .split(/(?<=[?.!])\s+/)
        .map(s => s.trim())
        .filter(hasQuestion);
    const substantiveQuestionSentences = questionSentences.filter(sentence => !isRhetoricalQuestionFragment(sentence));
    if (substantiveQuestionSentences.length > 1 && !isNaturalClarifyingQuestionPair(substantiveQuestionSentences)) {
        issues.push('too_many_questions');
    }
    if (substantiveQuestionSentences.some(isUnsafeStockDiscoveryQuestion)) {
        issues.push('stock_discovery_question');
    }
    if (/\bwhat are your goals\b/i.test(text)) {
        issues.push('generic_goal_question');
    }
    if (isAcutePersonalCrisisSignal(leadText) && hasNoPressureSupport(text)) {
        return [...new Set(issues)];
    }
    if (directAdviceRequest && !answeredDirectAdvice && !answeredProgramExplanation) {
        issues.push('ignored_direct_question');
    }
    if (trackingAccuracyRequest && !answeredTrackingAccuracy) {
        issues.push('ignored_direct_question');
        issues.push('no_progression');
    }
    if (mindMuscleCueRequest && !answeredMindMuscleCue) {
        issues.push('ignored_direct_question');
    }
    if (bracingCueRequest && !answeredBracingCue) {
        issues.push('ignored_direct_question');
        issues.push('no_progression');
    }
    if (deadliftFormBreakdown && !answeredDeadliftFormBreakdown) {
        issues.push('no_progression');
        if (hasQuestion(text)) {
            issues.push('too_generic');
        }
    }
    if (advancedBiohackRequest && !answeredAdvancedBiohack) {
        issues.push('ignored_direct_question');
        issues.push('no_progression');
    }
    if (procedureRecoverySafety && !answeredProcedureRecoverySafety) {
        issues.push('validation_loop');
        issues.push('no_progression');
    }
    if (programExplanationRequest && !answeredProgramExplanation) {
        issues.push('ignored_direct_question');
    }
    if (directAdviceRequest && isChallengeOfferWarningText(text) && !answeredDirectAdvice) {
        issues.push('premature_challenge_invite');
    }
    if (programExplanationRequest && isChallengeOfferWarningText(text) && !answeredProgramExplanation) {
        issues.push('premature_challenge_invite');
        issues.push('missed_specific_hook');
        issues.push('no_progression');
    }
    if (unresolvedPlateauSignal && isChallengeOfferWarningText(text) && !hasPlateauDiagnosticProgression(text)) {
        issues.push('premature_challenge_invite');
        issues.push('missed_specific_hook');
        issues.push('no_progression');
    }
    if (isPlateauAdviceRequest(leadText) && !hasConcretePlateauAngle(text)) {
        issues.push('ignored_direct_question');
        issues.push('no_progression');
    }
    if (isAdvancedPlantBasedSignal(leadText) && !hasPlantBasedProcessProgression(text)) {
        issues.push('missed_specific_hook');
        issues.push('too_generic');
        if (!hasQuestion(text)) {
            issues.push('no_progression');
        }
    }
    if (isVeganEthicalChallengeToVegetarianism(leadText)) {
        if (mishandlesVeganEthicalChallenge(text)) {
            issues.push('missed_specific_hook');
            issues.push('too_generic');
        }
        if (!hasPlantBasedProcessProgression(text)) {
            issues.push('no_progression');
        }
    }
    if (isEthicalFoundationSignal(leadText) && trivializesEthicalFoundation(text)) {
        issues.push('missed_specific_hook');
        issues.push('too_generic');
    }
    if (isEthicalFoundationSignal(leadText) && !hasEthicalFoundationProgression(text)) {
        issues.push('missed_specific_hook');
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isAppOrWorkoutPlanSupportRequest(leadText) && isChallengeOfferWarningText(text)) {
        issues.push('premature_challenge_invite');
        issues.push('missed_specific_hook');
        issues.push('no_progression');
    }
    if (isPlantBasedFamilyMealPlanningSignal(leadText) && isChallengeOfferWarningText(text) && !hasChallengeInviteReadinessSignal(leadText)) {
        issues.push('premature_challenge_invite');
        issues.push('no_progression');
    }
    if (isPlantBasedFamilyMealPlanningSignal(leadText) && !hasPlantBasedFamilyMealProgression(text) && !isChallengeOfferWarningText(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isPlantBasedFamilyMealPlanningSignal(leadText) && isGenericFamilyGoToMealProbe({ leadText, coachText: text })) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isSimpleWorkoutPlanPreferenceSignal(leadText) && !isSimpleSustainableNoTimeSignal(leadText) && !isHomeGymTransitionSignal(leadText) && !hasSimpleWorkoutPlanProgression(text)) {
        issues.push('validation_loop');
        issues.push('no_progression');
    }
    if (isLowEnergyLeadReply(leadText) && isBlandSmallTalkChase(text) && !hasLowEnergySave(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
        if (hasQuestion(text)) {
            issues.push('stock_discovery_question');
        }
    }
    if (isLowEnergyLeadReply(leadText) && isValidationOnlyChase(text) && !hasLowEnergySave(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isCaregiverExhaustionSignal(leadText) && isGenericExhaustionCommiseration(text) && !hasSpecificExhaustionProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isMovingIsolationSignal(leadText) && !hasMovingIsolationProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isSwampedLifestyleDeferralSignal(leadText) && !hasSwampedLifestyleProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isOverloadedMovementSignal(leadText) && !isMomentumLossAfterTryingSignal(leadText) && !trackingAccuracyRequest && !hasLowestBarMovementBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isReciprocalPersonalQuestion(leadText) && !hasReciprocalPersonalBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isTravelViewLoopSignal(leadText) && isGenericTravelViewQuestion(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isNostalgiaMemoryLoopSignal(leadText) && !hasNostalgiaCurrentNeedBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isVagueCreativeChaosBanter(leadText) && !hasCreativeChaosProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isTemporaryDistractionLongTermSignal(leadText) && !hasLongTermResetBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isPainRecoverySignal(leadText) && !answeredDirectAdvice && !answeredMindMuscleCue && !answeredBracingCue && !hasPainRecoveryProgression(text)) {
        issues.push('no_progression');
    }
    if (isMentalNoiseSwitchOffSignal(leadText) && !hasMentalResetProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isIllnessRecoverySignal(leadText) && !hasIllnessRecoveryProgression(text)) {
        if (!hasQuestion(text)) {
            issues.push('too_generic');
        }
        issues.push('no_progression');
    }
    if (isSelfSufficientProgressSignal(leadText) && !isHypermobilityRoutineSignal(leadText) && !hasSelfSufficientNextEdgeProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isLostPastFitnessSignal(leadText) && !hasLostPastFitnessProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isChallengePositiveFeedbackSignal(leadText) && !hasChallengePositiveProgression(text)) {
        if (!hasQuestion(text)) issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isTimeCapacityBarrierSignal(leadText) && !hasTimeCapacityBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isFoodAfterthoughtCapacitySignal(leadText) && !hasFoodAfterthoughtProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isSimpleSustainableNoTimeSignal(leadText) && !hasSimpleSustainableNoTimeProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isPetOnlyBanter(leadText) && isPetOnlyBanter(text) && hasQuestion(text) && !isPetNameQuestion(text) && !hasPetDeflectionBridge(text) && !hasFocusStressBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isPetDeflectionSignal(leadText) && isPetOnlyBanter(text) && !isPetNameQuestion(text) && !hasPetDeflectionBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isPetCalmFocusSignal(leadText) && isPetOnlyBanter(text) && !isPetNameQuestion(text) && !hasFocusStressBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isChaoticQuietMomentSignal(leadText) && !hasChaoticQuietMomentBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isTediousProjectSignal(leadText) && !hasTediousProjectEnergyBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isBuilderProjectSignal(leadText) && !hasBuilderOverloadBridge(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isCasualTrainingBanterSignal(leadText) && !hasCasualTrainingProgression(text) && !hasChallengeInviteReadinessSignal(leadText)) {
        issues.push('no_progression');
    }
    if (isCreativeTasteSubstanceSignal(leadText) && !hasCreativeTasteProgression(text)) {
        issues.push('no_progression');
    }
    if (isRecoveryRoutineRhythmSignal(leadText) && !unresolvedPlateauSignal && !hasRecoveryRoutineRhythmProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isBusyGymFallbackSignal(leadText) && !hasBusyGymFallbackProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isHomeGymTransitionSignal(leadText) && isGenericHomeGymVibeQuestion(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    } else if (isHomeGymTransitionSignal(leadText) && !hasHomeGymTransitionProgression(text)) {
        issues.push('validation_loop');
        issues.push('no_progression');
    }
    if (isMomentumLossAfterTryingSignal(leadText) && !hasMomentumLossAfterTryingProgression(text) && !isChallengeOfferWarningText(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isHypermobilityRoutineSignal(leadText) && !hasHypermobilityProgression(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (isAnimalPassionSignal(leadText) && !hasAnimalPassionProgression(text)) {
        issues.push('missed_specific_hook');
        issues.push('no_progression');
    }
    if (isPoliteClosingSignal(leadText) && isRoutineProbe(text)) {
        issues.push('too_generic');
        issues.push('no_progression');
    }
    if (/\b(ai|automation|model|trained on|gemini|vertex|chatgpt)\b/i.test(text)) {
        issues.push('ai_disclosure_risk');
    }
    return [...new Set(issues)];
}

function transcriptToText(history = []) {
    return history
        .map(item => item.no_reply ? `${item.speaker}: [no reply / left on seen]` : `${item.speaker}: ${item.text}`)
        .join('\n');
}

function historyToIgMessages(history = []) {
    return history.map(item => ({
        direction: item.role === 'lead' ? 'in' : 'out',
        text: item.text,
        created_at: item.created_at,
    }));
}

function appendMessage(history, message) {
    const previous = history[history.length - 1];
    const base = previous?.created_at ? Date.parse(previous.created_at) : Date.now();
    const createdAt = new Date(base + 3 * 60 * 1000).toISOString();
    history.push({
        created_at: message.created_at || createdAt,
        ...message,
    });
}

function sanitizePersonaSourceText(value, { maxLength = 700 } = {}) {
    return String(value || '')
        .replace(MEDIA_MARKER_RE, (_, kind) => `[${String(kind || 'media').toLowerCase()}]`)
        .replace(/https?:\/\/\S+/gi, '[url]')
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
        .replace(/@[a-z0-9._-]{2,30}/gi, '@handle')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
        .replace(/\b(?:\+?61|0)4[\d\s-]{7,}\b/g, '[phone]')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
}

function softenExactRealDataText(value) {
    return sanitizePersonaSourceText(value, { maxLength: 900 })
        .replace(/\b\d+(?:\.\d+)?\s*(?:kg|kgs|kilograms|lb|lbs)\b/gi, '[specific weight]')
        .replace(/\b\d+(?:\.\d+)?\s*(?:reps?|sets?)\b/gi, '[specific reps/sets]')
        .replace(/\b\d+(?:\.\d+)?\s*[- ]?(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/gi, '[specific duration]')
        .replace(/\b\d+\s*x\s*\d+\b/gi, '[specific set pattern]')
        .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)(?:-ish)?\b/gi, '[specific month]')
        .replace(/\b(sister|brother|mother|mum|mom|father|dad|parent|parents|aunt|uncle|cousin)\b/gi, 'family member')
        .replace(/\b(pet loss|lost (?:my|her|his|their) (?:dog|cat|pet|puppy|rabbit)|grief|grieving|bereavement)\b/gi, 'personal stress')
        .replace(/\b(financial stress|financially things are bad|money stress|income pressure|earning a certain amount|business pressure)\b/gi, 'work/financial pressure');
}

function sanitizeGeneratedPersona(value) {
    if (Array.isArray(value)) return value.map(item => sanitizeGeneratedPersona(item));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, item] of Object.entries(value)) {
            if (key === 'source_thread_id' || key === 'source_counts') {
                out[key] = item;
            } else {
                out[key] = sanitizeGeneratedPersona(item);
            }
        }
        return out;
    }
    if (typeof value === 'string') return softenExactRealDataText(value);
    return value;
}

function normalizePersonaRoute(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('vegan') || text.includes('plant')) return 'vegan';
    if (text.includes('generic') || text.includes('fitness') || text.includes('gym') || text.includes('weight')) return 'generic';
    return 'undecided';
}

function anonymizedTranscript(messages = [], { maxMessages = 24 } = {}) {
    return messages
        .slice(-maxMessages)
        .map(message => {
            const speaker = message.direction === 'in' ? 'Lead' : 'Shannon';
            const text = sanitizePersonaSourceText(message.text, { maxLength: 500 });
            return text ? `${speaker}: ${text}` : '';
        })
        .filter(Boolean)
        .join('\n');
}

function inferRealThreadOutcome(thread = {}, messages = []) {
    const q = thread.qualifier && typeof thread.qualifier === 'object' ? thread.qualifier : {};
    const stage = String(thread.lead_stage || q.stage || '').toLowerCase();
    if (thread.linked_user_id || ['won', 'in_app', 'paying'].includes(stage)) return 'joined_or_linked';
    if (['pitched', 'invited'].includes(stage)) return 'pitched_or_invited';
    const inboundCount = messages.filter(m => m.direction === 'in').length;
    const outboundCount = messages.filter(m => m.direction === 'out').length;
    if (inboundCount >= 4 && outboundCount >= 3) return 'engaged_conversation';
    if (inboundCount <= 1 && outboundCount >= 1) return 'went_cold';
    return 'unknown';
}

function buildPersonaFromThreadPrompt(sample) {
    const transcript = anonymizedTranscript(sample.messages);
    return `You are creating an anonymized simulation persona for Balance's Instagram DM sparring gym.

Use the real conversation pattern below, but do NOT copy identifying details, exact names, handles, phone numbers, locations, or long quotes. Create a realistic composite persona that preserves the useful sales/coaching pattern.
Privacy rule: generalize private facts. Do not preserve exact family roles, bereavements, money details, dates/months, workplaces/businesses, named pets, locations, exact weights/reps/durations, or health details beyond broad limitations.

Real thread metadata:
- channel: ${sample.thread.channel || 'unknown'}
- lead stage: ${sample.thread.lead_stage || 'unknown'}
- outcome: ${sample.outcome}
- inbound messages: ${sample.inbound_count}
- outbound messages: ${sample.outbound_count}
- route hint: ${sample.route_hint || 'undecided'}

Anonymized transcript sample:
${transcript || '(no useful text after sanitization)'}

Return JSON only:
{
  "key": "real_pattern_short_slug",
  "name": "fake first name",
  "route": "vegan|generic|undecided",
  "hook_context": "realistic but anonymized likely opener/context",
  "hidden_profile": "compact composite story based on the real pattern, no identifying details",
  "behaviour": "how this type replies over multiple turns, including likelihood of ghosting",
  "objections": ["objection"],
  "opening": "paraphrased first captured reply, not copied from the transcript",
  "lead_rules": ["rule for the lead simulator"],
  "reality_checks": ["specific check that keeps this persona realistic"],
  "story_notes": "what real pattern this persona tests"
}`;
}

function heuristicPersonaFromThreadSample(sample, index = 0) {
    const outcome = sample.outcome || 'unknown';
    const ghosty = outcome === 'went_cold';
    const route = normalizePersonaRoute(sample.route_hint);
    const opening = route === 'vegan'
        ? 'haha yeah i have been trying to make the plant based thing work'
        : ghosty
            ? 'haha yeah fair'
            : 'yeah honestly i have been meaning to sort my routine out';
    return {
        key: `real_pattern_${index + 1}`,
        name: ['Mia', 'Jess', 'Tara', 'Bec', 'Nikki', 'Alyssa'][index % 6],
        route,
        hookContext: 'Composite from a real IG thread, opener anonymized.',
        hiddenProfile: `Anonymized lead pattern from production DMs. Outcome looked like ${outcome}.`,
        behaviour: ghosty
            ? 'low-commitment and likely to stop replying if the message feels like a pitch or too much effort.'
            : 'engaged enough to reply, but still needs the message to feel specific and human.',
        objections: ghosty ? ['not actively looking', 'does not want to be sold to'] : ['needs trust before the next step'],
        opening,
        leadRules: ghosty
            ? ['if Shannon pushes the challenge too early, leave on seen']
            : ['only warm up when Shannon responds to the actual detail shared'],
        storyChecks: ['do not copy the real transcript verbatim', 'stay anonymized and plausible'],
        storyNotes: 'Heuristic fallback persona from live DB pattern.',
        source_thread_id: sample.thread.id,
        source_outcome: outcome,
    };
}

async function buildPersonaFromThreadSample(sample, index = 0, { offline = false } = {}) {
    if (offline) return heuristicPersonaFromThreadSample(sample, index);
    try {
        const result = await callJsonModel({
            prompt: buildPersonaFromThreadPrompt(sample),
            label: 'db-persona-builder',
            temperature: 0.45,
            maxOutputTokens: 4096,
        });
        const persona = sanitizeGeneratedPersona(mergeScenarioPersona(heuristicPersonaFromThreadSample(sample, index), result.parsed));
        return {
            ...persona,
            key: String(result.parsed.key || persona.key || `real_pattern_${index + 1}`)
                .toLowerCase()
                .replace(/[^a-z0-9_]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 48) || `real_pattern_${index + 1}`,
            source_thread_id: sample.thread.id,
            source_outcome: sample.outcome,
            source_counts: {
                inbound: sample.inbound_count,
                outbound: sample.outbound_count,
                total: sample.messages.length,
            },
        };
    } catch (err) {
        const fallback = heuristicPersonaFromThreadSample(sample, index);
        fallback.storyNotes = `${fallback.storyNotes} Persona builder failed: ${err.message}`;
        return fallback;
    }
}

function routeHintFromThread(thread = {}, messages = []) {
    const text = [
        thread.goals,
        thread.running_notes,
        thread.personal_context,
        ...messages.map(m => m.text),
    ].filter(Boolean).join(' ').toLowerCase();
    if (/\b(vegan|plant.?based|vegetarian)\b/i.test(text)) return 'vegan';
    if (/\b(weight|gym|train|training|workout|fitness|calorie|protein|strong|strength|energy)\b/i.test(text)) return 'generic';
    return 'undecided';
}

function shuffleWithSeed(items, seed) {
    const random = seededRandom(seed);
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function loadRealIgThreadSamples({
    threadLimit = 60,
    windowDays = 180,
    minInbound = 2,
    minMessages = 4,
    seed = 'real-db',
} = {}) {
    const params = [
        'select=id,channel,ig_username,profile_name,lead_stage,linked_user_id,last_inbound_at,last_outbound_at,qualifier,goals,communication_style,running_notes,personal_context',
        'last_inbound_at=not.is.null',
        'order=last_inbound_at.desc.nullslast',
        `limit=${Math.max(1, Math.min(500, Number(threadLimit) || 60))}`,
    ];
    if (windowDays && Number(windowDays) > 0) {
        const since = new Date(Date.now() - Number(windowDays) * 24 * 60 * 60 * 1000).toISOString();
        params.splice(2, 0, `last_inbound_at=gte.${encodeURIComponent(since)}`);
    }
    const threads = await supabaseQuery(`ig_threads?${params.join('&')}`);
    const samples = [];
    for (const thread of threads || []) {
        const messages = await supabaseQuery(
            `ig_messages?select=direction,text,created_at&thread_id=eq.${encodeURIComponent(thread.id)}&order=created_at.asc&limit=80`
        ).catch(() => []);
        const useful = (messages || []).filter(m => sanitizePersonaSourceText(m.text, { maxLength: 80 }));
        const inboundCount = useful.filter(m => m.direction === 'in').length;
        const outboundCount = useful.filter(m => m.direction === 'out').length;
        if (useful.length < minMessages || inboundCount < minInbound) continue;
        samples.push({
            thread,
            messages: useful,
            inbound_count: inboundCount,
            outbound_count: outboundCount,
            route_hint: routeHintFromThread(thread, useful),
            outcome: inferRealThreadOutcome(thread, useful),
        });
    }
    return shuffleWithSeed(samples, seed);
}

async function derivePersonasFromDatabase({
    count = 3,
    threadLimit = 60,
    windowDays = 180,
    minInbound = 2,
    minMessages = 4,
    seed = 'real-db',
    offline = false,
} = {}) {
    const samples = await loadRealIgThreadSamples({
        threadLimit,
        windowDays,
        minInbound,
        minMessages,
        seed,
    });
    if (!samples.length) {
        throw new Error('No usable IG thread samples found for persona generation');
    }
    const selected = samples.slice(0, Math.max(1, Math.min(samples.length, Number(count) || 3)));
    const personas = [];
    for (const [index, sample] of selected.entries()) {
        personas.push(await buildPersonaFromThreadSample(sample, index, { offline }));
    }
    return {
        personas,
        metadata: {
            source: 'supabase_ig_threads_ig_messages',
            generated_at: new Date().toISOString(),
            scanned_threads: samples.length,
            selected_threads: selected.map(sample => ({
                thread_id: sample.thread.id,
                outcome: sample.outcome,
                route_hint: sample.route_hint,
                inbound_count: sample.inbound_count,
                outbound_count: sample.outbound_count,
            })),
            window_days: windowDays,
            min_inbound: minInbound,
            min_messages: minMessages,
        },
    };
}

async function callJsonModel({ prompt, label, temperature = 0.6, maxOutputTokens = 2048 }) {
    const compactPrompt = `${prompt}

OUTPUT SIZE RULES:
- Return one compact JSON object only.
- Do not repeat the schema, explain your reasoning, or add commentary.
- Keep all non-message string fields under 18 words.
- Keep arrays to 3 items max unless the schema clearly requires fewer.
- Use simple values. If unsure, choose the shortest valid answer.`;
    const raw = await callGeminiFallback(
        [{ role: 'user', parts: [{ text: compactPrompt }] }],
        { temperature, maxOutputTokens, responseMimeType: 'application/json' }
    );
    const parsed = parseJsonObject(raw);
    if (!parsed) {
        const err = new Error(`${label || 'json-model'} returned non-json`);
        err.rawText = raw;
        throw err;
    }
    return { parsed, raw };
}

async function callCoachModel({ prompt, coachModel = 'auto', temperature = 0.8, maxOutputTokens = 700 }) {
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const config = { temperature, maxOutputTokens, responseMimeType: 'application/json' };
    const wantGeminiOnly = coachModel === 'gemini';
    const wantVertexOnly = coachModel === 'vertex';

    if (!wantGeminiOnly) {
        try {
            const raw = await callVertexAIModel(contents, config);
            return { raw, model: 'vertex-v7' };
        } catch (err) {
            if (wantVertexOnly) throw err;
        }
    }

    const raw = await callGeminiFallback(contents, config);
    return { raw, model: wantGeminiOnly ? 'gemini' : 'gemini-fallback' };
}

function buildLeadTurnPrompt({ persona, history, turnIndex, maxLeadWords = 55 }) {
    const transcript = transcriptToText(history) || '(no captured messages yet)';
    const lastCoach = [...history].reverse().find(item => item.role === 'coach');
    const leadRules = Array.isArray(persona.leadRules) && persona.leadRules.length
        ? persona.leadRules.map(rule => `- ${rule}`).join('\n')
        : '- do not become more interested unless Shannon earns it from the actual message';
    const storyChecks = Array.isArray(persona.storyChecks) && persona.storyChecks.length
        ? persona.storyChecks.map(rule => `- ${rule}`).join('\n')
        : '- keep replies like an Instagram DM, not a therapy intake';
    return `You are simulating a real Instagram stranger in a Balance acquisition test.

Do not help the coach win. Act like the persona, with normal human inconsistency.
You can be warm, distracted, sceptical, vague, or ready, depending on the conversation.
If Shannon sells too early, get cooler or push back. If he listens well, open up a bit.
You are allowed to not reply. If the latest Shannon message would realistically get left on seen, set state to "ghosted" and message to "".

Persona:
- Name: ${persona.name}
- Route: ${persona.route}
- Hidden profile: ${persona.hiddenProfile}
- Behaviour: ${persona.behaviour}
- Objections: ${(persona.objections || []).join(', ') || 'none'}
- First captured context: ${persona.hookContext}

Lead-specific rules:
${leadRules}

Reality checks:
${storyChecks}

Conversation so far:
${transcript}

${lastCoach ? `Shannon's latest message:\n${lastCoach.text}` : `This is the first captured reply after Shannon's unseen IG opener. Start with this seed if it still fits: "${persona.opening}"`}

Write the lead's next Instagram reply. Keep it under ${maxLeadWords} words unless the person is genuinely opening up.
Return JSON only:
{
  "message": "lead reply text, or empty string if ghosted",
  "state": "warming|neutral|cooling|hot|ghosted|won|lost",
  "join_intent": 0,
  "notes": "short private note about why they replied this way"
}`;
}

function mergeScenarioPersona(base, patch = {}) {
    const objections = Array.isArray(patch.objections)
        ? patch.objections.map(String).filter(Boolean)
        : base.objections;
    const leadRulesRaw = patch.lead_rules || patch.leadRules;
    const leadRules = Array.isArray(leadRulesRaw)
        ? leadRulesRaw.map(String).filter(Boolean)
        : base.leadRules;
    const storyChecksRaw = patch.reality_checks || patch.storyChecks;
    const storyChecks = Array.isArray(storyChecksRaw)
        ? storyChecksRaw.map(String).filter(Boolean)
        : base.storyChecks;
    return {
        ...base,
        name: String(patch.name || patch.display_name || base.name || '').trim() || base.name,
        route: normalizePersonaRoute(patch.route || base.route),
        hookContext: String(patch.hook_context || patch.hookContext || base.hookContext || '').trim() || base.hookContext,
        hiddenProfile: String(patch.hidden_profile || patch.hiddenProfile || base.hiddenProfile || '').trim() || base.hiddenProfile,
        behaviour: String(patch.behaviour || patch.behavior || base.behaviour || '').trim() || base.behaviour,
        opening: String(patch.opening || base.opening || '').trim() || base.opening,
        objections,
        leadRules,
        storyChecks,
        storyNotes: String(patch.story_notes || patch.storyNotes || base.storyNotes || '').trim(),
    };
}

function buildScenarioWriterPrompt(persona) {
    return `You are the scenario-writer bot for Balance's Instagram DM sparring gym.

Create a sharper hidden stranger story for this base persona. The lead must feel like a real Instagram person, not a convenient sales-training customer.

Base persona:
${JSON.stringify(persona, null, 2)}

Rules:
- Keep the same basic route and vibe.
- Add enough hidden context for realistic replies, but do not turn it into a long biography.
- Include friction: distraction, scepticism, partial answers, fear, humour, timing, or uncertainty.
- The stranger can become more interested only if Shannon listens well.
- Do not make them instantly join unless the base persona is genuinely hot.
- If this comes from a real-data composite, keep private life details broad. Do not preserve exact family roles, bereavements, finances, dates/months, injuries with identifying context, places, job/business specifics, or exact numbers.

Return JSON only:
{
  "name": "first name",
  "route": "vegan|generic|undecided",
  "hook_context": "what Shannon likely replied to before the tracked DM started",
  "hidden_profile": "compact hidden story",
  "behaviour": "how this lead replies over multiple turns",
  "objections": ["objection"],
  "opening": "first captured IG reply",
  "lead_rules": ["rule for the lead simulator"],
  "story_notes": "what this scenario is testing"
}`;
}

function buildScenarioCheckerPrompt(persona) {
    return `You are the reality-check bot for a fake Instagram lead scenario.

Your job is to make the stranger harder and more realistic. Remove anything too cooperative, too perfectly explained, or too obviously written for the coach to win.

Draft scenario:
${JSON.stringify(persona, null, 2)}

Check for:
- too much self-awareness
- too much neat backstory
- accepting the challenge too early
- replies that sound like a chatbot, not Instagram
- missing objections or distractions
- no reason for the person to keep replying

Return JSON only with the corrected scenario:
{
  "name": "first name",
  "route": "vegan|generic|undecided",
  "hook_context": "short context",
  "hidden_profile": "compact hidden story",
  "behaviour": "realistic reply behaviour",
  "objections": ["objection"],
  "opening": "first captured IG reply",
  "lead_rules": ["rule for the lead simulator"],
  "reality_checks": ["specific check to keep replies realistic"],
  "story_notes": "what changed and why"
}`;
}

async function generateScenarioPersona({ persona, storyBots = true, offline = false } = {}) {
    if (!storyBots || offline) {
        return { persona, model_calls: [], story_error: null };
    }
    const modelCalls = [];
    try {
        const writer = await callJsonModel({
            prompt: buildScenarioWriterPrompt(persona),
            label: 'scenario-writer',
            temperature: 0.65,
            maxOutputTokens: 4096,
        });
        modelCalls.push({ role: 'scenario_writer', model: 'gemini' });
        const drafted = mergeScenarioPersona(persona, writer.parsed);
        const checker = await callJsonModel({
            prompt: buildScenarioCheckerPrompt(drafted),
            label: 'scenario-checker',
            temperature: 0.35,
            maxOutputTokens: 4096,
        });
        modelCalls.push({ role: 'scenario_checker', model: 'gemini' });
        return {
            persona: mergeScenarioPersona(drafted, checker.parsed),
            model_calls: modelCalls,
            story_error: null,
        };
    } catch (err) {
        return {
            persona,
            model_calls: modelCalls,
            story_error: err.message,
        };
    }
}

function buildCoachTurnPrompt({ leadName, history, currentLeadText, qualifier, maxCoachWords = 140 }) {
    const transcript = transcriptToText(history);
    const coachTurns = history.filter(item => item.role === 'coach' && !item.no_reply);
    const recentCoachQuestionCount = coachTurns.slice(-2).filter(item => /\?/.test(String(item.text || ''))).length;
    const latestLeadText = String(currentLeadText || '').toLowerCase();
    const hasSoftBridgeSignal = /\b(work|busy|tired|drain|recharg|stress|schedule|routine|energy|food|training|gym|walk|fitness|health|snack|sleep|consistent|consistency|overwhelm|mental space|capacity|time|goal|pr|target|sore|pain|knees?|back|strong|strength)\b/i.test(latestLeadText);
    const directAdviceRequest = isDirectAdviceRequest(currentLeadText);
    const trackingAccuracySignal = isTrackingAccuracyRequest(currentLeadText);
    const mindMuscleCueRequest = isMindMuscleCueRequest(currentLeadText);
    const bracingCueRequest = isBracingCueSignal(currentLeadText);
    const deadliftFormBreakdownSignal = isDeadliftFormBreakdownSignal(currentLeadText);
    const advancedBiohackSignal = isAdvancedBiohackAdviceRequest(currentLeadText);
    const programExplanationRequest = isProgramExplanationRequest(currentLeadText);
    const hasCasualHelpSignal = /\b(send help|starting from scratch|start(?:ing)? over|out of practice|kickstart|kick start|get back into|back into it|bit of a push)\b/i.test(latestLeadText)
        && !hasChallengeInviteReadinessSignal(currentLeadText);
    const unresolvedPlateauSignal = isUnresolvedPlateauSignal(currentLeadText);
    const advancedPlantBasedSignal = isAdvancedPlantBasedSignal(currentLeadText);
    const ethicalFoundationSignal = isEthicalFoundationSignal(currentLeadText);
    const veganEthicalChallengeSignal = isVeganEthicalChallengeToVegetarianism(currentLeadText);
    const hookContext = String(qualifier?.facts?.hook_context || '');
    const challengeInfoRequestSignal = /\b(what'?s included|what is included|what'?s it about|what is it about|what'?s this about|tell me more about (?:it|the challenge)|what does it involve|what'?s involved)\b/i.test(currentLeadText)
        && /\b(challenge|invite|low.?impact|fitness|plant.?based|program|30\s*day|30-day)\b/i.test(`${hookContext} ${currentLeadText}`);
    const publicAiTopicSignal = /\b(ai|artificial intelligence|algorithm|generated|automated|bot|chatgpt|model)\b/i.test(currentLeadText);
    const appOrWorkoutSupportSignal = isAppOrWorkoutPlanSupportRequest(currentLeadText);
    const plantBasedFamilyMealSignal = isPlantBasedFamilyMealPlanningSignal(currentLeadText);
    const recentLeadMessages = history.filter(item => item.role === 'lead' && !item.no_reply);
    const recentLowEnergyLeadCount = recentLeadMessages.slice(-3).filter(item => isLowEnergyLeadReply(item.text)).length;
    const lowEnergyLeadSignal = isLowEnergyLeadReply(currentLeadText) && recentLowEnergyLeadCount >= 2;
    const singleLowDetailBusySignal = coachTurns.length === 0
        && isLowEnergyLeadReply(currentLeadText)
        && /\b(busy|hectic|long day|tired|doing okay|alright|fine)\b/i.test(currentLeadText);
    const caregiverExhaustionSignal = isCaregiverExhaustionSignal(currentLeadText);
    const movingIsolationSignal = isMovingIsolationSignal(currentLeadText);
    const swampedLifestyleDeferralSignal = isSwampedLifestyleDeferralSignal(currentLeadText);
    const overloadedMovementSignal = isOverloadedMovementSignal(currentLeadText);
    const reciprocalPersonalSignal = isReciprocalPersonalQuestion(currentLeadText);
    const animalPassionSignal = isAnimalPassionSignal(currentLeadText);
    const casualTrainingBanterSignal = isCasualTrainingBanterSignal(currentLeadText);
    const creativeTasteSubstanceSignal = isCreativeTasteSubstanceSignal(currentLeadText);
    const recoveryRoutineRhythmSignal = isRecoveryRoutineRhythmSignal(currentLeadText);
    const busyGymFallbackSignal = isBusyGymFallbackSignal(currentLeadText);
    const homeGymTransitionSignal = isHomeGymTransitionSignal(currentLeadText);
    const momentumLossAfterTryingSignal = isMomentumLossAfterTryingSignal(currentLeadText);
    const hypermobilityRoutineSignal = isHypermobilityRoutineSignal(currentLeadText);
    const lastCoachText = String(coachTurns[coachTurns.length - 1]?.text || '');
    const meaningfulLeadReplyCount = Number(qualifier?.meaningful_lead_reply_count) || countMeaningfulLeadReplies(
        historyToIgMessages(history),
        currentLeadText
    );
    const earnedChallengeInviteSignal = hasEarnedChallengeInviteMoment({
        qualifier,
        currentMessage: currentLeadText,
        leadReplyCount: meaningfulLeadReplyCount,
    });
    const petDeflectionSignal = isPetDeflectionSignal(currentLeadText)
        && /\b(balance|chasing|goals?|feel good|strong|training|food|diet|health|what does that look like)\b/i.test(lastCoachText);
    const builderProjectSignal = isBuilderProjectSignal(currentLeadText)
        && (isBuilderEnergyContext(currentLeadText) || recentLeadMessages.slice(-3).some(item => isBuilderEnergyContext(item.text)));
    const recentPetOnlyLeadCount = [currentLeadText, ...recentLeadMessages.slice(-3).map(item => item.text)]
        .filter(item => isPetOnlyBanter(item)).length;
    const extendedPetRapportSignal = isPetOnlyBanter(currentLeadText) && coachTurns.length >= 2 && recentPetOnlyLeadCount >= 2;
    const temporaryDistractionSignal = isTemporaryDistractionLongTermSignal(currentLeadText);
    const painRecoverySignal = isPainRecoverySignal(currentLeadText);
    const procedureRecoverySafetySignal = isProcedureRecoverySafetySignal(currentLeadText);
    const mentalNoiseSignal = isMentalNoiseSwitchOffSignal(currentLeadText);
    const illnessRecoverySignal = isIllnessRecoverySignal(currentLeadText);
    const selfSufficientProgressSignal = isSelfSufficientProgressSignal(currentLeadText);
    const lostPastFitnessSignal = isLostPastFitnessSignal(currentLeadText);
    const challengePositiveFeedbackSignal = isChallengePositiveFeedbackSignal(currentLeadText);
    const timeCapacityBarrierSignal = isTimeCapacityBarrierSignal(currentLeadText);
    const foodAfterthoughtCapacitySignal = isFoodAfterthoughtCapacitySignal(currentLeadText);
    const simpleSustainableNoTimeSignal = isSimpleSustainableNoTimeSignal(currentLeadText);
    const tediousProjectSignal = isTediousProjectSignal(currentLeadText);
    const travelViewLoopSignal = isTravelViewLoopSignal(currentLeadText)
        && coachTurns.length >= 2
        && recentLeadMessages.slice(-3).some(item => isTravelViewLoopSignal(item.text));
    const nostalgiaMemoryLoopSignal = isNostalgiaMemoryLoopSignal(currentLeadText);
    const vagueCreativeChaosSignal = isVagueCreativeChaosBanter(currentLeadText);
    const recentPetCalmFocusCount = recentLeadMessages.slice(-4).filter(item => isPetCalmFocusSignal(item.text)).length;
    const petCalmFocusLoopSignal = isPetCalmFocusSignal(currentLeadText)
        && recentPetCalmFocusCount >= 2
        && /\b(focus|stress|calm|peace|movement|mindful|clarity|unwind)\b/i.test(`${hookContext} ${currentLeadText}`);
    const chaoticQuietMomentSignal = isChaoticQuietMomentSignal(currentLeadText);
    const politeClosingSignal = isPoliteClosingSignal(currentLeadText);
    const quickInPersonOpenerSignal = coachTurns.length === 0
        && wordCount(currentLeadText) <= 2
        && /\b(in-person|real-world|met|market|brief|quick|informal|recent|encounter|community)\b/i.test(hookContext);
    const accidentalExitSignal = coachTurns.length === 0 && isLeadOptOutOrAccidentalText(currentLeadText);
    const explorationNudge = coachTurns.length >= 2 && recentCoachQuestionCount === 0
        ? `
PROGRESSION NUDGE:
The last couple of Shannon turns did not ask a question. Do not stay in a validation-only loop. Add one specific, low-pressure bridge question if it fits the latest message. It should come from their exact topic, not a generic intake question.
- Competitive/self-sufficient lead: ask what they think will make the next target hard, what they are changing to get there, or what they are chasing next.
- Sport/social hobby lead: ask what they are trying to improve, what keeps them playing, or what makes it feel good for them.
- Overwhelmed/no-capacity lead: ask about the tiniest version that would feel doable, whether removing decision-making would help, or what would make it feel low-pressure.
Skip the question only if they asked Shannon a direct personal question that needs a straight answer first.`
        : '';
    const questionLoopNudge = coachTurns.length >= 2 && recentCoachQuestionCount >= 2
        ? `
QUESTION LOOP GUARD:
The last couple of Shannon turns already asked questions.
- Do not keep stacking diagnostic questions if the lead has just given a usable answer.
- First reflect their exact answer, then add one small useful thought, practical lens, or personal callback.
- Only ask another question if it moves the conversation somewhere new, and keep it to one question.`
        : '';
    const quickInPersonOpenerNudge = quickInPersonOpenerSignal
        ? `
QUICK IN-PERSON OPENER:
Their first message is just a tiny greeting after a real-world or contextual interaction.
- Do not reply with only "good to meet you" or "hope you chilled after that". That dead-ends the thread.
- Do not invent a specific place, event, or detail unless it is in the known context.
- Keep it casual, anchor to the shared context, and add one concrete low-pressure thread for them to answer.
- No challenge invite unless they explicitly ask for help, the link, or the challenge.`
        : '';
    const accidentalExitNudge = accidentalExitSignal
        ? `
ACCIDENTAL / EXIT SIGNAL:
Their first message looks like an accidental tap, wrong chat, or clear exit.
- Do not pitch, qualify, or try to rescue the conversation.
- Reply like a normal human: brief, warm, and no-pressure.
- It is okay if this thread ends here.`
        : '';
    const softBridgeNudge = hasSoftBridgeSignal
        ? `
SOFT BRIDGE SIGNAL:
Their latest message contains a possible life/energy/training/food/work hook. Before replying, decide if there is one natural question that keeps that hook alive. Keep it casual. Do not force a challenge mention.`
        : '';
    const directAdviceNudge = directAdviceRequest
        ? `
DIRECT ADVICE REQUEST:
They asked Shannon for tips/advice, recommendations, or specific go-to meals/ideas. Answer the practical question first with one small useful tip or example from their exact issue before qualifying or inviting.
- Do not invite in this reply unless they explicitly asked for the challenge/link.
- If you still need to learn more, give the tip first, then ask one short follow-up.`
        : '';
    const advancedBiohackNudge = advancedBiohackSignal
        ? `
ADVANCED BIOHACK / PEPTIDE QUESTION:
They are asking about peptide stacks, NAD+, senolytics, GH pulses, or advanced protocols.
- Do not pretend to prescribe or recommend a protocol.
- Give a clear scope boundary: this is clinician/prescriber/bloodwork territory, not DM advice.
- Then redirect to Shannon's lane: training load, sleep, recovery, protein/nutrition, stress, programming, or periodization.
- If you ask a follow-up, ask one question about which boring baseline they have already nailed.`
        : '';
    const trackingAccuracyNudge = trackingAccuracySignal
        ? `
TRACKING / GRAPH ACCURACY REQUEST:
They are asking how to know whether app tracking, numbers, or graphs reflect their effort.
- Treat this as support first, not qualification or a challenge invite.
- Give one practical check before any question: compare week-to-week trends, check logging consistency, look at sets/reps/load/performance, and do not judge one noisy day.
- Do not ask "what would you expect the graphs to show" until after you have answered how to verify the data.`
        : '';
    const mindMuscleCueNudge = mindMuscleCueRequest
        ? `
MIND-MUSCLE CUE REQUEST:
They are asking for a trick/cue to feel glutes or hamstrings instead of lower back.
- Give one concrete cue or micro-drill before asking another diagnostic question.
- Good options: slow hip-hinge wall taps, light RDLs with a hamstring pause, "push hips back first", "push the floor away", brace first, or film one side-angle set.
- Do not only ask what they feel.`
        : '';
    const bracingCueNudge = bracingCueRequest
        ? `
BRACING / STABILITY CUE REQUEST:
They are unsure whether they are bracing correctly, confusing it with holding breath, feeling unstable, or getting lightheaded.
- Give one small cue or explanation before asking anything else.
- Good cue: brace 360 degrees like gently coughing or preparing for a belt, ribs down, breathe behind the brace, not just pulling the belly button in.
- If you ask a follow-up, ask after the cue and keep it to one question.`
        : '';
    const deadliftFormBreakdownNudge = deadliftFormBreakdownSignal
        ? `
DEADLIFT FORM BREAKDOWN:
They mentioned deadlift form breaking down, lower back rounding, hips shooting up, soft core, or losing tightness under load.
- Do not ask another broad diagnostic question before giving a cue.
- Give one small form cue first: reduce load until brace holds, 360 brace before the pull, film a side angle, keep the bar close, lats/armpits tight, or push the floor away.
- If you ask a question, make it one precise follow-up after the cue.`
        : '';
    const programExplanationNudge = programExplanationRequest
        ? `
PROGRAM EXPLANATION REQUEST:
They are asking what makes it different, what the real deal is, whether it is actually useful/customized, or how to make the sweet spot stick.
- Give one or two concrete specifics before mentioning the challenge/link.
- Good specifics: the minimum-floor approach for all-or-nothing people, progressive overload/periodization, RPE, tempo/rest-pause/drop sets used only when appropriate, deloads, or how they adjust for sticking points.
- Do not answer with "we help you" or "want the link?" before giving the actual substance.`
        : '';
    const casualHelpNudge = hasCasualHelpSignal
        ? `
CASUAL HELP SIGNAL:
They sound open or frustrated, but their "help/kickstart/starting from scratch" language is conversational, not permission to pitch.
- Do not invite in this reply.
- Ask one concrete question about what feels hardest, what they want to get back to, or what would make the restart feel easier.`
        : '';
    const plateauNudge = unresolvedPlateauSignal
        ? `
PLATEAU / TRIED-EVERYTHING SIGNAL:
They are describing a real training plateau or saying they have already tried lots of fixes.
- Do not invite to the challenge in this reply.
- Especially if they mention a trainer, "good enough", or "nothing is changing", do not say "that's exactly why the challenge exists" or ask to send details yet.
- If they ask for Shannon's take, ideas, angles, tweaks, or how to push past a plateau, give one concrete training angle before asking anything.
- Good concrete angles: tempo, pauses, rep-scheme changes, heavy singles/doubles, higher-rep accessories, foot position, range of motion, recovery, load management, or finding the sticking point.
- Good diagnostic examples: RPE creep, fatigue management, a sticking point that changes the accessory choice, or whether the planned deload actually restored performance.
- If they only state the plateau without asking for a take, ask one diagnostic question about the sticking point, recovery, load/intensity, technique, food, or what changed when they tried those fixes.
- Make them feel like Shannon is actually looking at their plateau, not using it as a pitch trigger.`
        : '';
    const plantExpertNudge = advancedPlantBasedSignal
        ? `
PLANT-BASED EXPERT SIGNAL:
They may know more about vegan ethics, macros, or micronutrients than Shannon does.
- If they asked Shannon a direct personal question, answer it briefly and honestly, then pivot to their process.
- Do not dwell on Shannon struggling with plant-based macros/micros.
- If they already said protein/variety are handled or that ease is not the point, do not ask a basic protein/variety question.
- Ask one respectful process question, for example what their standard requires, what is hardest about keeping ethics and performance aligned, what they track, which micronutrients they pay attention to, or how they structure meals around training.`
        : '';
    const ethicalFoundationNudge = ethicalFoundationSignal
        ? `
ETHICAL FOUNDATION SIGNAL:
They are saying veganism is a non-negotiable ethical foundation, not a convenience habit.
- Do not ask what makes it "easy", how they "stay on track", or tie it to training unless they bring training up.
- Ask what people misunderstand, how it shapes daily choices, or where that commitment gets tested socially/logistically.
- If they ask Shannon a practical question like whether cooking at home is easier, answer briefly, then return to the ethics/compassion thread. Do not follow with a basic go-to-meals question.
- Do not call it "mostly plant-based" or soften it into a diet preference.`
        : '';
    const challengeInfoRequestNudge = challengeInfoRequestSignal
        ? `
CHALLENGE INFO REQUEST:
They are asking what the challenge/invite is about, not necessarily asking to join yet.
- Answer with the concrete shape in one short reply.
- Do not ask to send the link in this same reply unless they explicitly ask for the link, to join, or how to start.
- Add one light fit-check question about what caught their eye, what they need low-impact for, or whether the time/app setup needs to be simple.`
        : '';
    const veganEthicalChallengeNudge = veganEthicalChallengeSignal
        ? `
VEGAN ETHICAL CHALLENGE:
They are directly asking why Shannon is vegetarian rather than fully vegan/plant-based, especially through an animal-welfare lens.
- Answer humbly in one short sentence. Do not defend it as perfectly aligned with animal welfare or ask them to validate the compromise.
- Avoid "good balance", "fits my day-to-day", or "too restrictive" as the main frame.
- Then pivot back to their experience, advocacy load, ethical pressure, or what feels hardest to carry.`
        : '';
    const publicAiTopicNudge = publicAiTopicSignal
        ? `
PUBLIC AI WORDING:
They mentioned AI, algorithms, bots, generated content, or models. Do not repeat those words back.
- Paraphrase the actual human point instead, like "low effort", "generic", "phoned in", or "forced".
- Never mention AI, automation, algorithms, models, Gemini, ChatGPT, or training data in Shannon's message.`
        : '';
    const supportRequestNudge = appOrWorkoutSupportSignal
        ? `
APP / WORKOUT SUPPORT REQUEST:
They are asking for help with the app, logging, stale workouts, a specific plan, or simplifying training.
- Do not invite to the 30-day challenge in this reply unless they explicitly ask for that challenge or a link.
- Treat it as a support/programming moment: acknowledge the app friction and ask one practical plan question, or answer the specific plan request.
- If they say they want machines, full-body, in-and-out, no crazy setups, or something easy to stick to, do not just validate. Move the plan forward with one simple structure, template, or practical question about days/equipment.
- Do not invent delivery mechanics like PDFs or emails.`
        : '';
    const plantBasedFamilyMealNudge = plantBasedFamilyMealSignal
        ? `
PLANT-BASED FAMILY MEAL SIGNAL:
They are struggling with quick, varied, healthy plant-based food for kids/family, often with exhaustion and planning fatigue.
- Do not invite to the challenge in this reply unless they explicitly ask for the challenge/link or say they need help.
- Move one practical step deeper first: ask what meals everyone already accepts, where planning breaks, or what the fastest fallback dinner is.
- If they say it feels like a "big project", ask one focused question only. Do not stack "what makes it feel big?" plus a full menu of options.
- If they already named planning, shopping, cooking after a long day, or picky eaters, do not only ask another diagnostic question. Add one tiny useful idea first.
- If they say dinner is a constant battle with picky kids, do not only ask for go-to meals. Suggest a repeatable base/rotation or ask what usually gets rejected versus accepted.
- Good tiny ideas: one repeatable base meal, pasta/taco/wrap variations, grocery shortcuts, kid-friendly protein anchors, or a simple fallback rotation.`
        : '';
    const singleLowDetailBusyNudge = singleLowDetailBusySignal
        ? `
LOW-DETAIL BUSY OPENER:
They gave a short "busy day / doing okay" first reply.
- Do not answer with only "hope you can chill later"; that closes the thread.
- Ask one easy, specific hook: work/study/life busy, whether they get to switch off later, or what made the day hectic.
- Keep it light and answerable in one sentence. No challenge invite.`
        : '';
    const lowEnergyLeadNudge = lowEnergyLeadSignal
        ? `
LOW-ENERGY LEAD:
They are giving clipped one-word or low-effort replies.
- Do not keep chasing with generic small talk like "anywhere fun?", "any good music?", or "how's your night?"
- Either use one sharper playful hook from their exact context, or gracefully leave the door open without demanding a reply.
- If you ask a question, make it answerable with a story, not another one-word reply.`
        : '';
    const caregiverExhaustionNudge = caregiverExhaustionSignal
        ? `
CAREGIVER / EXHAUSTION SIGNAL:
They are describing parent logistics, care work, illness, couch collapse, brain-off mode, or having no energy left.
- Do not only commiserate with "so real", couch jokes, "hope you got chill time", or "hope everyone got fed".
- If they are not clearly closing the thread, add one concrete impact or lowest-bar question.
- Good directions: what gets squeezed first, what would make evenings 5% easier, what helps them switch off, what tiny thing would feel doable, or where they most need support.`
        : '';
    const movingIsolationNudge = movingIsolationSignal
        ? `
MOVING / ISOLATION SIGNAL:
They are settling after a move, feeling disconnected, trying to meet people, or overwhelmed by a new place.
- Do not only make a pet joke or validate the move.
- Bridge to the real thread: what would help the new place feel more like home, what kind of people/groups they want to find, or the smallest routine/reset that would make this week feel less isolating.
- Keep pets as a light callback, not the whole reply.`
        : '';
    const swampedLifestyleDeferralNudge = swampedLifestyleDeferralSignal
        ? `
SWAMPED / LIFE-DEFERRAL SIGNAL:
They want something in the future, but apartment/work/capacity makes it unrealistic right now.
- Do not ask a generic "what kind of work keeps you busy?"
- Bridge to capacity and life rhythm: what would need to change, whether work leaves any switch-off time, or what tiny routine gives them breathing room now.
- Keep the original desire as a warm callback.`
        : '';
    const overloadedMovementNudge = overloadedMovementSignal
        ? `
OVERLOADED MOVEMENT SIGNAL:
They have already said consistency is hard because of study, family, time, energy, or mental load.
- Do not ask another broad "what makes it tough?" question if they have already named time/energy.
- Do not ask "what makes your attempts feel like a joke" or "why does motivation fade" after they already named work, long hours, rushing, burnout, or life piling up.
- Give one lowest-bar frame or ask one tiny-specific question.
- Good directions: 5-10 minutes, a walk, a stretch, one home set, removing decisions, or the smallest version that could survive a busy week.`
        : '';
    const reciprocalPersonalNudge = reciprocalPersonalSignal
        ? `
RECIPROCAL PERSONAL QUESTION:
They asked about Shannon's workouts, day, pets, location, or personal life to find common ground.
- Answer briefly and naturally.
- Then ask one specific question back from their context or the shared topic.
- Do not ask the same return question twice in different forms. For example, answer the podcast question, then ask one clean thing about what they heard or what stuck with them.
- If they ask "what about you?" in a music/running thread, do not ask only for more artists or "what gets in the way". Answer with one Shannon detail, then bridge to what the music/run does for them: focus, switch-off, reset, consistency, energy, or motivation.
- If they ask about Sunshine or pet chaos, answer one detail, then bridge back to whether their pet helps them reset/switch off or adds to the work/day chaos. Do not ask a second pet-inventory question.
- If they ask what challenges Shannon does, answer with Shannon's own training or personal challenge style. Do not interpret that as asking about the free 30-day challenge.
- If they ask "you?" after saying they are wiped from work, answer briefly then bridge back to how they recover or switch off.
- Do not end with only "hope you crush it" or a closed good-wish.`
        : '';
    const casualTrainingBanterNudge = casualTrainingBanterSignal
        ? `
CASUAL TRAINING BANTER:
They are chatting about gym, chest day, pump, gaming, or recovery.
- Do not let it become a pure "sounds good, enjoy" dead-end.
- Add one light training hook, recovery thought, or question about what they are chasing next.
- Keep it casual; no challenge invite unless they clearly ask for help/link/start.`
        : '';
    const creativeTasteSubstanceNudge = creativeTasteSubstanceSignal
        ? `
CREATIVE TASTE / SUBSTANCE SIGNAL:
They are critiquing music/art/content as manufactured, recycled, trend-chasing, or lacking effort.
- Do not ask a generic "any bands lately?" question.
- Ask a more specific taste question: what makes something feel like it has substance, which artist is actually putting in effort, or what makes the new thing feel manufactured.
- If they repeat "I trust my own ears / decide for myself" for several turns, stop asking how they find more music. Bridge lightly to self-trust or standards in Shannon's world, such as training cues, progress, or knowing what works for your own body.
- Keep it rapport only; no challenge invite here.`
        : '';
    const recoveryRoutineRhythmNudge = recoveryRoutineRhythmSignal
        ? `
RECOVERY ROUTINE / RHYTHM SIGNAL:
They are talking about recovery habits, foam rolling, stretching, protein, or how missing the routine makes the next session harder.
- Do not only validate the routine or ask a vague "do you notice a difference?"
- Move one step deeper: ask which recovery piece matters most, which one slips first, what throws the rhythm off, or what fallback protects the next session.
- Keep it practical and tied to their training rhythm.`
        : '';
    const busyGymFallbackNudge = busyGymFallbackSignal
        ? `
BUSY GYM / FALLBACK PLAN SIGNAL:
They are trying to keep strength/progress while schedules, equipment, or a partner's training make sessions inconsistent.
- Do not ask a generic day-to-day question.
- Move toward a flexible plan: ask which machines/weights are usually taken, whether a backup template would help, or what movement pattern needs the easiest swap.
- No challenge invite unless they clearly ask to start or join.`
        : '';
    const homeGymTransitionNudge = homeGymTransitionSignal
        ? `
HOME GYM / LOST GYM TRANSITION:
They lost an old gym/setup/community and are trying to train with limited home gear.
- Do not only validate that it is not the same.
- If they have light dumbbells/bands/no proper gear, do not ask another nostalgia question about what made the gym vibe easier.
- Move to a practical bridge: how to make dumbbells/bands feel productive, what lift/feeling they miss most, or a fallback template that preserves progress at home.
- If they are stuck in "what's the point?" at home, name the concrete support before inviting: no-thinking home fallback, lighter-gear substitutions, one minimum session, or distraction-proof structure. Do not just say "structure and fresh ideas".
- Honour the old gym identity while giving the home setup a next step.`
        : '';
    const momentumLossAfterTryingNudge = momentumLossAfterTryingSignal
        ? `
MOMENTUM LOSS AFTER TRYING SIGNAL:
They lose momentum after a bit, have tried things before, or usually end up stopping.
- Do not ask a broad "what have you tried before?" if they already said they tried things.
- Give one practical accountability/structure lens, or ask where the momentum usually drops off.
- If they are asking how the online program keeps them on track, answer that with daily check-ins, habit tracking, and small wins before asking another question.`
        : '';
    const hypermobilityRoutineNudge = hypermobilityRoutineSignal
        ? `
HYPERMOBILITY / SELF-MANAGED ROUTINE:
They already have a routine for hypermobility, mobility, pain-free strength, or daily-life strength.
- Do not ask an origin-story question like whether they figured it out alone.
- Respect the autonomy, then ask a current-use question: what keeps them stable, what is non-negotiable, what helps them stay pain-free, or what they are trying to maintain now.
- No challenge invite here unless they ask for help.`
        : '';
    const animalPassionNudge = animalPassionSignal
        ? `
ANIMAL / RESCUE PASSION HOOK:
They shared a meaningful animal, rescue, shelter, or sanctuary detail.
- Treat it as a real personal hook, not throwaway banter.
- Ask one interested follow-up about the animals, shelter, or sanctuary dream before returning to workouts.
- Do not just say it is awesome and wish them luck with training.`
        : '';
    const petCalmFocusLoopNudge = petCalmFocusLoopSignal
        ? `
PET / CALM RAPPORT LOOP:
They are warmly engaging around a pet/calm/focus hook, but the original context is stress relief, peace, focus, or mindful movement.
- Do not stay in endless pet chaos banter.
- Bridge lightly from the pet detail to calm/focus/stress relief.
- Good questions: whether that pet is their main reset after work, what helps them switch off besides that, or whether gentle movement has ever helped their focus.
- No challenge invite here.`
        : '';
    const chaoticQuietMomentNudge = chaoticQuietMomentSignal
        ? `
CHAOTIC DAY / QUIET MOMENT:
They said the day is chaotic or they are wishing for a quiet moment.
- Do not ask the vague "what does that feel like?"
- Ask about the smallest quiet/reset moment, what helps them switch off, what drains them most, or what would make the day 5% calmer.
- Keep any Shannon/app/Sunshine update short, then return to their day.`
        : '';
    const petDeflectionNudge = petDeflectionSignal
        ? `
PET DEFLECTION AFTER BALANCE QUESTION:
They answered a Balance/health bridge with pet-chaos banter.
- Laugh once, then gently re-open the real-life thread. Do not stay only on the pet joke.
- Ask one smaller bridge, for example what actual balance would mean this week, what they want outside the pet chaos, or whether energy/food/movement is the thing they want calmer.
- No challenge invite here.`
        : '';
    const extendedPetRapportNudge = extendedPetRapportSignal
        ? `
EXTENDED PET RAPPORT LOOP:
The thread has had enough warm pet chaos banter.
- Do not ask another pet damage/chaos question.
- If they ask what Sunshine does, answer in one short phrase, then bridge to the person's day, reset, work chaos, or energy.
- Keep one light callback, then bridge to the person: home/work feeling calm or chaotic, whether pets are their reset, what helps them switch off, or what routine/energy looks like around that chaos.
- No challenge invite here.`
        : '';
    const temporaryDistractionNudge = temporaryDistractionSignal
        ? `
TEMPORARY DISTRACTION / LONG-TERM RESET SIGNAL:
They said podcasts, getting up, or another distraction rarely helps long-term.
- Do not ask what kind of podcast/distraction they use next.
- Reflect that they want something that actually sticks, then ask one question about what helps beyond distraction, what would make the quiet feel easier, or the smallest reset that survives the puppy/life chaos.
- No challenge invite here.`
        : '';
    const painRecoveryNudge = painRecoverySignal
        ? `
PAIN / RECOVERY HOOK:
They mentioned a knee, pain, injury, soreness, ice, or being careful not to overdo it.
- Do not pivot to a broad "what was the focus?" question before touching the pain point.
- Do not ask vague "what's going on with it?" after a named shoulder/knee issue. Ask which lifts/movements flare it, how long it has been there, or what they avoid.
- Ask one specific recovery or safety question: whether it usually flares after sessions, what movements set it off, what they are avoiding, or how they are keeping training safe.
- Keep it casual; no diagnosis and no challenge invite here.`
        : '';
    const procedureRecoverySafetyNudge = procedureRecoverySafetySignal
        ? `
POST-PROCEDURE RECOVERY SAFETY:
They are worried about pain, pressure, or messing up recovery after a procedure/surgery.
- Do not only validate or ask what movement they miss.
- No diagnosis. Give a conservative safety frame first: clinician/physio clearance, pain-free range, lower load, machines if cleared, stop if sharp/worse.
- Then ask one practical question about what they have been cleared for or what feels safest.`
        : '';
    const mentalNoiseNudge = mentalNoiseSignal
        ? `
MENTAL NOISE / SWITCH-OFF SIGNAL:
They are saying their brain will not settle, focus is hard, or short breaks are not cutting through.
- Do not only validate with "so real" or compare it to app work.
- Offer one tiny reset lens or ask one specific question about what helps the noise drop: walk, brain dump, quiet time, sleep, screen break, or the smallest reset that actually works.
- No challenge invite here.`
        : '';
    const illnessRecoveryNudge = illnessRecoverySignal
        ? `
ILLNESS / LOW-ENERGY RECOVERY SIGNAL:
They are under the weather, recovering from flu/cold, drained, or struggling to rest around work/family.
- Do not only say "hope you rest up".
- Ask one concrete low-energy question: what blocks rest, what gets pushed aside first, what would make recovery 5% easier, or what the lowest-pressure day looks like.
- Do not turn sickness into a challenge invite.`
        : '';
    const selfSufficientProgressNudge = selfSufficientProgressSignal
        ? `
SELF-SUFFICIENT / ENJOYS TRAINING SIGNAL:
They already like training, feel motivated by progress, or have a decent routine.
- Do not ask basic inventory questions like "what kind of training do you do?" once they have shown they are self-sufficient.
- Respect their autonomy and ask a next-edge question: what they are chasing next, what would make it exciting again, what progress target matters, or where the routine feels stale.
- No challenge invite unless they clearly ask for help or a next step.`
        : '';
    const lostPastFitnessNudge = lostPastFitnessSignal
        ? `
LOST PAST-FITNESS FEELING:
They are remembering how good being active felt, but it now feels far away.
- Do not ask another broad "what gets in the way?" question.
- Reflect the exact feeling they miss, then ask which small piece they would want back first: energy, clear head, feeling strong, spontaneity, or the tiniest low-pressure version that could fit now.
- No challenge invite unless they ask for help starting.`
        : '';
    const challengePositiveFeedbackNudge = challengePositiveFeedbackSignal
        ? `
POSITIVE CHALLENGE / SESSION FEEDBACK:
They are already doing the sessions and saying it helped.
- Do not jump to "what do you want to work on next?"
- Explore what worked so Shannon can reinforce it: what made it feel good, what part gave the mental reset, what helped them start, or how to repeat that win next session.
- If they say the workouts are keeping them sane, ask how to protect that pocket of time rather than starting a new qualification loop.`
        : '';
    const earnedChallengeBridgeNudge = earnedChallengeInviteSignal
        ? `
EARNED CHALLENGE BRIDGE:
They have now given enough real context to earn a soft next step: at least 3 meaningful lead replies, a warm relationship thread, and a clear goal/blocker.
- Do not keep asking discovery questions just to be polite.
- You may connect the free 30-day challenge to their exact situation, but keep it optional and specific.
- Good shape: "honestly this is the kind of thing the free 30 day challenge is good for: [their exact blocker/need] without [their exact pain]. want me to send the details?"
- If they asked a direct advice/support question, answer that first, then bridge only if it still feels natural.`
        : '';
    const timeCapacityBarrierNudge = timeCapacityBarrierSignal
        ? `
TIME / CAPACITY BARRIER:
They said time, low energy, juggling, or capacity is a barrier.
- Do not zoom in on only the knee, training, or another single detail while ignoring the time/capacity concern.
- If they answer with "everything", "work, errands, life stuff", "never enough hours", or "never ending", stop asking what eats the time. Offer one tiny frame or example first.
- Ask which blocker is loudest, or frame a lowest-pressure version that could fit a bad week.
- Good directions: time vs knee, tiny floor, lowest-pressure movement, what would make the week 5% easier, or whether no-thinking structure would help.`
        : '';
    const foodAfterthoughtCapacityNudge = foodAfterthoughtCapacitySignal
        ? `
FOOD AFTERTHOUGHT / DIZZY CAPACITY SIGNAL:
They are saying work/focus/moving makes food an afterthought, sometimes to the point of dizziness.
- Treat this as a practical food anchor/capacity moment, not city food banter.
- Do not ask whether routine will settle once they move, what their go-to meal is, or their favourite food spot.
- Offer one tiny no-thinking anchor first: a desk/bag snack, a default fresh bowl, a reminder before the crash, or a backup meal they can grab without deciding.
- If you ask a question, ask which tiny fallback would actually survive a demanding day.`
        : '';
    const simpleSustainableNoTimeNudge = simpleSustainableNoTimeSignal
        ? `
SIMPLE / SUSTAINABLE / NO-TIME SIGNAL:
They are overwhelmed by conflicting advice, intense plans, or routines that feel like another full-time job.
- Do not ask another broad history question like what routines they tried before.
- Offer or ask around a concrete low-friction frame: a tiny minimum, no-thinking structure, 5-10 minutes, a busy-week fallback, or the simplest version they could actually stick to.
- If they clearly state "simple and sustainable", treat that as the desired outcome and move toward how the support/program solves it.`
        : '';
    const builderProjectNudge = builderProjectSignal
        ? `
APP BUILDER / CODING LOAD SIGNAL:
They are talking about app building, coding, UI, or recommendation systems, and the thread has energy, training, ankle, or consistency context.
- Do not get lost in tech rapport only.
- If they deflect from pain or training into tech, relate briefly, then bridge back to the body cost of long coding sessions: knee/ankle recovery, energy, screen fatigue, or the smallest routine that survives build weeks.
- Do not repeat public AI/model wording unless it is inside their app description; keep Shannon human-facing.`
        : '';
    const tediousProjectNudge = tediousProjectSignal
        ? `
TEDIOUS PROJECT / RENOVATION SIGNAL:
They are talking about a dusty, slow, or tedious project.
- Do not ask only about project logistics or "getting through the phase".
- Use the project as a bridge to energy, focus, stress, momentum, switching off, or what keeps them sane through messy weeks.
- Keep it human and light. No challenge invite unless they clearly ask for help starting.`
        : '';
    const travelViewLoopNudge = travelViewLoopSignal
        ? `
TRAVEL / SCENERY RAPPORT LOOP:
They are warmly trading travel, view, mountain, cafe, skyline, or scenery stories.
- Answer any direct "what about you?" briefly, but do not ask another generic favourite-view/place question.
- After 2-3 scenery turns, bridge lightly to the person: whether those places help them switch off, reset, recharge, get outside, hike/walk, or clear their head.
- Keep it curious and human. No challenge invite here.`
        : '';
    const nostalgiaMemoryLoopNudge = nostalgiaMemoryLoopSignal
        ? `
NOSTALGIA / OLD PLACES LOOP:
They are trading memories about old shops, arcades, Blockbuster, menus, murals, or how everything feels more digital now.
- Do not ask for another old memory, favourite old spot, game skill, takeout rotation, or "remember when" detail.
- Bridge from nostalgia to the person now: what they miss about the slower pace, whether they still get offline reset time, what kind of real-world routine gives them that feeling, or whether life feels too fast.
- Keep it warm. No challenge invite unless they clearly ask for help.`
        : '';
    const vagueCreativeChaosNudge = vagueCreativeChaosSignal
        ? `
VAGUE CREATIVE CHAOS / FLIRTY BANTER:
They are being friendly but vague around "creative chaos", weekend plans, bug jokes, Sunshine, curry, or winky banter.
- After 2-3 casual turns, do not keep asking "what kind of stuff", "what fun stuff", or more weekend-plan questions.
- Either gracefully leave the door open, or make one light bridge to reset, energy, switching off, training as a head-clearer, or whether creative chaos drains or fuels them.
- If they keep dodging specifics, stop asking for effort.`
        : '';
    const politeClosingNudge = politeClosingSignal
        ? `
POLITE CLOSING SIGNAL:
They are thanking Shannon, wishing him well, or naturally closing the topic.
- Do not drag them into a generic routine/habit question.
- Close warmly, leave the door open, or add one light callback to the shared topic.`
        : '';
    const qualifierText = qualifier ? JSON.stringify({
        stage: qualifier.stage,
        stage_label: qualifier.stage_label,
        warmth_score: qualifier.warmth_score,
        next_question: qualifier.is_question_moment ? qualifier.next_question : '',
        why_now: qualifier.why_now,
        challenge_route: qualifier.challenge_route,
        facts: qualifier.facts,
    }, null, 2) : '(no qualifier state)';

    return `Draft Shannon's next Instagram DM reply for a cold/warm lead.

This is internal simulation, but the message itself must sound like Shannon personally texting.
No AI mentions. No em-dashes. No links unless they clearly ask for one.

${buildNameUsePolicyBlock()}
${buildRelationshipDiscoveryBlock()}
${buildHeardFirstConversationBlock()}
${buildShannonDmTuningBlock()}
${explorationNudge}
${questionLoopNudge}
${quickInPersonOpenerNudge}
${accidentalExitNudge}
${softBridgeNudge}
${directAdviceNudge}
${advancedBiohackNudge}
${trackingAccuracyNudge}
${mindMuscleCueNudge}
${bracingCueNudge}
${deadliftFormBreakdownNudge}
${programExplanationNudge}
${casualHelpNudge}
${plateauNudge}
${hypermobilityRoutineNudge}
${plantExpertNudge}
${veganEthicalChallengeNudge}
${challengeInfoRequestNudge}
${publicAiTopicNudge}
${supportRequestNudge}
${plantBasedFamilyMealNudge}
${singleLowDetailBusyNudge}
${lowEnergyLeadNudge}
${caregiverExhaustionNudge}
${movingIsolationNudge}
${swampedLifestyleDeferralNudge}
${overloadedMovementNudge}
${reciprocalPersonalNudge}
${casualTrainingBanterNudge}
${creativeTasteSubstanceNudge}
${recoveryRoutineRhythmNudge}
${busyGymFallbackNudge}
${homeGymTransitionNudge}
${momentumLossAfterTryingNudge}
${animalPassionNudge}
${petCalmFocusLoopNudge}
${chaoticQuietMomentNudge}
${petDeflectionNudge}
${extendedPetRapportNudge}
${temporaryDistractionNudge}
${painRecoveryNudge}
${procedureRecoverySafetyNudge}
${mentalNoiseNudge}
${illnessRecoveryNudge}
${selfSufficientProgressNudge}
${lostPastFitnessNudge}
${challengePositiveFeedbackNudge}
${earnedChallengeBridgeNudge}
${timeCapacityBarrierNudge}
${foodAfterthoughtCapacityNudge}
${simpleSustainableNoTimeNudge}
${tediousProjectNudge}
${travelViewLoopNudge}
${nostalgiaMemoryLoopNudge}
${vagueCreativeChaosNudge}
${builderProjectNudge}
${ethicalFoundationNudge}
${politeClosingNudge}

ACQUISITION RULES:
- Human first, coach second.
- The offer is the free 30-day challenge. Never call it a 7-day challenge or seven-day challenge.
- Keep the challenge invite invisible until the lead gives a real start/help signal or earns a soft bridge through enough specific context.
- Real invite signals: "i need help", "i dunno what i'm doing", "where do i start", "send the link", "i'm in", a clear join/start request, or an earned bridge after 3+ meaningful replies with relationship context plus a real blocker/goal.
- "What's included?" or "what does it involve?" is a program-info request. Answer it concretely first; do not ask to send the link in the same reply unless they ask for the link or to join.
- A request for tips/advice is not by itself a challenge invite signal. Give a useful answer first.
- If they ask for a trick/cue/drill, give one concrete cue or micro-drill before asking another question.
- If they ask what makes the challenge/program different or how it works, answer with concrete specifics before any link or invite.
- If they ask what challenges Shannon personally does, answer as a personal training/life question. Do not pitch the free challenge from that wording.
- Joking phrases like "send help", "starting from scratch", "need a kickstart", or "out of practice" are bridge signals, not invite signals. Ask one grounded follow-up first.
- A plateau plus "I've tried everything / nothing is changing" is a diagnostic moment, not an invite moment. Offer one useful next lens or ask one precise next question first.
- If the lead is a strong plant-based/vegan operator, respect their expertise. Answer briefly, then ask about their process rather than making Shannon sound stuck.
- If they frame veganism as a non-negotiable ethical foundation, do not ask how they make it easy or stay on track. Ask what people misunderstand or how it shapes daily choices.
- If the lead mentions AI, algorithms, bots, generated content, or models, do not repeat those words. Translate the point into normal human language.
- If they mention app glitches, logging, stale workouts, full-body plans, or simplifying tech, treat that as support/programming first. Do not pitch the free challenge from that frustration.
- If they give multiple clipped replies, stop asking bland small-talk questions. Add a sharper contextual hook or leave the door open.
- If they are naturally closing the topic with thanks/you too/enjoy, do not force a generic routine question.
- Friendly replies, "keen", "haha", "sounds good", food banter, or vague interest are not enough by themselves.
- Ask at most one question and use one question mark max. If no question is needed, do not ask one.
- Do not stack a rhetorical setup question with the real question, for example "what if...? what would...?" Make the setup a statement instead.
- This invite timing rule is lead-only. Do not use it for linked app users, paying clients, check-ins, or support threads.
- If the lead clearly asks about paid coaching, 1:1 coaching, one-on-one coaching, online coaching with Shannon, or coaching details/link, frame it as 1:1 coaching with Shannon and use https://future-balance.netlify.app/coaching.html. Do not convert that ask into the free challenge.
- Avoid stock lines like "what does a normal day look like", "are you much of a cook", "what are your goals", or "you training at the moment".
- If you do invite them, make it feel like the obvious next step for their words, not a pitch.
- If they have earned the bridge, do not add another generic discovery question first. Give the exact reason the challenge fits and ask if they want the details.
- Warmth is not enough by itself. After 2-3 rapport turns, look for one specific next handle that creates momentum: a blocker, a next target, a tiny doable step, a frustration, or a reason they care.
- When someone says they lack mental space, capacity, time, or energy, do not only mirror it back. Gently explore whether a smaller/no-thinking version would help.
- When someone is proud and self-sufficient, do not undermine them. Ask a performance-curiosity question that respects their autonomy.

${buildCoachBioBlock()}

Qualifier state:
${qualifierText}

Conversation timeline:
${transcript}

Their newest message:
${leadName}: ${currentLeadText}

Return JSON only:
{
  "messages": ["bubble 1", "bubble 2"],
  "intent": "rapport|qualify|support|invite|handoff",
  "why": "one short internal reason"
}

Rules:
- Total reply under ${maxCoachWords} words.
- 1 to 3 bubbles.
- The strings must contain only the exact DM text Shannon would send.`;
}

function normalizeCoachOutput(rawText, leadName) {
    const parsed = parseJsonObject(rawText);
    let messages = [];
    if (parsed && Array.isArray(parsed.messages)) {
        messages = parsed.messages;
    } else if (parsed && typeof parsed.message === 'string') {
        messages = [parsed.message];
    } else {
        messages = [rawText];
    }
    const cleaned = splitCoachDraftIntoDmBubbles(messages
        .map(value => stripLeadingGreeting(normalizeCoachDraftText(String(value || '')), leadName))
        .filter(Boolean));
    return {
        parsed,
        messages: cleaned.length ? cleaned : [],
        text: cleaned.join('\n'),
    };
}

async function generateLeadTurn({ persona, history, turnIndex, offline = false }) {
    if (offline) {
        const fixture = persona.fixture || [
            persona.opening,
            'yeah i have tried a few things but i always fall off',
            'i guess structure would help, i just hate feeling restricted',
            'what does the challenge actually involve?',
        ];
        const message = fixture[Math.min(turnIndex, fixture.length - 1)] || 'yeah that makes sense';
        return {
            message,
            state: turnIndex >= fixture.length - 1 ? 'hot' : 'neutral',
            join_intent: turnIndex >= fixture.length - 1 ? 75 : 35 + (turnIndex * 10),
            notes: 'offline fixture',
            model: 'offline-fixture',
        };
    }

    const prompt = buildLeadTurnPrompt({ persona, history, turnIndex });
    const { parsed } = await callJsonModel({
        prompt,
        label: 'lead-simulator',
        temperature: 0.75,
        maxOutputTokens: 3200,
    });
    return {
        message: String(parsed.message || '').trim(),
        state: String(parsed.state || 'neutral').trim(),
        join_intent: clampScore(Number(parsed.join_intent) / 10, 0) * 10,
        notes: String(parsed.notes || '').trim(),
        model: 'gemini-lead-simulator',
    };
}

async function generateCoachTurn({ leadName, history, currentLeadText, qualifier, coachModel = 'auto', offline = false }) {
    if (offline) {
        const helpSignal = hasChallengeInviteReadinessSignal(currentLeadText);
        const message = helpSignal
            ? "yeah that makes sense. easiest thing would be the free 30 day challenge, it gives you a bit of structure without turning food into a full time job. want me to send you the link?"
            : "yeah that makes sense, and honestly that is where most people get stuck. is it more the food side that throws you off, or the training routine?";
        return {
            messages: [message],
            text: message,
            model: 'offline-fixture',
            intent: helpSignal ? 'invite' : 'qualify',
            why: 'offline fixture',
        };
    }

    const prompt = buildCoachTurnPrompt({ leadName, history, currentLeadText, qualifier });
    const { raw, model } = await callCoachModel({
        prompt,
        coachModel,
        temperature: 0.78,
        maxOutputTokens: 3200,
    });
    const normalized = normalizeCoachOutput(raw, leadName);
    return {
        ...normalized,
        model,
        intent: normalized.parsed?.intent || '',
        why: normalized.parsed?.why || '',
    };
}

function buildJudgePrompt({ persona, history, turnIssues }) {
    return `You are judging an internal Balance Instagram DM sparring conversation.

The coach is Shannon. The goal is not to hard sell. The goal is to create a human conversation that can naturally lead to a free 30-day challenge when the lead shows a real help/start signal.

Persona hidden truth:
- ${persona.hiddenProfile}
- Objections: ${(persona.objections || []).join(', ') || 'none'}

Conversation:
${transcriptToText(history)}

Detected mechanical issues:
${turnIssues.length ? turnIssues.map(issue => `- turn ${issue.turn}: ${issue.issues.join(', ')}`).join('\n') : '(none)'}

Score 0-10:
- felt_human: did it feel like a real person texting?
- heard_first: did Shannon notice the lead before coaching?
- context_use: did he use their exact words/context?
- not_boring: did the conversation have a live hook?
- not_salesy: did it avoid funnel breath?
- question_quality: were questions specific and not generic?
- invite_timing: did Shannon invite only when it was actually time? Score high when he correctly holds off during pure rapport or unclear interest. Score low for pitching too early, failing to invite after an obvious "send the link / I need help" signal, or turning every warm chat into a pitch.
- A soft challenge bridge can be earned without exact "send the link" wording when the lead has given 3+ meaningful replies, real relationship context, and a clear blocker/goal. In that case, score invite_timing high if the invite is anchored to their exact situation and optional.
- Score lower for conversion if Shannon keeps asking generic discovery questions after an earned bridge moment. The goal is not endless rapport.
- If the lead directly asked for tips/advice, Shannon should answer with at least one small practical tip before inviting. Inviting instead of answering is premature and should use ignored_direct_question and/or premature_invite.
- If the lead asks for a trick/cue/drill, score low for asking another diagnostic question without giving a concrete cue first.
- If the lead asks what makes the program different, what the real deal is, or how it adapts, score low for link-pitching before giving concrete details.
- If the lead says they are plateaued, stuck, or have tried lots of fixes with no change, Shannon should give one specific diagnostic/insight or ask one precise plateau question before inviting. Inviting off that frustration alone is premature and should use premature_invite, missed_specific_hook, and/or no_progression.
- If the lead is clearly advanced in plant-based nutrition or ethics, Shannon should avoid turning the conversation into a confession of his own gaps. Score low if he misses their expertise instead of asking a respectful process question.
- If the lead frames veganism as an ethical foundation, score low for trivializing it into convenience, discipline, "stay on track", or training consistency.
- Any public-facing mention of AI, automation, algorithms, models, Gemini, ChatGPT, or training data is a risk even if the lead said it first. Shannon should paraphrase the human meaning without repeating those words.
- If the lead is asking for app support or a specific workout plan, score low for converting that support request into a 30-day challenge pitch. Shannon should solve/clarify the request first.
- If the lead gives multiple clipped low-effort replies, score low for generic small talk that earns a ghost. Better replies either create a specific playful hook or gracefully stop asking for effort.
- If the lead is politely closing a topic, score low for dragging them into a generic routine/habit question.
- likely_reply: would this person reply?
- likely_join: would this person join the challenge eventually? Score higher when Shannon creates a clear, low-pressure next step from the lead's exact blocker; score lower when the thread stays friendly but does not move anywhere.

Use risk_flags only for actual problems, not ordinary strategic caveats. If a conversation is going well but needs more time, use [].
- Use ghosted only when Shannon likely caused the disengagement. If the lead already said "bye", "I'm out", or otherwise clearly opted out and Shannon respected it, do not use ghosted.
- If the persona/opening has genuinely zero intent, accidental contact, wrong-chat energy, or a clear "Bye", the goal is respectful exit, not conversion. No reply after a respectful non-salesy exit is not a failure.
Allowed risk_flags:
premature_invite, too_salesy, stock_question, too_many_questions, validation_loop, no_progression, missed_specific_hook, too_generic, ignored_direct_question, ghosted, privacy_leak, ai_disclosure

Return JSON only:
{
  "felt_human": 0,
  "heard_first": 0,
  "context_use": 0,
  "not_boring": 0,
  "not_salesy": 0,
  "question_quality": 0,
  "invite_timing": 0,
  "likely_reply": 0,
  "likely_join": 0,
  "overall": 0,
  "likely_outcome": "short phrase",
  "risk_flags": ["flag"],
  "best_moment": "short quote or moment",
  "weakest_moment": "short quote or moment",
  "prompt_rule_suggestion": "one practical prompt/rule improvement"
}`;
}

function heuristicScore({ history, turnIssues }) {
    const allIssues = turnIssues.flatMap(item => item.issues);
    const penalty = Math.min(5, allIssues.length * 1.2);
    const hasInvite = history.some(item => item.role === 'coach' && isChallengeOfferWarningText(item.text));
    const hasHelpSignal = history.some(item => item.role === 'lead' && hasChallengeInviteReadinessSignal(item.text));
    const noReply = history.some(item => item.no_reply);
    const base = hasInvite && hasHelpSignal ? 7.5 : 6.4;
    const inviteTiming = allIssues.includes('premature_challenge_invite') ? 2 : (hasInvite ? 8 : 9);
    return normalizeScorecard({
        felt_human: base,
        heard_first: base,
        context_use: base - 0.5,
        not_boring: base - 0.4,
        not_salesy: base - penalty,
        question_quality: allIssues.includes('stock_discovery_question') ? 3 : base - 0.4,
        invite_timing: inviteTiming,
        likely_reply: noReply ? 2.5 : base - (penalty / 2),
        likely_join: noReply ? 2 : (hasInvite && hasHelpSignal ? 7 : 4.5),
        risk_flags: allIssues,
        likely_outcome: 'heuristic only, run with GEMINI_API_KEY for judge scoring',
        best_moment: '',
        weakest_moment: allIssues[0] || '',
        prompt_rule_suggestion: allIssues.includes('premature_challenge_invite')
            ? 'Hold the challenge invite until the lead gives a clear help/start signal or earns the 3-6 reply soft bridge.'
            : 'Use the strongest detail from the lead before asking the next question.',
    });
}

async function scoreTranscript({ persona, history, turnIssues, offline = false }) {
    if (offline) {
        return adjustScorecardForAcceptedNoReply(heuristicScore({ history, turnIssues }), { persona, history });
    }
    try {
        const prompt = buildJudgePrompt({ persona, history, turnIssues });
        const { parsed } = await callJsonModel({
            prompt,
            label: 'sparring-judge',
            temperature: 0.2,
            maxOutputTokens: 3600,
        });
        return adjustScorecardForAcceptedNoReply(normalizeScorecard(parsed), { persona, history });
    } catch (err) {
        const score = heuristicScore({ history, turnIssues });
        score.risk_flags = [...new Set([...score.risk_flags, `judge_failed:${err.message}`])];
        return adjustScorecardForAcceptedNoReply(score, { persona, history });
    }
}

async function maybeEvaluateSimQualifier({ qualifier, history, currentLeadText, leadName, enabled, offline }) {
    if (!enabled || offline) return { qualifier, model: offline ? 'offline' : 'disabled', evaluated: false };
    try {
        const result = await evaluateQualifier({
            thread: {
                qualifier,
                custom_data: { source: 'dm_sparring_gym' },
            },
            history: historyToIgMessages(history),
            currentMessage: currentLeadText,
            draftText: '',
            leadName,
            channel: 'instagram',
        });
        return result;
    } catch (err) {
        return { qualifier, model: 'failed', evaluated: false, error: err.message };
    }
}

async function runSparringConversation({
    persona,
    turns = 4,
    coachModel = 'auto',
    qualifierEnabled = true,
    storyBots = true,
    offline = false,
} = {}) {
    const history = [];
    const turnIssues = [];
    const modelCalls = [];
    const scenario = await generateScenarioPersona({ persona, storyBots, offline });
    const activePersona = scenario.persona || persona;
    modelCalls.push(...(scenario.model_calls || []));
    if (scenario.story_error) {
        modelCalls.push({ role: 'scenario', model: 'failed', error: scenario.story_error });
    }
    let qualifier = freshQualifier({ hookContext: activePersona.hookContext });

    for (let turn = 0; turn < turns; turn += 1) {
        const leadTurn = await generateLeadTurn({ persona: activePersona, history, turnIndex: turn, offline });
        modelCalls.push({ turn, role: 'lead', model: leadTurn.model });
        if (!leadTurn.message || leadTurn.state === 'ghosted') {
            appendMessage(history, {
                role: 'lead',
                speaker: activePersona.name,
                text: '[no reply]',
                state: leadTurn.state || 'ghosted',
                join_intent: leadTurn.join_intent,
                notes: leadTurn.notes,
                no_reply: true,
            });
            break;
        }
        appendMessage(history, {
            role: 'lead',
            speaker: activePersona.name,
            text: leadTurn.message,
            state: leadTurn.state,
            join_intent: leadTurn.join_intent,
            notes: leadTurn.notes,
        });

        const qualifierResult = await maybeEvaluateSimQualifier({
            qualifier,
            history,
            currentLeadText: leadTurn.message,
            leadName: activePersona.name,
            enabled: qualifierEnabled,
            offline,
        });
        qualifier = qualifierResult.qualifier || qualifier;
        modelCalls.push({ turn, role: 'qualifier', model: qualifierResult.model || 'none', evaluated: !!qualifierResult.evaluated });

        const coachTurn = await generateCoachTurn({
            leadName: activePersona.name,
            history,
            currentLeadText: leadTurn.message,
            qualifier,
            coachModel,
            offline,
        });
        modelCalls.push({ turn, role: 'coach', model: coachTurn.model });
        const coachText = coachTurn.text || coachTurn.messages.join('\n');
        appendMessage(history, {
            role: 'coach',
            speaker: 'Shannon',
            text: coachText,
            intent: coachTurn.intent,
            why: coachTurn.why,
        });

        const issues = detectCoachTurnIssues({
            coachText,
            leadText: leadTurn.message,
            qualifier,
            leadStage: 'qualifying',
            leadReplyCount: qualifier?.meaningful_lead_reply_count,
        });
        if (issues.length) turnIssues.push({ turn: turn + 1, issues, coachText, leadText: leadTurn.message });

        if (leadTurn.state === 'won' || leadTurn.state === 'lost') {
            break;
        }
    }

    const effectiveTurnIssues = suppressAcceptedNoReplyTurnIssues(turnIssues, { persona: activePersona, history });
    const scorecard = await scoreTranscript({ persona: activePersona, history, turnIssues: effectiveTurnIssues, offline });
    return {
        persona_key: activePersona.key,
        persona_name: activePersona.name,
        route: activePersona.route,
        hook_context: activePersona.hookContext,
        hidden_profile: activePersona.hiddenProfile,
        story_notes: activePersona.storyNotes || '',
        source_thread_id: activePersona.source_thread_id || null,
        source_outcome: activePersona.source_outcome || null,
        source_counts: activePersona.source_counts || null,
        transcript: history,
        qualifier,
        turn_issues: effectiveTurnIssues,
        suppressed_turn_issues: effectiveTurnIssues.length === turnIssues.length ? [] : turnIssues,
        scorecard,
        model_calls: modelCalls,
    };
}

function summarizeBatch(conversations) {
    const count = conversations.length || 1;
    const averages = {};
    for (const field of ['overall', ...SCORE_FIELDS]) {
        averages[field] = clampScore(
            conversations.reduce((sum, convo) => sum + Number(convo.scorecard?.[field] || 0), 0) / count,
            0
        );
    }
    const riskCounts = {};
    for (const convo of conversations) {
        for (const flag of convo.scorecard?.risk_flags || []) {
            riskCounts[flag] = (riskCounts[flag] || 0) + 1;
        }
        for (const issue of convo.turn_issues || []) {
            for (const flag of issue.issues || []) {
                riskCounts[flag] = (riskCounts[flag] || 0) + 1;
            }
        }
    }
    const promptSuggestions = conversations
        .map(convo => convo.scorecard?.prompt_rule_suggestion)
        .filter(Boolean);
    return {
        count: conversations.length,
        averages,
        risk_counts: riskCounts,
        prompt_suggestions: [...new Set(promptSuggestions)].slice(0, 8),
        best: [...conversations].sort((a, b) => (b.scorecard?.overall || 0) - (a.scorecard?.overall || 0))[0] || null,
        weakest: [...conversations].sort((a, b) => (a.scorecard?.overall || 0) - (b.scorecard?.overall || 0))[0] || null,
    };
}

async function runSparringBatch({
    count = 3,
    turns = 4,
    seed = new Date().toISOString().slice(0, 10),
    personaKeys = [],
    personas = null,
    coachModel = 'auto',
    qualifierEnabled = true,
    storyBots = true,
    offline = false,
} = {}) {
    const baseSource = Array.isArray(personas) && personas.length ? personas : DEFAULT_PERSONAS;
    const selectedSource = personaKeys.length
        ? baseSource.filter(persona => personaKeys.includes(persona.key))
        : baseSource;
    const pickedPersonas = choosePersonas({ personas: selectedSource, count, seed });
    const conversations = [];
    for (const [index, persona] of pickedPersonas.entries()) {
        const conversation = await runSparringConversation({
            persona,
            turns,
            coachModel,
            qualifierEnabled,
            storyBots,
            offline,
        });
        conversation.index = index + 1;
        conversations.push(conversation);
    }
    return {
        generated_at: new Date().toISOString(),
        seed,
        count: conversations.length,
        turns,
        coach_model: coachModel,
        qualifier_enabled: qualifierEnabled,
        story_bots: storyBots,
        offline,
        conversations,
        summary: summarizeBatch(conversations),
    };
}

function renderMarkdownReport(batch) {
    const lines = [];
    lines.push(`# DM Sparring Gym Report`);
    lines.push('');
    lines.push(`Generated: ${batch.generated_at}`);
    lines.push(`Seed: ${batch.seed}`);
    lines.push(`Runs: ${batch.count}, turns each: ${batch.turns}, coach model: ${batch.coach_model}, qualifier: ${batch.qualifier_enabled ? 'on' : 'off'}, story bots: ${batch.story_bots ? 'on' : 'off'}`);
    lines.push('');
    lines.push(`## Summary`);
    lines.push('');
    lines.push(`Overall average: ${batch.summary.averages.overall}/10`);
    lines.push(`Likely reply: ${batch.summary.averages.likely_reply}/10`);
    lines.push(`Likely join: ${batch.summary.averages.likely_join}/10`);
    lines.push(`Invite timing: ${batch.summary.averages.invite_timing}/10`);
    lines.push('');
    const riskEntries = Object.entries(batch.summary.risk_counts || {}).sort((a, b) => b[1] - a[1]);
    if (riskEntries.length) {
        lines.push(`## Risks`);
        lines.push('');
        for (const [risk, total] of riskEntries) {
            lines.push(`- ${risk}: ${total}`);
        }
        lines.push('');
    }
    if (batch.summary.prompt_suggestions?.length) {
        lines.push(`## Prompt Rules To Consider`);
        lines.push('');
        for (const suggestion of batch.summary.prompt_suggestions) {
            lines.push(`- ${suggestion}`);
        }
        lines.push('');
    }
    lines.push(`## Conversations`);
    for (const convo of batch.conversations) {
        lines.push('');
        lines.push(`### ${convo.index}. ${convo.persona_name} (${convo.persona_key})`);
        lines.push('');
        lines.push(`Score: ${convo.scorecard.overall}/10`);
        if (convo.source_outcome) lines.push(`Real-data source outcome: ${convo.source_outcome}`);
        if (convo.story_notes) lines.push(`Story notes: ${convo.story_notes}`);
        lines.push(`Likely outcome: ${convo.scorecard.likely_outcome || 'n/a'}`);
        if (convo.scorecard.best_moment) lines.push(`Best moment: ${convo.scorecard.best_moment}`);
        if (convo.scorecard.weakest_moment) lines.push(`Weakest moment: ${convo.scorecard.weakest_moment}`);
        lines.push('');
        for (const item of convo.transcript) {
            if (item.no_reply) {
                lines.push(`**${item.speaker}:** _(no reply / left on seen)_`);
            } else {
                lines.push(`**${item.speaker}:** ${item.text.replace(/\n/g, '<br>')}`);
            }
            lines.push('');
        }
    }
    return lines.join('\n');
}

module.exports = {
    DEFAULT_PERSONAS,
    SCORE_FIELDS,
    choosePersonas,
    parseJsonObject,
    clampScore,
    normalizeScorecard,
    mergeScenarioPersona,
    sanitizePersonaSourceText,
    sanitizeGeneratedPersona,
    normalizePersonaRoute,
    detectCoachTurnIssues,
    isAcceptedNoReplyConversation,
    adjustScorecardForAcceptedNoReply,
    transcriptToText,
    historyToIgMessages,
    loadRealIgThreadSamples,
    derivePersonasFromDatabase,
    runSparringConversation,
    runSparringBatch,
    summarizeBatch,
    renderMarkdownReport,
    formatCoachLocalTimestamp,
};
