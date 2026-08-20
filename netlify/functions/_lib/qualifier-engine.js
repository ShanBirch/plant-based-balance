/**
 * Lead Qualifier Engine
 *
 * Per-lead funnel intelligence layered on top of the IG/FB instant-draft
 * pipeline. After every inbound DM from a non-converted lead, this module:
 *
 *   1. Pulls the current qualifier state from ig_threads.qualifier
 *   2. Asks Gemini Flash: "given the conversation so far, what's their
 *      stage, what do we know, how warm are they, and what next move should
 *      Shannon use, with a quote-grounded reason"
 *   3. Persists the updated state back to ig_threads.qualifier
 *   4. Formats the qualifier strip for the push notification + alert card
 *
 * The 4-stage playbook (offer-agnostic — handles plant-based AND generic):
 *
 *   1. Current state     — food + movement + energy now
 *   2. Motivation        — the deeper outcome
 *   3. History + blockers — what they've tried, what stopped them
 *   4. Commitment        — ready to start, save them a spot
 *
 * Plus auto-captured `hook_context` (how Shannon opened the conversation —
 * his first DM to them or the ad's referrer field) and terminal states `pitched`,
 * `won`, `lost`, `paused`. `pitched` means Shannon offered the Plant-Based Fitness Founders Pass.
 * `won` means they accepted the offer or signed up.
 *
 * Stages aren't sequential gates. Facts can land out of order if the lead
 * volunteers them. The AI decides whether THIS turn warrants pushing the
 * next elicitation move — `is_question_moment=false` means "just chat, no push".
 *
 * Pace adapts: minutes-to-months. The AI sees timestamps in the history and
 * judges contextually (re-open after silence, accelerate when they're hot).
 */

const {
    supabaseQuery,
    callGeminiFallback,
    callVertexGeminiMultimodal,
    truncate,
    formatCoachLocalTimestamp,
    formatTimedConversationLine,
} = require('./client-context');
const {
    resolveIgAcquisitionMode,
    buildAcquisitionModePromptBlock,
} = require('./ig-acquisition-mode');

// ============================================================
// Playbook
// ============================================================

// The visible funnel remains 4 stages, but stage 1 now includes a rapport
// gate. Store social context in facts.relationship_context before letting the
// model push deeper goal/blocker questions.
const STAGES = [
    {
        key: 'current_state',
        index: 1,
        label: 'Rapport + current state',
        what_to_learn: 'what their real life is like, then whether health, food, training, energy, or consistency feels easy, hard, or worth changing',
        strategy: 'keep rapport first. only push when their own words create a natural bridge toward health or fitness, and aim for them to name the thing they want help with',
    },
    {
        key: 'motivation',
        index: 2,
        label: 'Motivation',
        what_to_learn: 'the deeper outcome they actually want (feel sexy, keep up with kids, stop feeling tired) — not the surface "lose weight"',
        strategy: 'only dig here after they have shown a real health, fitness, body, energy, or consistency signal. use their words instead of a generic goal question',
    },
    {
        key: 'history_blockers',
        index: 3,
        label: 'History + blockers',
        what_to_learn: "what they've tried before and what got in the way — pre-empts the objection",
        strategy: 'use statement-led elicitation only when they have already admitted some friction. the point is to clarify the help they need, not interview them',
    },
    {
        key: 'commitment',
        index: 4,
        label: 'Commitment',
        what_to_learn: 'ready-to-start signal for the Balance Plant-Based Fitness Founders Pass + the real-life situation it can naturally support',
        strategy: 'when they ask how to start, ask for the link, plainly say they need help, or have earned a soft bridge, explain the weekly coaching setup from their exact context before using another close or sending the link',
    },
];

const RELATIONSHIP_CHECKLIST = [
    {
        key: 'location',
        label: 'Location',
        what_to_learn: 'where they are based or the community they live around',
    },
    {
        key: 'work_study',
        label: 'Work/study',
        what_to_learn: 'job, study, shift pattern, business, or weekly pressure',
    },
    {
        key: 'household_family',
        label: 'Household/family',
        what_to_learn: 'partner, kids, family members, who they look after, names when volunteered',
    },
    {
        key: 'pets',
        label: 'Pets',
        what_to_learn: 'dogs/pets, names, walks, and how they fit into the day',
    },
    {
        key: 'daily_rhythm',
        label: 'Daily rhythm',
        what_to_learn: 'how their week affects health, energy, food, and training, only when that comes up naturally',
    },
    {
        key: 'food_setup',
        label: 'Food setup',
        what_to_learn: 'whether food makes getting healthier easier or harder, only when they bring up food or consistency',
    },
    {
        key: 'training_background',
        label: 'Training background',
        what_to_learn: 'training history, sport, walking, injuries, and what makes movement easier or harder',
    },
    {
        key: 'loves',
        label: 'What they love',
        what_to_learn: 'people, pets, places, hobbies, foods, routines, sport, or little rituals that light them up',
    },
    {
        key: 'stressors_frustrations',
        label: 'Stressors/frustrations',
        what_to_learn: 'what ticks them off, stresses them, makes health feel harder, or makes them feel judged',
    },
];

const RELATIONSHIP_CHECKLIST_KEYS = RELATIONSHIP_CHECKLIST.map(item => item.key);

const TERMINAL_STAGES = new Set(['pitched', 'won', 'lost', 'paused']);
const ALL_STAGE_KEYS = new Set([...STAGES.map(s => s.key), ...TERMINAL_STAGES]);

const WARMTH_LABELS = [
    { max: 25, label: 'cold' },
    { max: 50, label: 'lukewarm' },
    { max: 75, label: 'warm' },
    { max: 100, label: 'hot' },
];

const COMMERCIAL_STAGES = [
    'engaged',
    'problem_qualified',
    'offer_ready',
    'buyer_intent',
];

const BEHAVIOR_PROFILE_OPTIONS = {
    primary_need: [
        'unknown',
        'structure',
        'accountability',
        'clarity',
        'confidence',
        'food_simplicity',
        'training_direction',
        'support',
        'autonomy',
    ],
    protection_pattern: [
        'unknown',
        'fear_of_failing_again',
        'hates_being_sold_to',
        'needs_autonomy',
        'overwhelmed_by_options',
        'already_knows_what_to_do',
        'skeptical_of_another_plan',
        'local_or_in_person_preference',
        'existing_support_or_trainer',
        'low_bandwidth',
        'price_sensitivity',
    ],
    autonomy_sensitivity: ['unknown', 'low', 'medium', 'high'],
    sales_readiness: [
        'rapport',
        'problem_named',
        'protection_named',
        'identity_confirmed',
        'bridge_ready',
        'link_ready',
        'not_now',
    ],
};

function cleanFactValue(value) {
    if (value == null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\(?\s*(unknown|none|n\/a|null|not sure|unsure)\s*\)?$/i.test(trimmed)) return null;
    return trimmed;
}

function normalizeEnumValue(value, allowed, fallback = 'unknown') {
    const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return allowed.includes(raw) ? raw : fallback;
}

function cleanProfileText(value, max = 160) {
    const cleaned = cleanFactValue(value);
    if (cleaned == null) return null;
    return truncate(String(cleaned).replace(/\s+/g, ' ').trim(), max);
}

function normalizeBehaviorProfile(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        primary_need: normalizeEnumValue(source.primary_need, BEHAVIOR_PROFILE_OPTIONS.primary_need),
        protection_pattern: normalizeEnumValue(source.protection_pattern, BEHAVIOR_PROFILE_OPTIONS.protection_pattern),
        autonomy_sensitivity: normalizeEnumValue(source.autonomy_sensitivity, BEHAVIOR_PROFILE_OPTIONS.autonomy_sensitivity),
        sales_readiness: normalizeEnumValue(source.sales_readiness, BEHAVIOR_PROFILE_OPTIONS.sales_readiness, 'rapport'),
        identity_signal: cleanProfileText(source.identity_signal, 140),
        best_next_move: cleanProfileText(source.best_next_move, 180),
    };
}

function hasDirectBuyerIntent(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!text) return false;
    return /^(?:how much|price\??|pricing\??|cost\??|what(?:'s| is) (?:actually )?included\??|what do i get\??|send (?:me )?(?:the )?(?:link|details)\b)/i.test(text)
        || /\b(?:can|could) you send (?:me )?(?:the )?(?:link|details)\b/i.test(text)
        || /\b(?:can|could|how do|where do) i (?:join|start|sign up|get (?:the )?(?:link|details))\b/i.test(text)
        || /\b(?:i(?:'m| am)|im) (?:in|keen|ready)(?:\b| to (?:join|start|sign up))/i.test(text)
        || /\b(?:i want|i'd like|i would like|keen|ready) to (?:join|start|sign up|work with you)\b/i.test(text)
    || /\b(?:coaching|starter coaching|founders pass|founding membership|balance|work with you|your (?:program|coaching))\b.{0,80}\b(?:price|cost|details|included|inclusions|link|join|sign up|start)\b/i.test(text)
    || /\b(?:price|cost|details|included|inclusions|link|join|sign up)\b.{0,80}\b(?:coaching|starter coaching|founders pass|founding membership|balance|work with you|your (?:program|coaching))\b/i.test(text);
}

function hasCommercialProblemEvidence(qualifier = {}) {
    const behavior = normalizeBehaviorProfile(qualifier.behavior_profile);
    const facts = qualifier.facts || {};
    const relevantNeed = behavior.primary_need && behavior.primary_need !== 'unknown';
    const currentState = String(facts.current_state || '');
    const motivation = String(facts.motivation || '');
    const blockers = String(facts.history_blockers || '');
    const commitment = String(facts.commitment || '');
    const combined = `${currentState} ${motivation} ${blockers}`.toLowerCase();
    const domainSignal = /\b(train|training|workout|gym|food|meal|nutrition|weight|fat|muscle|strength|fitness|energy|routine|consistent|consistency|accountability|exercise|pilates|running|cardio|health|body)\b/i.test(combined);
    const goalEvidence = hasUsefulFact(motivation)
        || /\b(?:want|goal|aim|trying|working toward|would like|build|lose|gain|improve|get back|become)\b/i.test(`${currentState} ${motivation}`);
    const blockerEvidence = /\b(?:struggl|stuck|hard|difficult|derail|disrupt|drop(?:ping)? off|fall(?:ing)? off|inconsisten|lack|keep forgetting|never stick|low energy|burnt out|overwhelm|time|shift|pain|recover|plateau|not getting results?|can't|cannot|keep[s]? me from|gets? in the way)\b/i.test(`${currentState} ${blockers}`);
    const noRealBlocker = /\b(?:no|not) (?:real |actual |major |much of a )?(?:problem|issue|blocker|struggle)|\bnothing (?:really )?(?:stops|disrupts|gets in the way)|\btakes a lot to stop me|\btraining is (?:just )?part of (?:my )?life|\balready (?:very )?consistent\b/i.test(`${currentState} ${blockers}`);
    const existingSupport = behavior.protection_pattern === 'existing_support_or_trainer'
        || /\b(?:already|currently) (?:have|using|working with|following) (?:a |my )?(?:coach|trainer|pt|program)|\bmy (?:coach|trainer|pt|program)\b/i.test(combined);
    const declined = behavior.sales_readiness === 'not_now'
        || /\b(?:not interested|not right now|maybe later|no thanks|already sorted|don't need|do not need)\b/i.test(`${commitment} ${currentState} ${blockers}`);
    const peerOnly = /\b(my clients?|my business|who to coach|as a coach|as a practitioner|with clients?)\b/i.test(combined)
        && !/\b(i|my)\b.{0,30}\b(struggl|need|want|goal|training|food|weight|energy|routine)\b/i.test(combined);
    const petOrGriefOnly = /\b(?:my|our)\s+(?:dog|cat|rabbit|pet|puppy|kitten)\b|\b(?:vet|put (?:him|her|them) down|passed away|died|dying|funeral|grief|grieving)\b/i.test(combined)
        && !/\bmy\s+(?:training|workouts?|food|nutrition|weight|fitness|energy|routine|consistency|health|body|goal)\b|\bi(?:'m| am)\s+(?:struggling|trying|working|training|aiming)\b/i.test(combined);
    return relevantNeed
        && domainSignal
        && goalEvidence
        && blockerEvidence
        && !noRealBlocker
        && !existingSupport
        && !declined
        && !peerOnly
        && !petOrGriefOnly;
}

function normalizeCommercialStage(value, fallback = 'engaged') {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return COMMERCIAL_STAGES.includes(normalized) ? normalized : fallback;
}

function deriveCommercialStage({ qualifier = {}, currentMessage = '', proposedStage = '' } = {}) {
    const behavior = normalizeBehaviorProfile(qualifier.behavior_profile);
    const replies = Math.max(0, Number(qualifier.meaningful_lead_reply_count || 0));
    if (qualifier.stage === 'lost' || behavior.sales_readiness === 'not_now') return 'engaged';
    if (hasDirectBuyerIntent(currentMessage)) return 'buyer_intent';

    const prior = normalizeCommercialStage(qualifier.commercial_stage);
    if (behavior.sales_readiness === 'link_ready' || prior === 'buyer_intent') return 'buyer_intent';

    const hasProblem = hasCommercialProblemEvidence(qualifier) && replies >= 3;
    if (!hasProblem) return 'engaged';

    const proposed = normalizeCommercialStage(proposedStage);
    if (
        proposed === 'offer_ready'
        || proposed === 'buyer_intent'
        || prior === 'offer_ready'
        || behavior.sales_readiness === 'bridge_ready'
    ) return 'offer_ready';
    return 'problem_qualified';
}

function mergeBehaviorProfiles(priorProfile = {}, parsedProfile = {}) {
    const prior = normalizeBehaviorProfile(priorProfile);
    const parsed = normalizeBehaviorProfile(parsedProfile);
    const hasParsed = parsedProfile && typeof parsedProfile === 'object';
    if (!hasParsed) return prior;
    return {
        primary_need: parsed.primary_need !== 'unknown' ? parsed.primary_need : prior.primary_need,
        protection_pattern: parsed.protection_pattern !== 'unknown' ? parsed.protection_pattern : prior.protection_pattern,
        autonomy_sensitivity: parsed.autonomy_sensitivity !== 'unknown' ? parsed.autonomy_sensitivity : prior.autonomy_sensitivity,
        sales_readiness: parsed.sales_readiness !== 'rapport' || prior.sales_readiness === 'rapport'
            ? parsed.sales_readiness
            : prior.sales_readiness,
        identity_signal: parsed.identity_signal ?? prior.identity_signal,
        best_next_move: parsed.best_next_move ?? prior.best_next_move,
    };
}

function warmthLabelFor(score) {
    const n = Math.max(0, Math.min(100, Number(score) || 0));
    for (const tier of WARMTH_LABELS) {
        if (n <= tier.max) return tier.label;
    }
    return 'cold';
}

function stageMetaFor(stageKey) {
    return STAGES.find(s => s.key === stageKey) || null;
}

function hasUsefulFact(value) {
    return cleanFactValue(value) != null;
}

function normalizeRelationshipChecklist(rawFacts = {}) {
    const source = rawFacts.relationship_checklist && typeof rawFacts.relationship_checklist === 'object'
        ? rawFacts.relationship_checklist
        : rawFacts;
    const checklist = {};
    for (const key of RELATIONSHIP_CHECKLIST_KEYS) {
        checklist[key] = cleanFactValue(source?.[key]);
    }
    return checklist;
}

function completedRelationshipKeys(facts = {}) {
    const checklist = normalizeRelationshipChecklist(facts);
    return RELATIONSHIP_CHECKLIST_KEYS.filter(key => hasUsefulFact(checklist[key]));
}

function missingRelationshipItems(facts = {}) {
    const done = new Set(completedRelationshipKeys(facts));
    return RELATIONSHIP_CHECKLIST.filter(item => !done.has(item.key));
}

function hasAnyRelationshipAnchor(facts = {}) {
    return hasUsefulFact(facts.relationship_context) || completedRelationshipKeys(facts).length > 0;
}

function hasChallengeContext(text) {
    return /\b(challenge|30\s*day|30-day|program|app|plan|coaching|coach|signup|sign up|link|spot|start monday)\b/i.test(String(text || ''));
}

function isAccountSupportLinkContext(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    if (/\b(30\s*day|30-day|free challenge|plant.?based challenge|transform challenge|challenge link|sign ?up|signup|join)\b/i.test(s)) {
        return false;
    }
    return /\b(reset link|password reset|password|login|log in|locked out|face id|face recognition|old email|spam|manual(?:ly)? reset|reset it|reset this|uninstall|reinstall|reconnect(?:ed|ing)?|connect(?:ed|ing)? back|app helper|balance helper|balance app helper|account access|app access|app glitch|tech tangle|tech hassle)\b/i.test(s);
}

function hasHumanHelpIntent(text) {
    const s = String(text || '').toLowerCase();
    return /\b(i\s+need\s+help|need\s+(some\s+)?help|can\s+you\s+help|could\s+you\s+help|help\s+me|i\s+don'?t\s+know\s+what\s+i'?m\s+doing|i\s+dunno\s+what\s+i'?m\s+doing|dunno\s+what\s+i'?m\s+doing|no\s+idea\s+what\s+i'?m\s+doing|i'?m\s+lost|feel\s+lost|where\s+do\s+i\s+start|what\s+do\s+i\s+do|what\s+should\s+i\s+do)\b/i.test(s);
}

function hasSolutionSeekingOverwhelm(text) {
    return /\b(constantly trying to piece|piecing .* together|tired of piecing|exhausting trying to optimi[sz]e|cut through the noise|i just want .*effort .*paying off|want .*effort .*pay off|hard to tell what'?s actually working|overwhelming to figure out alone|figure it out alone|how do you actually help|how do you help people|help people with that|don'?t have to guess)\b/i.test(String(text || ''));
}

function hasSpecificHelpOrBlockerSignal(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    if (hasHumanHelpIntent(s) || hasSolutionSeekingOverwhelm(s)) return true;
    const domainSignal = /\b(training|train|workout|gym|fitness|exercise|movement|walking|steps|food|meal|diet|vegan|plant.?based|vegetarian|protein|energy|weight|body|confidence|strength|consistent|consistency|motivation|health|routine)\b/i.test(s);
    const blockerSignal = /\b(struggl\w*|hard|stuck|lost|no idea|fall(?:ing)? off|fell off|tired|drained|low energy|sluggish|not my best|overwhelm\w*|no time|too busy|capacity|frustrat\w*|not working|can'?t stick|cannot stick|need help|want to get back|where do i start|plateau|nothing'?s? changing)\b/i.test(s);
    return domainSignal && blockerSignal;
}

function hasChallengeLogisticsQuestion(text) {
    return /\b(start dates?|commitment level|miss (a )?few days|miss days|start(s|ing)? (a bit )?later|self.?paced|how much time|what does it involve|what'?s involved|details|send.*details)\b/i.test(String(text || ''));
}

function isInPersonOrExistingCoachPreference(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    const localTrainer = /\b(local|near me|nearby|in[ -]?person|face[ -]?to[ -]?face|at (?:a|the) gym|gym based|gold coast|brisbane|melbourne|sydney)\b.{0,70}\b(trainer|coach|pt|personal training|personal trainer|coaching)\b/i.test(s)
        || /\b(trainer|coach|pt|personal training|personal trainer|coaching)\b.{0,70}\b(local|near me|nearby|in[ -]?person|face[ -]?to[ -]?face|at (?:a|the) gym|gym based)\b/i.test(s)
        || /\b(still\s+)?looking for (?:a\s+)?local (?:trainer|coach|pt|personal trainer)\b/i.test(s)
        || /\b(is|are|was|would)\s+(?:that|this|it)\s+in[ -]?person\b/i.test(s)
        || /\bdo you do in[ -]?person\b/i.test(s);
    const existingCoach = /\b(my|current|existing|already have|already got|working with|work with)\b.{0,45}\b(trainer|coach|pt|personal trainer)\b/i.test(s)
        || /\b(trainer|coach|pt|personal trainer)\b.{0,45}\b(reviews?|writes?|sets?|gave|gives|program|plan|macros?|checks?)\b/i.test(s)
        || /\b(how|would|can)\b.{0,60}\b(work|fit|sit|go)\b.{0,60}\b(with|around|alongside)\b.{0,45}\b(my|a|the)\s+(trainer|coach|pt|personal trainer)\b/i.test(s)
        || /\breplace (?:my|a|the) (trainer|coach|pt|personal trainer)\b/i.test(s);
    return localTrainer || existingCoach;
}

function hasOnlineCoachingAcceptanceSignal(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    return /\b(online|remote|check-?ins?|1\s*[:v]\s*1|one.?on.?one)\b.{0,80}\b(works?|fine|ok(?:ay)?|happy|keen|interested|send|details|link|start|join)\b/i.test(s)
        || /\b(send|details|link|start|join|keen)\b.{0,80}\b(online|remote|1\s*[:v]\s*1|one.?on.?one|coaching)\b/i.test(s);
}

function handlesInPersonOrExistingCoachPreference(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    return /\b(where are you based|what area|what suburb|how local|what'?s been tricky about finding|what has been tricky about finding|only wanting in[ -]?person|set on in[ -]?person|need it to be in[ -]?person)\b/i.test(s)
        || /\b(if you'?re (?:only )?(?:after|wanting|set on) in[ -]?person|if in[ -]?person is the main thing|if local is the main thing|totally get wanting someone local)\b/i.test(s)
        || /\b(mine|what i do|the way i do it|my side)\b.{0,50}\b(online|remote|check-?ins?)\b.{0,80}\b(would|if|still|open|fit|work|help|useful)\b/i.test(s)
        || /\b(would|could)\b.{0,45}\b(online|remote|check-?ins?|accountability)\b.{0,60}\b(still|actually)?\s*(help|work|be useful|suit)\b/i.test(s)
        || /\b(alongside|around|with)\b.{0,40}\b(your|my|the)\s+(trainer|coach|pt|personal trainer)\b/i.test(s)
        || /\b(not trying to replace|wouldn'?t replace|doesn'?t replace|instead of replacing)\b.{0,50}\b(trainer|coach|pt|personal trainer)\b/i.test(s);
}

function isDirectPracticalHelpRequest(text) {
    const s = String(text || '');
    if (/\bthanks?\s+for\s+(?:the\s+)?tips?\b/i.test(s) && !/\?/.test(s)) return false;
    return /\b(any|quick|general|specific|got|have|give me|need|looking for|some)\s+(tips?|advice|suggestions?|recommendations?|pointers?|tricks?|cues?|drills?)\b/i.test(s)
        || /\b(tips?|advice|suggestions?|recommendations?|pointers?|tricks?|cues?|drills?)\s+(for|on|with)\b/i.test(s)
        || /\b(?:i'?d|i would|would)\s+love\s+to\s+hear\b.{0,90}\b(?:go-?tos?|easy|quick|minimal(?:\s+effort)?|meals?|recipes?|ideas?|options?|favou?rites?)\b/i.test(s)
        || /\b(?:what(?:\s+are|'?s)|got|have|share|send|tell me|give me)\b.{0,90}\b(?:go-?tos?|favou?rites?|easy|quick|minimal(?:\s+effort)?|meal ideas?|meals?|recipes?|options?)\b/i.test(s)
        || /\b(?:a couple|some|one or two)\s+of\s+(?:your\s+)?(?:favou?rites?|go-?tos?)\b/i.test(s)
        || /\bwhat\s+(?:would|do)\s+you\s+recommend\b/i.test(s);
}

function hasDirectPracticalAnswer(text) {
    const withoutChallengeOffers = String(text || '')
        .replace(/[^.!?\n]*(?:30\s*day|30-day|free challenge|challenge|1\s*[:v]\s*1|one.?on.?one|coaching|send.*link|link|coaching\.html)[^.!?\n]*/gi, ' ');
    const adviceVerb = /\b(try|aim|start|keep|use|swap|reduce|scale|back off|leave|stop|stopping|rest|pause|next time|one thing|easiest|simple rule|rule of thumb|good sign|quick tip|tip would be|i'd|i would|i usually|i'll|think about|focus on|cue|key is|sweet spot)\b/i.test(withoutChallengeOffers);
    const practicalFoodSpecific = /\b(one-?pot|pasta|ramen|beans?|cannellini|lentils?|tofu|edamame|frozen (?:veg|veggies|vegetables)|wraps?|burrito|curry|stir.?fry|smoothie|overnight oats|microwave|pantry|meal idea|recipe)\b/i.test(withoutChallengeOffers)
        && /\b(go-?tos?|option|meal|recipe|add|throw|keep|use|do|make|works?|barely any work|minimal effort|quick|easy ones?|ones are)\b/i.test(withoutChallengeOffers);
    return adviceVerb || practicalFoodSpecific;
}

function isAppOrWorkoutPlanSupportRequest(text) {
    return /\b(app|glitch|glitched|bug|display|log my workout|logging|workout plan|workout plans|full.?body plan|full.?body plans|m\/w\/f|mon\/wed\/fri|movement on off days|same exercises|rep schemes?|new challenges|fresh plans?|fresh workouts?|routine|plans? delivered|another app|tech hassle|face recognition|face id|password reset|reset link|login|log in|locked out|reconnect(?:ed|ing)?|connect(?:ed|ing)? back|app helper|balance helper|balance app helper|account access|app access|old email|spam|manual(?:ly)? reset)\b/i.test(String(text || ''));
}

function hasChallengeInviteReadinessSignal(text) {
    const s = String(text || '').toLowerCase();
    if (isAppOrWorkoutPlanSupportRequest(s) && !/\b(30\s*day|30-day|free challenge|1\s*[:v]\s*1|one.?on.?one|coaching|sign ?up|send.*link|join)\b/i.test(s)) {
        return false;
    }
    if (isInPersonOrExistingCoachPreference(s) && !hasOnlineCoachingAcceptanceSignal(s)) {
        return false;
    }
    if (isDirectPracticalHelpRequest(s) && !hasChallengeLogisticsQuestion(s) && !/\b(30\s*day|30-day|free challenge|1\s*[:v]\s*1|one.?on.?one|coaching|sign ?up|send.*link|join|challenge|program)\b/i.test(s)) {
        return false;
    }
    if (/\b(i'?m in|im in|save me( a)? spot|sign me up|send.*link|how do i start|how to start|start monday|let'?s do it|lets do it|work with you|work with me|coaching details|coaching link)\b/i.test(s)) {
        return true;
    }
    if (hasHumanHelpIntent(s)) return true;
    if (hasSolutionSeekingOverwhelm(s)) return true;
    if (hasChallengeLogisticsQuestion(s)) return true;
    if (/\b(wanna join|want to join|can i join|how do i join|join the|join your|join this|interested in|keen for|keen to)\b/i.test(s) && hasChallengeContext(s)) {
        return true;
    }
    return false;
}

function hasStartIntent(text) {
    return hasChallengeInviteReadinessSignal(text);
}

function hasChallengeDeferralSignal(text) {
    const s = String(text || '').toLowerCase();
    return /\b(not\s+ready|not\s+yet|maybe\s+later|later\s+on|too\s+busy|just\s+looking|just\s+sussing|still\s+sussing|i'?ll\s+think|let\s+me\s+think|hold\s+off|wait\s+(?:a\s+)?bit|no\s+thanks|don'?t\s+want)\b/i.test(s);
}

function normalizeMeaningfulLeadText(text) {
    return String(text || '')
        .replace(/\[(?:photo|image|video|audio|voice note|voice)[^\]]*\]/gi, ' ')
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isMeaningfulLeadReply(text) {
    const s = normalizeMeaningfulLeadText(text);
    if (!s) return false;
    const lower = s.toLowerCase();
    if (/^(?:ha+|haha+|lol|lmao|yeah|yea|yep|nah|no|yes|ok|okay|cool|nice|true|same|thanks?|thank you|sounds good|keen|interested|maybe|sure|alright|sweet|easy|love that|all good)[.!?\s]*$/i.test(lower)) {
        return false;
    }
    const words = lower.match(/\b[a-z0-9][a-z0-9']*\b/g) || [];
    const trivialWords = new Set(['ha', 'haha', 'lol', 'lmao', 'yeah', 'yea', 'yep', 'nah', 'no', 'yes', 'ok', 'okay', 'cool', 'nice', 'true', 'same', 'thanks', 'thank', 'you', 'sounds', 'good', 'keen', 'interested', 'maybe', 'sure', 'alright', 'sweet', 'easy', 'love', 'that', 'all']);
    if (words.length <= 5 && words.every(word => trivialWords.has(word))) {
        return false;
    }
    const hasContextSignal = /\b(help|start|join|link|included|challenge|coach|coaching|program|app|training|gym|workout|food|meal|diet|vegan|plant.?based|weight|body|energy|confidence|consistent|consistency|struggl\w*|stuck|hard|busy|work|shift|kids?|family|stress|tired|motivation|goal|fall(?:ing)? off|fell off|no idea|lost)\b/i.test(lower);
    return hasContextSignal
        || (/\?/.test(s) && words.length >= 3)
        || words.length >= 4
        || s.length >= 28;
}

function countMeaningfulLeadReplies(history = [], currentMessage = '') {
    const replies = [];
    if (Array.isArray(history)) {
        for (const message of history) {
            if (message?.direction === 'in') replies.push(message.text);
        }
    }
    if (currentMessage) replies.push(currentMessage);

    const seen = new Set();
    let count = 0;
    for (const reply of replies) {
        const normalized = normalizeMeaningfulLeadText(reply).toLowerCase();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        if (isMeaningfulLeadReply(normalized)) count += 1;
    }
    return count;
}

function earnedChallengeFactCount(facts = {}) {
    return ['current_state', 'motivation', 'history_blockers', 'commitment']
        .filter(key => hasUsefulFact(facts?.[key]))
        .length;
}

function hasEarnedChallengeInviteMoment({ qualifier, currentMessage, leadReplyCount } = {}) {
    if (!qualifier || typeof qualifier !== 'object') return false;
    if (TERMINAL_STAGES.has(qualifier.stage)) return false;
    if (hasChallengeDeferralSignal(currentMessage)) return false;

    const facts = qualifier.facts || {};
    const coreFacts = earnedChallengeFactCount(facts);
    const hasRelationship = hasAnyRelationshipAnchor(facts);
    const stageIndex = Number(qualifier.stage_index || 0);
    const lateEnoughStage = ['history_blockers', 'commitment'].includes(qualifier.stage) || stageIndex >= 3;
    const specificNeedNow = hasSpecificHelpOrBlockerSignal(currentMessage);
    const warmthScore = Number(qualifier.warmth_score || 0);
    const warmthLabel = String(qualifier.warmth_label || '').toLowerCase();
    const warmEnough = warmthScore >= 58 || warmthLabel === 'warm' || warmthLabel === 'hot';
    const meaningfulReplies = Math.max(0, Math.round(Number(
        leadReplyCount ?? qualifier.meaningful_lead_reply_count ?? 0
    ) || 0));

    return hasRelationship
        && warmEnough
        && (lateEnoughStage || (stageIndex >= 2 && specificNeedNow))
        && coreFacts >= 2
        && meaningfulReplies >= 3;
}

function isOneOnOneCoachingLinkContext(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    if (/future-balance\.netlify\.app\/coaching\.html|plantbased-balance\.org\/coaching\.html/i.test(s)) return true;
    return /\b(1\s*[:v]\s*1|1\s*on\s*1|one\s*on\s*one|one-to-one|one to one|personal coaching|online coaching|coach me|coaching spot|coaching spots|coaching link|coaching details|coaching page)\b/i.test(s)
        && /\b(coach|coaching|link|details|spot|spots|join|start|work with you)\b/i.test(s);
}

function isChallengeInviteText(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    if (isAccountSupportLinkContext(s)) return false;
    const mentionsOffer = /\b(30\s*day|30-day|challenge|app|program|signup|sign up|link|founders?\s+pass|starter\s+coaching|online\s+coaching|personal\s+coaching)\b/i.test(s)
        || isOneOnOneCoachingLinkContext(s);
    const inviteLanguage = /\b(join|jump in|jump on\s+(?:the\s+)?(?:challenge|program|call|coaching)|get you in|get you into|get started|start monday|send.*link|link|save.*spot|i can set|get you set|get you started|want me to send|keen.*(?:challenge|coaching)|work with me|work with you|coaching details|coaching link|try\s+(?:the|this|my|our|a\s+free|the\s+free)?\s*(?:starter\s+coaching|30\s*day|30-day|challenge|program|coaching)|hear more.*(?:challenge|coaching)|starter\s+coaching.{0,120}(?:keen|hear more|details|link|send|want me)|free\s+(?:30\s*day|30-day|challenge|program|coaching)|1\s*[:v]\s*1|one.?on.?one)\b/i.test(s);
    return mentionsOffer && inviteLanguage;
}

function isChallengeOfferWarningText(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    if (/plantbased-balance\.org\/(vegan-challenge|transform-challenge)\.html|future-balance\.netlify\.app\/coaching\.html|plantbased-balance\.org\/coaching\.html/i.test(s)) return true;
    const mentionsOffer = /\b(30\s*day|30-day|challenge|free challenge|plant.?based challenge|transformation challenge|founders?\s+pass|1\s*[:v]\s*1|one.?on.?one|coaching|personal coaching|online coaching)\b/i.test(s);
    const offerLanguage = /\b(join|jump in|jump on|get you in|get you into|get started|start monday|send.*link|link|save.*spot|sign ?up|i can set|get you set|get you started|want me to send|easiest starting point|keen.*(?:challenge|coaching)|work with me|work with you|coaching details|coaching link|try\s+(?:the|this|my|our|a\s+free|the\s+free)?\s*(?:starter\s+coaching|30\s*day|30-day|challenge|program|coaching)|hear more.*(?:challenge|coaching)|starter\s+coaching.{0,120}(?:keen|hear more|details|link|send|want me)|free\s+(?:30\s*day|30-day|challenge|program|coaching))\b/i.test(s);
    return mentionsOffer && offerLanguage;
}

function isPrematureChallengeInvite({ draftText, currentMessage, qualifier, leadStage, linkedUserId, leadReplyCount } = {}) {
    if (!isChallengeInviteText(draftText)) return false;
    if (linkedUserId || ['in_app', 'paying', 'invited'].includes(leadStage)) return false;
    if (['pitched', 'won'].includes(qualifier?.stage)) return false;
    if (isInPersonOrExistingCoachPreference(currentMessage)) {
        return isChallengeOfferWarningText(draftText) || !handlesInPersonOrExistingCoachPreference(draftText);
    }
    if (isDirectPracticalHelpRequest(currentMessage) && !hasDirectPracticalAnswer(draftText)) return true;
    return !hasChallengeInviteReadinessSignal(currentMessage)
        && !hasEarnedChallengeInviteMoment({ qualifier, currentMessage, leadReplyCount });
}

function isUnrequestedOfferInjection({ originalDraft, repairedDraft, currentMessage, qualifier } = {}) {
    if (!isChallengeInviteText(repairedDraft) || isChallengeInviteText(originalDraft)) return false;
    if (hasDirectBuyerIntent(currentMessage) || hasChallengeInviteReadinessSignal(currentMessage)) return false;
    if (['pitched', 'won'].includes(String(qualifier?.stage || '').toLowerCase())) return false;
    return true;
}

function isDeepFunnelQuestion(question) {
    const q = String(question || '').toLowerCase();
    if (!q) return false;
    return /\b(goal|goals|dream scenario|kicked this off|what would change|tried|before|gets? in the way|blocker|challenge|30 days|start|lock it in|program|app|lose weight|muscle|energy)\b/i.test(q)
        || /\b(?:first thing|first step|next step).*\b(?:sort|sorted|make|makes|feel|feels|real)\b/i.test(q)
        || /\b(?:feel|feels|make|makes).*real\b/i.test(q);
}

function isUnsafeStockDiscoveryQuestion(text) {
    const q = String(text || '').toLowerCase();
    if (!q) return false;
    return /\bwhat does a normal day(?: of eating)? look like\b/i.test(q)
        || /\bwhat do your days usually look like\b/i.test(q)
        || /\bwhere does (?:food|training|food or training).*fit\b/i.test(q)
        || /\bwhat'?s for lunch\b/i.test(q)
        || /\bwhat meals are easiest\b/i.test(q)
        || /\bare you much of a cook\b/i.test(q)
        || /\byou much of a cook\b/i.test(q)
        || /\btakeaway person\b/i.test(q)
        || /\bare you into fitness\b/i.test(q)
        || /\bfitness much too\b/i.test(q)
        || /\byou training at the moment\b/i.test(q)
        || /\bwhat do you normally do when you get a bit of time\b/i.test(q)
        || /\bwhat are your goals\b/i.test(q)
        || /\bwhat'?s your goal\b/i.test(q)
        || /\bwhat does your current exercise routine consist of\b/i.test(q)
        || /\bwhat does that look like for you\b/i.test(q)
        || /\bwhat would that look like for you\b/i.test(q)
        || /\bwhat kind of difference would that make\b/i.test(q)
        || /\bwhat would that change for you\b/i.test(q)
        || /\bwhat'?s the first thing (?:you )?(?:need to )?(?:sort|sort out|get sorted)\b/i.test(q)
        || /\bwhat'?s the first step\b/i.test(q)
        || /\bwhat would make (?:it|that|this).*(?:feel )?real\b/i.test(q)
        || /\bbefore .* feels real\b/i.test(q)
        || /\bwhat usually makes (?:it|that) (?:feel )?(?:so )?(?:hard|difficult|hectic|a struggle)\b/i.test(q)
        || /\banything in particular (?:making|that makes) (?:it|that) (?:feel )?(?:so )?(?:hard|difficult|hectic|a struggle)\b/i.test(q)
        || /\bhow are you finding it(?: so far)?\b/i.test(q)
        || /\bdoes that actually help\b/i.test(q)
        || /\bwhat'?s been (?:the )?(?:biggest|main) (?:struggle|challenge|barrier|thing holding you back)\b/i.test(q)
        || /\b(?:food|training|consistency|motivation|diet|exercise)\b(?:\s*,\s*|\s+or\s+)[^?\n]{0,100}\b(?:food|training|consistency|motivation|diet|exercise)\b/i.test(q);
}

function isOfferClarificationTurn(currentMessage, qualifier = {}) {
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (!message) return false;
    const psychology = normalizeConversationPsychology(qualifier.conversation_psychology);
    const clarificationQuestion = /\b(?:what(?:'s| is)|how (?:does|do)|what do (?:i|you) get|what(?:'s| is) included|tell me (?:about|how))\b[^?\n]{0,120}\b(?:founders? pass|balance|app|structure|program|coaching|support|community|work)\b/i.test(message)
        || /\b(?:founders? pass|balance|app|structure|program|coaching|support|community)\b[^?\n]{0,100}\b(?:work|include|included|mean|structure)\b/i.test(message);
    return clarificationQuestion
        && (psychology.allowed_move === 'clarify' || normalizeCommercialStage(qualifier.commercial_stage) === 'buyer_intent');
}

function chooseRapportQuestion(currentMessage, facts = {}) {
    const msg = String(currentMessage || '').toLowerCase();
    const missing = missingRelationshipItems(facts);
    const wants = (key) => missing.some(item => item.key === key);
    const hasProblemLanguage = /\b(hard|hardest|struggl\w*|stuck|slacking|off track|fall(?:ing)? off|fell off|tired|exhausted|fed up|lost|need help|help|can'?t|cannot|overwhelm\w*|motivation|consistent|consistency|binge|craving|injur\w*|sore|pain|hate)\b/i.test(msg);
    const hasFamily = /\b(kid|kids|child|children|mum|mom|dad|family|partner|husband|wife|sister|brother|parents?)\b/i.test(msg);
    const hasPlantBased = /\b(vegan|plant.?based|vegetarian)\b/i.test(msg);
    if (hasFamily && hasPlantBased) {
        return 'sounds like their reaction to you going vegan probably shaped a fair bit';
    }
    if (/\b(friend|mate|bestie|someone)\b/i.test(msg) && /\b(convinced|got me|give it a go|try it|went vegan|go vegan)\b/i.test(msg) && hasPlantBased) {
        return 'sounds like giving it a go changed something pretty big for you';
    }
    if (/\b(stress|stressed|stressful|annoy\w*|frustrat\w*|fed up|hate|overwhelm\w*|pressure|burnt|burned|chaos|hardest|struggl\w*|ticks? me off|tired|exhausted)\b/i.test(msg)) {
        return wants('stressors_frustrations')
            ? "sounds like there is one main thing making it hardest right now"
            : 'sounds like that probably makes food or training harder too';
    }
    if (/\b(kid|kids|child|children|mum|mom|dad|family|partner|husband|wife)\b/i.test(msg)) {
        return hasProblemLanguage
            ? 'sounds like looking after yourself gets pushed down the list too'
            : null;
    }
    if (/\b(work|job|shift|busy|school|study|uni|business)\b/i.test(msg)) {
        return hasProblemLanguage
            ? 'sounds like time is what makes food or training hard to lock in'
            : null;
    }
    if (/\b(dog|dogs|puppy|cat|cats|pet|pets)\b/i.test(msg)) {
        return null;
    }
    if (/\b(cook|cooking|food|lunch|dinner|takeaway|vegan|plant|vegetarian|meal)\b/i.test(msg)) {
        return hasProblemLanguage
            ? 'food sounds like the bit you want the most help with'
            : null;
    }
    if (/\b(gym|train|training|workout|run|walking|sport)\b/i.test(msg)) {
        return hasProblemLanguage
            ? 'training sounds like the consistency piece that keeps slipping'
            : null;
    }
    if (/\b(love|loved|favourite|favorite|enjoy|obsessed|into|hobby|hobbies|music|gaming|games|beach|hiking|coffee|ritual)\b/i.test(msg)) {
        return null;
    }
    return null;
}

function applyStockQuestionGuard({ qualifier, currentMessage }) {
    if (!qualifier?.is_question_moment) return qualifier;
    if (!qualifier.next_question) {
        return {
            ...qualifier,
            is_question_moment: false,
            next_question: '',
            why_now: qualifier.why_now || 'No grounded elicitation move is needed here. Keep the reply conversational.',
        };
    }
    if (!isUnsafeStockDiscoveryQuestion(qualifier.next_question)) return qualifier;

    const facts = qualifier.facts || {};
    const replacement = chooseRapportQuestion(currentMessage, facts);
    const next = { ...qualifier };

    if (replacement && !isUnsafeStockDiscoveryQuestion(replacement)) {
        next.next_question = replacement;
        next.why_now = 'The previous next move was too generic for the thread. Stay with the newest detail and use a specific elicitation line instead.';
        return next;
    }

    next.is_question_moment = false;
    next.why_now = 'The available next move was too generic, so hold off and keep the reply conversational instead of forcing discovery.';
    return next;
}

function isProtectedLeadProgressionQuestion(question) {
    const text = String(question || '').replace(/\s+/g, ' ').trim();
    if (!text || isUnsafeStockDiscoveryQuestion(text)) return false;
    const nonFoodProgression = /\b(active|activity|move|movement|train|training|workout|gym|weight|fat|muscle|strength|fitness|energy|routine|consistent|consistency|accountability|exercise|pilates|running|cardio|health|body|goal|progress)\b/i.test(text);
    if (nonFoodProgression) return true;
    return /\b(food|meal|nutrition)\b/i.test(text)
        && /\b(plan|planning|prep|structure|routine|consistent|consistency|health|goal|progress|struggl|hard|help|direction|accountability)\b/i.test(text);
}

function hasCurrentLeadQualificationSignal(currentMessage) {
    const text = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    return /\b(?:active|activity|train|training|workout|gym|weight|fat|muscle|strength|fitness|energy|routine|consistent|consistency|accountability|exercise|running|cardio|health|body|food|meal|nutrition|diet|prep|structure|goal|progress|struggl\w*|stuck|fall(?:ing)? off|fell off|hard to|need help|want help|coaching|coach)\b/i.test(text);
}

function hasSalesSuspicionSignal(currentMessage) {
    const text = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    return /\b(?:are you|r u|you(?:'re| are)|is this|this is)\s+(?:just\s+)?(?:trying to|gonna|going to|about to)?\s*(?:sell|pitch|market)\b|\btrying to sell me\b|\bsell me (?:a|the|some)\b|\b(?:sales|selling|marketing) (?:pitch|funnel|script)\b|\bis this (?:a|some) (?:pitch|sales thing)\b|\bdo you actually care or\b/i.test(text);
}

function isUnsafeLeadProgressionTurn(currentMessage) {
    const text = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    if (!text) return true;
    if (/^(?:thank(?:s| you)|cheers|haha|lol|yep|yeah|nah|ok(?:ay)?|❤️|❤|🙏|😂|🥰|😊)[.!\s]*$/i.test(text)) return true;
    return /\b(?:vet|put (?:him|her|them) down|passed away|died|dying|funeral|grief|grieving|terminal|cancer|hospital|emergency|suicid|self[- ]?harm)\b/i.test(text);
}

function hasLeadQualificationStopSignal({ currentMessage, qualifier } = {}) {
    const message = String(currentMessage || '').replace(/\s+/g, ' ').trim();
    const facts = qualifier?.facts || {};
    const factText = [facts.current_state, facts.history_blockers]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const answeredSignal = /\b(?:hope (?:this|that) answers(?: your question)?|(?:this|that) answers(?: your question)?|does (?:this|that) answer(?: your question)?|i (?:already|just) answered|as i (?:said|mentioned)|like i (?:said|mentioned))\b/i.test(message);
    const noBlockerPattern = /\b(?:all|every(?:thing| exercise)|the exercises?) (?:i (?:do|am doing) )?(?:are|is|feel|feels) (?:all )?(?:good|fine|okay|ok)|\b(?:my )?(?:back|body|training|routine|food|diet) (?:has not|hasn't|isn't|is not|doesn't|does not) (?:flared?|flaring|hurt(?:ing)?|bother(?:ing)?|stopping|an issue|a problem)|\b(?:no|not) (?:real |current |actual |major )?(?:issue|problem|blocker|struggle)|\bnothing (?:really )?(?:stops|disrupts|gets in the way)|\beverything(?:'s| is) (?:good|fine|okay|ok)\b/i;
    const freshProblemSignal = /\b(?:struggl\w*|stuck|fall(?:ing)? off|fell off|hard to|difficult|keeps? getting in the way|need help|want help|could use help|not working|can'?t stick|cannot stick|plateau|flaring|hurting|bothering)\b/i.test(message);
    const noCurrentBlocker = noBlockerPattern.test(message)
        || (!freshProblemSignal && noBlockerPattern.test(factText));

    return answeredSignal || noCurrentBlocker;
}

function protectEarnedLeadProgression({ qualifier, currentMessage, leadReplyCount } = {}) {
    if (!qualifier || TERMINAL_STAGES.has(qualifier.stage)) return qualifier;
    const replies = Math.max(0, Number(leadReplyCount || qualifier.meaningful_lead_reply_count || 0));
    const behavior = normalizeBehaviorProfile(qualifier.behavior_profile);
    const salesSuspicion = hasSalesSuspicionSignal(currentMessage);
    const salesSensitivityHold = behavior.protection_pattern === 'hates_being_sold_to'
        && behavior.sales_readiness !== 'link_ready'
        && !hasDirectBuyerIntent(currentMessage)
        && !hasHumanHelpIntent(currentMessage);
    if (salesSuspicion || salesSensitivityHold) {
        return {
            ...qualifier,
            is_question_moment: false,
            next_question: '',
            why_now: salesSuspicion
                ? 'The lead questioned whether this is a sales pitch. Answer plainly, preserve autonomy, and leave space.'
                : 'The lead is still protecting against being sold to. Treat fitness sharing as rapport, not permission to resume qualification.',
        };
    }
    if (isUnsafeLeadProgressionTurn(currentMessage)) {
        return qualifier.is_question_moment
            ? { ...qualifier, is_question_moment: false, next_question: '' }
            : qualifier;
    }
    if (/\b(?:this|it) (?:feels|is starting to feel) like (?:an? )?interview\b|\bthis interview\b|\b(?:so many|a lot of|too many) questions\b|\b(?:interrogation|questionnaire)\b/i.test(String(currentMessage || ''))) {
        return {
            ...qualifier,
            is_question_moment: false,
            next_question: '',
            why_now: 'The lead signalled question fatigue. Reflect or answer in a statement-led turn and give them space.',
        };
    }
    if (hasLeadQualificationStopSignal({ currentMessage, qualifier })) {
        return {
            ...qualifier,
            is_question_moment: false,
            next_question: '',
            why_now: 'The lead already answered the qualification point or stated there is no current blocker. Acknowledge it in a statement-led turn and stop probing.',
        };
    }
    if (isOfferClarificationTurn(currentMessage, qualifier)) {
        return {
            ...qualifier,
            is_question_moment: false,
            next_question: '',
            why_now: 'The lead asked for offer clarity. Answer it plainly, then leave space instead of stacking another qualifier question.',
        };
    }
    if (replies < 2) return qualifier;
    if (isProtectedLeadProgressionQuestion(qualifier.next_question)) {
        if (!hasCurrentLeadQualificationSignal(currentMessage)) {
            return {
                ...qualifier,
                is_question_moment: false,
                next_question: '',
                why_now: 'No current lead-authored fitness, food-structure, consistency, energy, or help signal. Vegan identity and animal ethics are rapport, not permission to switch into qualification.',
            };
        }
        return {
            ...qualifier,
            is_question_moment: true,
            why_now: 'Reciprocal rapport is established. Ask one specific next-missing-fact question that opens relevant fitness, food, consistency, or accountability context.',
        };
    }
    if (replies < 3 || !hasAnyRelationshipAnchor(qualifier.facts || {})) return qualifier;

    const checklist = normalizeRelationshipChecklist(qualifier.facts || {});
    if (!hasUsefulFact(checklist.training_background)) {
        return {
            ...qualifier,
            next_question: '',
            is_question_moment: false,
            why_now: 'Reciprocal rapport is established but no specific training hook is known. Do not inject a stock fitness question; answer the latest point and let the draft use a thread-specific move.',
        };
    }

    return qualifier;
}

function applyRapportGate({ qualifier, currentMessage, leadReplyCount } = {}) {
    if (!qualifier || TERMINAL_STAGES.has(qualifier.stage)) {
        return qualifier;
    }
    if (hasStartIntent(currentMessage)) {
        return applyStockQuestionGuard({ qualifier, currentMessage });
    }

    const facts = qualifier.facts || {};
    const next = protectEarnedLeadProgression({
        qualifier: { ...qualifier },
        currentMessage,
        leadReplyCount,
    });

    if (
        next.is_question_moment
        && isChallengeInviteText(next.next_question)
        && !hasEarnedChallengeInviteMoment({ qualifier: next, currentMessage, leadReplyCount })
    ) {
        next.next_question = '';
        next.is_question_moment = false;
        next.why_now = 'Hold the coaching bridge until there are at least 3 meaningful lead replies plus real relationship and goal/blocker context, unless they directly ask for help or the link.';
    }

    if (hasAnyRelationshipAnchor(facts)) return applyStockQuestionGuard({ qualifier: next, currentMessage });

    next.stage = 'current_state';
    next.stage_label = 'Rapport + current state';
    next.stage_index = 1;

    if (next.is_question_moment && (!next.next_question || isDeepFunnelQuestion(next.next_question))) {
        const bridgeQuestion = chooseRapportQuestion(currentMessage, facts);
        if (bridgeQuestion) {
            next.next_question = bridgeQuestion;
            next.why_now = 'There is a real health or consistency bridge in their words. Use one grounded move that helps them name what they need help with.';
        } else {
            next.next_question = '';
            next.is_question_moment = false;
            next.why_now = 'No clear health, fitness, or help signal yet. Keep the reply human and do not force a qualifier move.';
        }
        next.quote_evidence = next.quote_evidence || null;
    }

    return applyStockQuestionGuard({ qualifier: next, currentMessage });
}

// ============================================================
// Eligibility
// ============================================================

/**
 * The qualifier only runs for leads in the new/qualifying/invited window
 * AND who haven't been linked to an app account yet. Once they're in the
 * app the funnel has effectively cleared — no point asking discovery
 * questions to a paying client.
 *
 * Mirrors effectiveLeadStageForPrompt() in ig-instant-draft.js so the two
 * gates stay consistent.
 */
function isQualifierEligible({ leadStage, linkedUserId }) {
    if (linkedUserId) return false;
    if (!leadStage) return true; // default to 'new'
    return ['new', 'qualifying', 'invited'].includes(leadStage);
}

// ============================================================
// State load / fresh shape
// ============================================================

const BRIDGE_PLAN_STAGES = new Set([
    'social_topic',
    'life_rhythm',
    'health_adjacent',
    'fitness_context',
    'goal_blocker',
    'offer_context',
]);

const BRIDGE_PLAN_MOVES = new Set([
    'hold',
    'deepen_anchor',
    'advance_one_step',
    'direct_bridge',
]);

const PSYCHOLOGY_NEEDS = new Set([
    'heard',
    'clarity',
    'confidence',
    'autonomy',
    'practical_direction',
    'celebration',
    'space',
    'unknown',
]);

const CHANGE_TALK_STRENGTHS = new Set(['none', 'weak', 'moderate', 'strong']);
const CONFIDENCE_SIGNALS = new Set(['unknown', 'low', 'mixed', 'high']);
const FRICTION_TYPES = new Set([
    'time',
    'energy',
    'knowledge',
    'confidence',
    'environment',
    'accountability',
    'injury_limit',
    'overwhelm',
    'none',
    'unknown',
]);
const PSYCHOLOGY_MOVES = new Set([
    'reflect',
    'affirm',
    'reframe',
    'evoke',
    'clarify',
    'offer_tiny_idea',
    'bridge',
    'invite',
    'pause',
]);
const OBJECTION_TYPES = new Set([
    'none',
    'price',
    'time',
    'confidence',
    'past_failure',
    'partner_decision',
    'needs_thinking_time',
    'online_or_in_person_fit',
    'existing_support',
    'offer_fit',
    'unknown',
]);
const DECISION_STATES = new Set([
    'not_deciding',
    'exploring',
    'weighing',
    'autonomy_pause',
    'clear_no',
    'unknown',
]);

function normalizeBridgePlan(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const currentStage = BRIDGE_PLAN_STAGES.has(source.current_stage) ? source.current_stage : 'social_topic';
    const distanceByStage = {
        social_topic: 3,
        life_rhythm: 2,
        health_adjacent: 1,
        fitness_context: 0,
        goal_blocker: 0,
        offer_context: 0,
    };
    return {
        current_anchor: cleanProfileText(source.current_anchor, 120),
        current_stage: currentStage,
        destination: BRIDGE_PLAN_STAGES.has(source.destination) ? source.destination : 'fitness_context',
        next_adjacent_step: cleanProfileText(source.next_adjacent_step, 160),
        move_this_turn: BRIDGE_PLAN_MOVES.has(source.move_this_turn) ? source.move_this_turn : 'hold',
        distance_to_fitness: distanceByStage[currentStage],
        evidence: cleanProfileText(source.evidence, 160),
        direct_fitness_question_allowed: distanceByStage[currentStage] === 0
            && !!source.direct_fitness_question_allowed,
    };
}

function normalizeConversationPsychology(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const objectionType = OBJECTION_TYPES.has(source.objection_type) ? source.objection_type : 'unknown';
    const decisionState = DECISION_STATES.has(source.decision_state) ? source.decision_state : 'unknown';
    let allowedMove = PSYCHOLOGY_MOVES.has(source.allowed_move) ? source.allowed_move : 'reflect';

    // A no or a request for thinking space is a stopping signal, not a reason
    // to intensify the close. Likewise, an unresolved objection cannot safely
    // authorize another bridge or invite by itself.
    if (decisionState === 'clear_no' || decisionState === 'autonomy_pause') {
        allowedMove = 'pause';
    } else if (!['none', 'unknown'].includes(objectionType) && ['bridge', 'invite'].includes(allowedMove)) {
        allowedMove = ['confidence', 'past_failure'].includes(objectionType) ? 'affirm' : 'clarify';
    }

    return {
        need_right_now: PSYCHOLOGY_NEEDS.has(source.need_right_now) ? source.need_right_now : 'unknown',
        change_talk_strength: CHANGE_TALK_STRENGTHS.has(source.change_talk_strength)
            ? source.change_talk_strength
            : 'none',
        confidence_signal: CONFIDENCE_SIGNALS.has(source.confidence_signal)
            ? source.confidence_signal
            : 'unknown',
        friction_type: FRICTION_TYPES.has(source.friction_type) ? source.friction_type : 'unknown',
        allowed_move: allowedMove,
        objection_type: objectionType,
        decision_state: decisionState,
        objection_evidence: cleanProfileText(source.objection_evidence, 180),
        change_talk_evidence: cleanProfileText(source.change_talk_evidence, 180),
        confidence_evidence: cleanProfileText(source.confidence_evidence, 180),
        desired_direction: cleanProfileText(source.desired_direction, 140),
        current_pattern: cleanProfileText(source.current_pattern, 140),
    };
}

function freshQualifier({ hookContext = null } = {}) {
    return {
        stage: 'current_state',
        stage_label: 'Rapport + current state',
        stage_index: 1,
        facts: {
            hook_context: hookContext,
            relationship_context: null,
            relationship_checklist: normalizeRelationshipChecklist({}),
            current_state: null,
            motivation: null,
            history_blockers: null,
            commitment: null,
        },
        warmth_score: 30,
        warmth_label: 'lukewarm',
        commercial_stage: 'engaged',
        commercial_reason: 'Conversation started; no qualified sales evidence yet.',
        bridge_plan: normalizeBridgePlan(),
        conversation_psychology: normalizeConversationPsychology(),
        next_question: '',
        why_now: "first captured reply in this thread, likely after Shannon's unseen story/post opener. Keep rapport first and wait for a real health, fitness, or help signal before pushing a move.",
        quote_evidence: null,
        is_question_moment: false,
        challenge_route: 'undecided',
        behavior_profile: normalizeBehaviorProfile(),
        meaningful_lead_reply_count: 0,
        evaluated_at: new Date().toISOString(),
    };
}

function normalizeQualifier(raw) {
    if (!raw || typeof raw !== 'object') return freshQualifier();
    const stage = ALL_STAGE_KEYS.has(raw.stage) ? raw.stage : 'current_state';
    const stageMeta = stageMetaFor(stage);
    const stageIndex = stageMeta ? stageMeta.index : (TERMINAL_STAGES.has(stage) ? 5 : 1);
    const stageLabel = stageMeta ? stageMeta.label : stage.replace(/_/g, ' ');
    const facts = {
        hook_context: cleanFactValue(raw.facts?.hook_context),
        relationship_context: cleanFactValue(raw.facts?.relationship_context),
        relationship_checklist: normalizeRelationshipChecklist(raw.facts || {}),
        current_state: cleanFactValue(raw.facts?.current_state),
        motivation: cleanFactValue(raw.facts?.motivation),
        history_blockers: cleanFactValue(raw.facts?.history_blockers),
        commitment: cleanFactValue(raw.facts?.commitment),
    };
    const warmthScore = Math.max(0, Math.min(100, Math.round(Number(raw.warmth_score) || 0)));
    const normalized = {
        stage,
        stage_label: stageLabel,
        stage_index: stageIndex,
        facts,
        warmth_score: warmthScore,
        warmth_label: raw.warmth_label || warmthLabelFor(warmthScore),
        commercial_stage: normalizeCommercialStage(raw.commercial_stage),
        commercial_reason: cleanProfileText(raw.commercial_reason, 180),
        bridge_plan: normalizeBridgePlan(raw.bridge_plan),
        conversation_psychology: normalizeConversationPsychology(raw.conversation_psychology),
        next_question: typeof raw.next_question === 'string' ? raw.next_question.trim() : '',
        why_now: typeof raw.why_now === 'string' ? raw.why_now.trim() : '',
        quote_evidence: typeof raw.quote_evidence === 'string' ? raw.quote_evidence.trim() : null,
        is_question_moment: !!raw.is_question_moment,
        challenge_route: ['vegan', 'generic', 'undecided'].includes(raw.challenge_route) ? raw.challenge_route : 'undecided',
        behavior_profile: normalizeBehaviorProfile(raw.behavior_profile),
        meaningful_lead_reply_count: Math.max(0, Math.round(Number(raw.meaningful_lead_reply_count) || 0)),
        evaluated_at: raw.evaluated_at || new Date().toISOString(),
    };
    normalized.commercial_stage = deriveCommercialStage({
        qualifier: normalized,
        proposedStage: raw.commercial_stage,
    });
    return normalized;
}

// ============================================================
// Hook-context inference (from outbound DMs / ad referrer)
// ============================================================

/**
 * If the qualifier's hook_context isn't set yet, try to infer it from
 * Shannon's first OUTBOUND message in the IG/FB thread (he initiates by
 * replying to their stories or cold-DMing them) OR from the ManyChat
 * custom_data referrer field (ad name when the lead came in cold).
 *
 * Returns a string snippet (Shannon's opening DM text) or null.
 * Best-effort — never blocks qualifier evaluation.
 */
function inferNativeStoryHookContext(customData = {}) {
    if (!customData || typeof customData !== 'object') return null;
    let latest = customData.last_story_outreach && typeof customData.last_story_outreach === 'object'
        ? customData.last_story_outreach
        : null;
    if (!latest) {
        const history = Array.isArray(customData.story_outreach_history)
            ? customData.story_outreach_history.filter(item => item && typeof item === 'object')
            : [];
        latest = history[history.length - 1] || null;
    }
    if (!latest) return null;

    const opener = String(latest.sent_comment || latest.draft_comment || '').replace(/\s+/g, ' ').trim();
    const description = String(latest.story_description || '').replace(/\s+/g, ' ').trim();
    const visibleText = String(latest.story_visible_text || '').replace(/\s+/g, ' ').trim();
    const pieces = [];
    if (opener) pieces.push(`native story opener: "${opener}"`);
    if (description) pieces.push(`story: ${description}`);
    if (visibleText) pieces.push(`visible text: ${visibleText}`);
    return pieces.length ? truncate(pieces.join(' | '), 220) : null;
}

function inferHookContext({ history, customData }) {
    // Look for Shannon's first outbound — that's the "hello" that started this thread.
    if (Array.isArray(history)) {
        const firstOutbound = history.find(m => m.direction === 'out' && m.text);
        if (firstOutbound) {
            return truncate(String(firstOutbound.text).replace(/\s+/g, ' ').trim(), 220);
        }
    }
    // Cold inbound (no outbound history yet) — fall back to the ad/referrer label.
    const nativeStoryHook = inferNativeStoryHookContext(customData);
    if (nativeStoryHook) return nativeStoryHook;
    if (customData && typeof customData === 'object') {
        const adName = customData.ad_name || customData.referrer || customData.last_growth_tool || customData.entry_point;
        if (adName) return `entered via ${String(adName).slice(0, 100)}`;
    }
    return null;
}

function formatQualifierCustomDataText(customData = {}) {
    if (!customData || typeof customData !== 'object') return '(none)';
    const lines = [];
    const nativeStoryHook = inferNativeStoryHookContext(customData);
    if (nativeStoryHook) lines.push(`  native_story_hook: ${nativeStoryHook}`);

    const scalarKeys = [
        'ad_name',
        'referrer',
        'last_growth_tool',
        'entry_point',
        'lead_origin',
        'acquisition_source',
        'acquisition_mode',
        'offer_path',
        'bot_account',
    ];
    for (const key of scalarKeys) {
        const value = customData[key];
        if (value == null || value === '') continue;
        lines.push(`  ${key}: ${truncate(String(value).replace(/\s+/g, ' ').trim(), 180)}`);
    }

    const salesContext = customData.sales_context && typeof customData.sales_context === 'object'
        ? customData.sales_context
        : null;
    const leadAcquisition = customData.lead_acquisition && typeof customData.lead_acquisition === 'object'
        ? customData.lead_acquisition
        : null;
    const primaryOffer = salesContext?.primary_offer || leadAcquisition?.primary_offer;
    if (primaryOffer && !lines.some(line => line.includes('offer_path:'))) {
        lines.push(`  offer_path: ${truncate(String(primaryOffer), 120)}`);
    }

    return lines.length ? lines.join('\n') : '(none)';
}

// ============================================================
// Gemini evaluation call
// ============================================================

function buildEvaluationPrompt({ leadName, channel, currentQualifier, history, currentMessage, draftText, customData, meaningfulLeadReplyCount }) {
    const channelLabel = channel === 'messenger' ? 'Facebook Messenger' : 'Instagram';
    const promptNow = new Date();
    const promptNowText = formatCoachLocalTimestamp(promptNow);
    const leadReplyCount = Math.max(0, Math.round(Number(meaningfulLeadReplyCount) || 0));
    const playbook = STAGES.map(s =>
        `  ${s.index}. ${s.label} (${s.key}) - ${s.what_to_learn}\n     strategy: ${s.strategy}`
    ).join('\n');

    const relationshipChecklist = RELATIONSHIP_CHECKLIST.map(item =>
        `  - ${item.label} (${item.key}): ${item.what_to_learn}`
    ).join('\n');

    const behaviorProfileOptions = Object.entries(BEHAVIOR_PROFILE_OPTIONS)
        .map(([key, values]) => `  - ${key}: ${values.join(' | ')}`)
        .join('\n');

    const behaviorProfile = normalizeBehaviorProfile(currentQualifier.behavior_profile);
    const behaviorProfileText = Object.entries(behaviorProfile)
        .map(([k, v]) => `  ${k}: ${v || '(unknown)'}`)
        .join('\n');

    const factsSummary = Object.entries(currentQualifier.facts)
        .map(([k, v]) => `  ${k}: ${v ? JSON.stringify(v) : '(unknown)'}`)
        .join('\n');

    const acquisitionMode = resolveIgAcquisitionMode({ customData });
    const acquisitionModeBlock = buildAcquisitionModePromptBlock(acquisitionMode);
    const historyText = (history && history.length > 0)
        ? history.map((m, i) => {
            const speaker = m.direction === 'in' ? leadName : 'Shannon';
            return formatTimedConversationLine({
                speaker,
                text: String(m.text || '').slice(0, 400),
                createdAt: m.created_at,
                previousCreatedAt: history[i - 1]?.created_at,
                now: promptNow,
            });
        }).join('\n')
        : (acquisitionMode === 'paid_meta'
            ? '(no prior tracked messages. Verified Meta ad attribution is the opening context.)'
            : "(no prior tracked messages. This is probably the first captured lead reply after Shannon's native story/post opener, so there may be no visible context.)");

    const customDataText = formatQualifierCustomDataText(customData);

    return `You are scoring a lead's progress through a 4-stage qualifier funnel for Shannon, who is currently offering the Balance Foundations Founders Pass. It is one AUD $89.99 payment for the full six weeks, does not need a phone call, and includes a fixed six-week course, six weeks of app/community access, one weekly check-in, and workout and food review/adjustments from Shannon. It does not auto-renew. Online Coaching is the ongoing individual progression option after Foundations or from day one at AUD $29.99/week for six months, AUD $49.99/week for three months, or AUD $74.99/week month-to-month. Close the Founders Pass through DMs by default. Balance no longer uses a free challenge as its acquisition or conversion path.

ACQUISITION MODE: ${acquisitionMode}
${acquisitionModeBlock}

FIRST CAPTURED REPLY CONTEXT: if the conversation history is empty and acquisition mode is organic, do NOT assume the lead initiated or that this is the true first DM. Shannon's native story/post opener may not have been captured. Score an ambiguous organic reply gently. If acquisition mode is paid_meta, treat the verified ad referral as the opening context and answer its commercial intent directly. Joking "send help", "starting from scratch", or "need a kickstart" language is a bridge signal, not an invite signal unless the paid ad context or their exact words make the offer request explicit.

YOUR JOB: read the conversation, update the qualifier state, and decide whether THIS turn should keep chatting, gently bridge toward health/fitness, or move toward the paid Plant-Based Fitness Founders Pass because they have admitted they need help or asked how to start.

COMMERCIAL STAGE IS SEPARATE FROM ENGAGEMENT. A lively conversation, many replies, questions about Shannon's coaching philosophy, or professional curiosity can still be only engaged. Classify the lead as exactly one of:
- engaged: rapport, banter, curiosity, or useful conversation without a personally acknowledged coaching need;
- problem_qualified: they have personally named a relevant fitness, food, energy, training, consistency, structure, or accountability goal plus a real blocker;
- offer_ready: they have acknowledged wanting help, structure, accountability, community, or a clear starting system, or positively accepted a soft Founders Pass bridge;
- buyer_intent: they personally ask for price, inclusions, the link, how to join/start/sign up, say they are in/ready, or request a call about working with Shannon.
Do not mark buyer_intent merely because the word coaching, start, call, details, or help appears. "Do you use mindfulness in your coaching?" is professional curiosity unless they connect it to getting help themselves. A peer discussing their own clients or business is not a buyer without personal purchase intent.

CRITICAL TONE RULE: Shannon is chatting like a mate, NOT interviewing like a coach. A question is not required. Prefer a statement they can confirm, correct, or expand. If you do ask one, it must come from the lead's exact words and help them name what feels hard, what they want to change, or where they need support. The lead should never feel like they're being funnelled or assessed.

SUBTLE BRIDGE PLANNING: do not jump from a social topic to "are you into fitness?", "do you train?", or "what are your goals?". Privately plan an adjacent route and move at most one step per lead turn. Common routes are pet/hobby/place -> how it fits their week -> energy or activity -> training context; food -> cooking/eating rhythm -> consistency -> nutrition or fitness context; work/kids -> time and energy rhythm -> movement/training consistency; vegan values -> day-to-day plant-based life -> food/training confidence. Stay on the live topic when the adjacent step would feel manufactured. The route may take several turns or several conversation episodes. Reset current_anchor and the route when the newest message starts a different topic or conversation episode; never use a saved bridge plan to drag them back to an older agenda.

BRIDGE PLAN PARAMETERS: maintain bridge_plan on every evaluation. current_anchor is the exact human topic currently alive. current_stage is social_topic, life_rhythm, health_adjacent, fitness_context, goal_blocker, or offer_context. destination is the next honest commercially relevant stage, usually fitness_context first. next_adjacent_step is private planning, not necessarily copy to send now. move_this_turn is hold, deepen_anchor, advance_one_step, or direct_bridge. distance_to_fitness is 3 for purely social, 2 for life rhythm, 1 for health-adjacent, and 0 once fitness context is explicit. direct_fitness_question_allowed is true only when the lead's own newest words already contain a clear fitness, training, movement, food-structure, energy, health, consistency, or help signal. Otherwise use an adjacent statement or stay human. This gives the system measurable direction without making the lead feel processed.

ETHICAL CONVERSATION PSYCHOLOGY: use a motivational-interviewing spirit: partnership, acceptance, compassion, and evocation. Help the lead hear and clarify their own reasons rather than installing motivation or arguing them into change. Detect only what their actual words support. Change talk includes desire ("I want"), ability ("I could"), reasons ("I'd feel better"), need ("I need"), commitment ("I will"), and taking steps. Sustain talk or hesitation is a reason to reflect, preserve autonomy, or clarify, never to push harder. Confidence is separate from desire: someone can want change strongly while doubting they can do it.

PSYCHOLOGY PARAMETERS: maintain conversation_psychology on every evaluation. need_right_now is heard, clarity, confidence, autonomy, practical_direction, celebration, space, or unknown. change_talk_strength is none, weak, moderate, or strong. confidence_signal is unknown, low, mixed, or high. friction_type is time, energy, knowledge, confidence, environment, accountability, injury_limit, overwhelm, none, or unknown. allowed_move is reflect, affirm, reframe, evoke, clarify, offer_tiny_idea, bridge, invite, or pause. objection_type is none, price, time, confidence, past_failure, partner_decision, needs_thinking_time, online_or_in_person_fit, existing_support, offer_fit, or unknown. decision_state is not_deciding, exploring, weighing, autonomy_pause, clear_no, or unknown. Store short exact evidence for change talk, confidence, and any objection, plus the grounded desired_direction and current_pattern when present. Never infer an objection from generic busyness, low energy, family context, or a missing reply. A discrepancy is useful only as a gentle reflection of their own words, never as guilt, confrontation, or pressure.

OBJECTION RESPONSE: treat an objection as decision information, not something to defeat. First answer or reflect the exact concern. Ask at most one clarifying question only when the answer changes fit or the truthful next step. Then either give one relevant fact/reframe and preserve choice, or pause. Price: state the exact price and terms once, never minimise financial pressure or imply they can afford it. Time: distinguish a practical scheduling constraint from a polite no; do not argue that everyone has time. Confidence or past failure: affirm real evidence, separate the person from a poor-fit system, and never promise results. Partner decision: respect the shared decision and offer a concise summary they can take away; never coach them to bypass someone. Thinking time: accept it without a deadline or follow-up pressure, and only offer to clear up a specific uncertainty they named. Online/in-person or existing support: explain the fit plainly before any link. A clear no ends the sales move.

PSYCHOLOGY SAFETY: never diagnose personality, trauma, mental health, attachment, motives, or unconscious beliefs. Never exploit pain, body image, grief, fear, loneliness, medical issues, financial stress, or low confidence. Never manufacture urgency, scarcity, shame, obligation, reciprocity debt, or social proof. Do not use persuasion tricks to override a no, hesitation, or autonomy signal. The psychology state chooses how to be helpful and human, not how to manipulate a sale. Offer and invite permissions still come only from the commercial and bridge gates.

RAPPORT HAS A JOB: do not collect facts just to tick boxes. Build normal human back-and-forth, then use their own words to connect the chat toward health, fitness, energy, confidence, food, training, or consistency when it genuinely fits. If relationship_context is blank and their latest message has no health/fitness/food/energy/help signal, usually set is_question_moment=false and let Shannon keep chatting. But once they name a clear blocker, goal, low-energy pattern, consistency issue, or practical help need, stop pen-palling and move one step toward help: a tiny useful lens, a precise fit question, or an earned soft Founders Pass bridge. Do not treat playful "send help" as an offer request by itself. Do not ask "what are your goals?" early. Do not bundle age/name/goal/blocker questions.

EARN THE NEXT RESPONSE: every suggested next move should give the lead a reason to reply. It must do at least one of these: answer their direct question, mirror the most specific hook, add one tiny useful lens, or ask one precise question about the real blocker/preference/objection they just raised. Generic validation plus a broad question is a failed turn.

NO DEAD-END STATEMENTS: unless the lead is clearly closing the thread, do not suggest a reply that only agrees, shares a personal aside, or says "hope it goes well". Even light rapport should leave one obvious handle: a specific question from their exact topic, a tiny useful lens, or a playful callback that invites a reply. Food banter, group classes, projects, and wellness skepticism should each move one notch deeper before changing topic.

PLATEAU / TRIED-EVERYTHING GATE: when a lead says they are stuck, plateaued, not progressing, or have already tried lots of fixes and nothing changed, this is a diagnostic coaching moment, not an immediate checkout moment. Prefer a specific question about the sticking point, technique, recovery, load/intensity, food, or what changed when they tried those fixes. Do not move to the paid offer purely because they are frustrated.

APP / WORKOUT SUPPORT GATE: if they mention the app glitching, logging problems, reconnecting to Balance, the app/helper, account access, needing a specific workout plan, full-body M/W/F plans, stale exercises, rep schemes, or simplifying tech, treat it as a support/programming request first. Do not convert that into a Founders Pass offer unless they explicitly ask to start or get the link.

LOCAL / IN-PERSON / EXISTING TRAINER GATE: if they say they want someone local, in-person, face-to-face, a PT, a personal trainer, or they already have a trainer/coach, treat that as a preference or compatibility objection. Do not invite or send the link yet. First answer plainly that the Founders Pass is an online app, plant-based community and guided six-week kickstart, not in-person personal training. Ask whether that kind of online structure and community would still be useful, or how it needs to fit around their current trainer.

FOUNDERS PASS OFFER GATE: The Balance Foundations Founders Pass is the primary offer for warm, help-seeking leads, but it is not the default reward for empty friendliness. It is AUD $89.99 once and includes a fixed six-week course, six weeks of app/community access, one weekly check-in, and workout and food review/adjustments from Shannon. It does not auto-renew. Online Coaching is the ongoing individual progression option after Foundations or from day one. This gate is for qualifier-eligible leads only, never linked app users, paying members, or support/check-in threads. There are two good moments to move it forward: (1) they make the human move first by asking what is included, asking for the link, saying they want to join/start, asking about the app/community, or admitting they need help, structure or a starting point; or (2) the conversation has earned a soft bridge because Shannon already has a normal-life anchor plus enough health/fitness context, such as current state plus motivation or blocker, and there have usually been 3-6 meaningful lead replies. If the newest turn is casual or unrelated to fitness, food, health, consistency or the offer, do not combine the topic change and the paid offer in one outbound. First reconnect naturally to the relevant goal or blocker and let the lead answer; offer on the following turn if the opening remains live. Direct buyer intent is the exception. In an earned bridge, do not send a link or full brochure. Make the offer feel like one casual line discovered from their own words. For example: "honestly the founders pass could be a good starting point for that, it gives you the six-week course and my weekly review without rolling into a subscription. I can send the details through here". Do not hardcode that wording, but keep that size and feel. Save the full feature rundown for when they ask what is included or ask for the link. Words like "keen", "interested", "haha", "yeah sounds good", "send help", "starting from scratch", or "need a kickstart" are not enough by themselves when the tracked context is thin. If those same positive words come directly after Shannon offered the pass or details, treat that as acceptance and move to the approved Founders Pass link handoff. The approved link is https://plantbased-balance.org/founders. Current tracked meaningful lead replies from this person: ${leadReplyCount}.

CALL ESCALATION GATE: do not make a call the normal next step for a warm or qualified lead. Keep the sale in DMs and send the coaching details/checkout link when they ask or accept. A call request is commercial only when the lead explicitly connects it to Balance, coaching, fitness/health help, the offer, working with Shannon, or talking through a real buying decision. A flirtatious or personal request to video chat, FaceTime, use Discord/WhatsApp, talk socially, or see Shannon face-to-face is not buyer intent and must not affect the commercial stage. Never suggest that Shannon accept or arrange a personal call. Offer the short booking path only when they explicitly ask to discuss the coaching decision, remain genuinely uncertain after a clear DM explanation, or their situation needs Shannon's professional judgement. Do not use a call to avoid making the paid offer in DMs.

EARNED BRIDGE SHAPE: once the lead has shared enough real context, the bridge should be short and conversational, for example "the founders pass could be an easy way to get the structure and plant-based community around that without another weekly bill". Never use a stock invite line or a mini app brochure.

LEAD BEHAVIOR PROFILE: this is not personality typing and not mind-reading. It is a practical sales-safety read from the actual DM text. Use it to lower threat, protect autonomy, and choose the next move.
- primary_need is what support they seem to need most right now.
- protection_pattern is the likely reason they might resist, hesitate, or avoid another plan.
- autonomy_sensitivity says how carefully Shannon should preserve their sense of control.
- sales_readiness is the current sales move state: rapport, problem_named, protection_named, identity_confirmed, bridge_ready, link_ready, or not_now.
- identity_signal is the exact self-recognition to invite, such as "does better with structure than winging it". Keep it short and grounded.
- best_next_move is Shannon's private guidance for the next reply, not client-facing copy.

Allowed behavior_profile values:
${behaviorProfileOptions}

STOCK QUESTION BAN: do not output generic routine questions like "what does a normal day look like for you at the moment?", "what does a normal day of eating look like for you?", "are you much of a cook or more of a takeaway person?", "you training at the moment?", "what's for lunch?", or "what are your goals?". They sound pasted from a script and are unsafe for auto-send. If there is no specific health, fitness, or help bridge in the lead's latest words, set is_question_moment=false.

RELATIONSHIP CHECKLIST: this is background memory for human context, not a form and not a question bank. Fill items when the lead volunteers them or Shannon naturally asks. Missing items should not force a question:
${relationshipChecklist}

CORE CONNECTION ANCHORS: "What they love" and "Stressors/frustrations" are useful relationship colour, not a hard gate. Shannon should eventually learn them, but only through natural openings. Do not force a standalone deep question just to tick one off. If the lead is chatting, bantering, or answering Shannon's last question, it is fine to set is_question_moment=false and just keep the conversation human.

NEVER use em-dashes in any output (Shannon hates them, they read AI). Use periods, colons, or commas instead.

THE 4-STAGE PLAYBOOK:
${playbook}

Plus terminal states: pitched (Founders Pass offer made) | won (accepted the Founders Pass or signed up) | lost (explicit no / cold for 30+ days) | paused (asked to wait).

CURRENT STATE FOR THIS LEAD (${leadName}, channel: ${channelLabel}):
  stage: ${currentQualifier.stage} (${currentQualifier.stage_label}, ${currentQualifier.stage_index}/4)
  warmth: ${currentQualifier.warmth_score}/100 (${currentQualifier.warmth_label})
  challenge_route: ${currentQualifier.challenge_route}
  meaningful lead replies: ${leadReplyCount}
  behavior_profile:
${behaviorProfileText}
  bridge_plan: ${JSON.stringify(normalizeBridgePlan(currentQualifier.bridge_plan))}
  conversation_psychology: ${JSON.stringify(normalizeConversationPsychology(currentQualifier.conversation_psychology))}
  facts so far:
${factsSummary}

If the stored facts above are blank but the conversation history clearly contains answers, backfill them from the history. The saved state can be stale after webhook retries or model failures, but Shannon still needs continuity.

CURRENT TIME (Australia/Brisbane): ${promptNowText}. Use the exact timestamps, relative ages, and gaps to judge whether this is rapid banter, a delayed reply, or a stale thread.

CONVERSATION HISTORY (oldest → newest, with timestamps so you can judge pace):
${historyText}

THEIR JUST-ARRIVED MESSAGE (around ${promptNowText}):
${leadName}: ${String(currentMessage || '').slice(0, 800)}

DRAFT REPLY SHANNON IS ABOUT TO SEND (already generated by another model — you don't rewrite it, you just tell him whether THIS turn is the right moment to push a qualifier move, or just chat):
${draftText ? draftText : '(no draft generated)'}

ADDITIONAL CONTEXT (ManyChat custom data — referrer ad, etc):
${customDataText}

NOW DECIDE:

1. **facts**: extract facts the lead has revealed in the newest message and any missing facts that are obvious from the recent history. Keep existing facts unchanged unless the new message contradicts or refines them. hook_context records the real opening context: Shannon's story/outreach opener for organic conversations, or the verified Meta ad/referral for paid_meta. relationship_context is a compact summary of their normal-life anchors. relationship_checklist stores the specific tick-off facts above: location, work_study, household_family, pets, daily_rhythm, food_setup, training_background, loves, stressors_frustrations. Include names of family members, partners, kids, dogs, or pets only when the lead says them. Capture what they love and what gets under their skin only when they say it or clearly confirm it. Leave fields as-is unless there's a clear update.

2. **stage**: which stage they're at NOW. The stage advances when its corresponding fact gets a meaningful answer, but do not rush beyond current_state while relationship_context is blank unless they clearly asked to start or already volunteered strong goal context. If the lead jumped ahead and answered a later stage's question, capture that fact and move stage to the next still-unanswered one. If Shannon has a relationship anchor, at least two useful core facts (current_state, motivation, history_blockers, commitment), and at least 3 meaningful lead replies, the next move can be a soft invite bridge instead of another getting-to-know-you question. If all 4 facts are filled, the next move is usually to offer the Founders Pass, not to write a standalone meal plan or workout program in DMs. Missing loves or stressors_frustrations should not block the next step if the person is otherwise warm or asking to move forward. Use "pitched" once Shannon has offered the Founders Pass or asked whether they want the details. If they explicitly accept that offer ("im in", "save me a spot", "lets do it", "keen") or reply positively right after the pitch ("yes pls", "yeah sounds good", "sounds so good"), advance to "won". If they explicitly decline or have been silent 30+ days, "lost".

3. **warmth_score** (0-100):
   - 0-25 cold: short replies, slow, dodging
   - 26-50 lukewarm: replying but minimal engagement, one-liners, late
   - 51-75 warm: full sentences, asking back, sharing context, prompt
   - 76-100 hot: enthusiasm, "yes please", urgency, asking how to start
   Adjust based on the LATEST message + recent reply latency. Don't ratchet down for one slow reply if the prior thread was warm.

4. **challenge_route**: keep this legacy field as the offer angle. Use 'vegan' if they mention plant-based / vegan / vegetarian / dietary curiosity. Use 'generic' if they want fitness / weight / energy with no diet preference. Use 'undecided' if not enough signal.

5. **behavior_profile**: update the behavior profile from the newest message and recent history. Preserve prior fields unless the lead clearly updates the read. Good examples: "I know what to do, I just never stick to it" -> primary_need=accountability, protection_pattern=already_knows_what_to_do, sales_readiness=identity_confirmed. "I have tried so many plans" -> protection_pattern=fear_of_failing_again or skeptical_of_another_plan. "I hate being sold stuff" or "are you trying to sell me something?" -> protection_pattern=hates_being_sold_to and autonomy_sensitivity=high. Keep that protection active through later ordinary fitness sharing; only direct help, details, link, signup, or start intent reopens qualification or offer progression. "Can you send me the details?" -> sales_readiness=link_ready. "not right now" -> sales_readiness=not_now. Do not infer medical, trauma, or personality claims.

6. **commercial_stage** and **commercial_reason**: apply the four-stage commercial definition above. Problem-qualified requires both the lead's personal health/fitness goal and a real current blocker in their own words. Motivation alone is not a blocker. "Nothing really stops me", "training is part of life", existing coach/program support, and a prior decline or not-now stay engaged unless the lead later shows direct buyer intent. commercial_reason must cite the lead's own personal buying/problem evidence in under 18 words. If there is no such evidence, say that the conversation is engaged but not commercially qualified. Never use reply count or warmth score as the reason.

7. **next_question**: legacy field name. Prefer a statement-led next move when this turn naturally supports one. One sentence max, Australian casual, normal phone autocorrect casing, no greetings, no em-dashes. An earned Founders Pass offer should be a casual fit bridge plus a low-pressure details handle, not an app explainer. The move should either keep a real thread-specific hook alive, bridge their own words toward health/fitness, help them self-identify what they need help with, or softly invite them into the Founders Pass once enough lead-only context has been earned. Use declarative elicitation before questions: "sounds like food is the bit that keeps derailing the week", "seems like you do better with structure than winging it", or "you are probably past needing more random tips". Let them confirm, correct, or add the missing detail. Never give answer options or a menu such as "food, training, or consistency?"; when a real blocker question is earned, ask one open question in their language. If the lead is asking what the Founders Pass, app, support, community, price, inclusions, or setup means, use allowed_move=clarify, answer that question fully, set is_question_moment=false, and leave space unless their same message also introduces a concrete blocker or objection. Do not ask routine survey questions. Do not push a move just because the checklist is thin. First/early replies to Shannon's story opener can use one tiny relevant move about their hook, like how they use the app/tool/routine, where the place is, what the food was, or how the session went, but that move can be a statement. Set is_question_moment=true only when this turn genuinely needs a hook move; set it false when a short acknowledgement, banter line, or statement is enough. If there is no specific hook and Shannon has not asked a basic day/week opener, a simple day/week check-in is acceptable. Only skip the move when they only said thanks/emoji/filler, it is a genuinely short no-response-needed reply, the topic is a current safety/medical/rehab advice situation, or the thread is clearly closing. Old injury, surgery, rehab, hospital, or pain history from an unlinked lead is not sensitive by itself. When they share a stable limitation that affects their training but do not ask for diagnosis, treatment, or rehab advice, set is_question_moment=true and use one non-medical training-context question about what they can still progress or how it affects their week. Treat it as normal rapport, never a diagnosis, prescription, or pitch off vulnerability. A Shannon personal aside alone is not enough there, but do not force a question mark just to keep them replying. No health/fitness/help bridge is required for this first story-reply move. If Shannon asked whether they were okay after a sad animal/pet story and they answer that they are okay but the animals are not, do not ask what happened to the animals. If a move is useful, bridge through vegan/animal-values context instead, such as how long they have been vegan/plant-based or what got them into it; later, bridge to how they go with fitness before offering the Founders Pass. If the latest message is banter with enough relationship context, a direct answer to Shannon's last question, or there is no clear health/fitness/help bridge, set is_question_moment=false and next_question="". If the latest message is an in-person/local/PT/current-trainer preference, make the next move about that preference first, not the offer link. If at least 3 meaningful lead replies plus real context have been earned, prefer a contextual Founders Pass bridge like "the founders pass could give you a proper six-week starting rhythm without another weekly bill" over asking another personal-history question. Vary this wording to match the lead's exact situation and do not hardcode that example. If stage is "pitched" and they have not accepted yet, only use a tiny next-step move if needed, like "I can send the link through here". If stage is "won", set is_question_moment=false and make next_question the approved Founders Pass link handoff, not another intake question. Do not mark "pitched" just because they are friendly or vaguely interested; wait for a real help/start/offer signal or an earned soft bridge.

After a lead answers a health or fitness progression question, use a reflection or statement-led turn before another qualifier question. If they call it an interview, mention too many questions, show question fatigue, or ask whether Shannon is trying to sell or pitch them something, set is_question_moment=false and next_question="". A later ordinary fitness answer does not clear sales suspicion. Keep the next turn statement-led and leave space until they explicitly ask for help, details, a link, or how to start.

8. **why_now**: 1-2 sentences explaining the timing, citing a specific phrase from THE LEAD'S WORDS. Format: "She wrote 'X', which signals Y. Now's the moment because Z." Be concrete. If is_question_moment is false, why_now explains why we're holding off ("she just vented about her boss, validate first").

9. **quote_evidence**: the exact phrase from the lead's words your reasoning hinges on. Null if there isn't one (e.g. on a first reply with no signal yet).

10. **is_question_moment**: legacy field name. true if this turn is the right moment to push the next stage's elicitation move. false if Shannon should just chat / validate / acknowledge without pushing the funnel forward this turn.

Keep the whole JSON compact. Use null for unknown facts. Each fact string should be under 12 words. next_question should be one short statement or question. why_now should be under 18 words. Do not repeat the schema or explain anything outside JSON.

OUTPUT JSON ONLY — no commentary, no code fences:
{
  "stage": "...",
  "facts": { "hook_context": "...", "relationship_context": "...", "relationship_checklist": { "location": "...", "work_study": "...", "household_family": "...", "pets": "...", "daily_rhythm": "...", "food_setup": "...", "training_background": "...", "loves": "...", "stressors_frustrations": "..." }, "current_state": "...", "motivation": "...", "history_blockers": "...", "commitment": "..." },
  "warmth_score": 0,
  "commercial_stage": "engaged",
  "commercial_reason": "...",
  "bridge_plan": {
    "current_anchor": "...",
    "current_stage": "social_topic",
    "destination": "fitness_context",
    "next_adjacent_step": "...",
    "move_this_turn": "hold",
    "distance_to_fitness": 3,
    "evidence": "...",
    "direct_fitness_question_allowed": false
  },
  "conversation_psychology": {
    "need_right_now": "heard",
    "change_talk_strength": "none",
    "confidence_signal": "unknown",
    "friction_type": "unknown",
    "allowed_move": "reflect",
    "objection_type": "none",
    "decision_state": "not_deciding",
    "objection_evidence": "...",
    "change_talk_evidence": "...",
    "confidence_evidence": "...",
    "desired_direction": "...",
    "current_pattern": "..."
  },
  "challenge_route": "...",
  "behavior_profile": { "primary_need": "...", "protection_pattern": "...", "autonomy_sensitivity": "...", "sales_readiness": "...", "identity_signal": "...", "best_next_move": "..." },
  "next_question": "...",
  "why_now": "...",
  "quote_evidence": "...",
  "is_question_moment": true
}`;
}

function parseEvaluationOutput(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    let trimmed = rawText.trim();
    // Strip optional ```json fences
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    if (!trimmed) return null;
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {
        // fall through — try to recover the first JSON object in the response
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { /* give up */ }
        }
    }
    return null;
}

async function runQualifierEvaluation(prompt) {
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { temperature: 0.2, maxOutputTokens: 3072, responseMimeType: 'application/json' };
    const attempts = [
        {
            label: 'public-gemini',
            run: () => callGeminiFallback(contents, generationConfig),
        },
        {
            label: 'vertex-gemini',
            run: () => callVertexGeminiMultimodal(contents, generationConfig),
        },
    ];

    let lastError = null;
    for (const attempt of attempts) {
        let raw = '';
        try {
            raw = await attempt.run();
        } catch (err) {
            lastError = `${attempt.label}: ${err.message}`;
            console.warn('[qualifier-engine] evaluation failed:', lastError);
            continue;
        }

        const parsed = parseEvaluationOutput(raw);
        if (parsed) {
            return { parsed, model: attempt.label, error: null };
        }

        lastError = `${attempt.label}: parse_failed`;
        console.warn('[qualifier-engine] failed to parse JSON from output:', raw.slice(0, 200));
    }

    return { parsed: null, model: 'none', error: lastError || 'evaluation_failed' };
}

/**
 * Run one Gemini Flash evaluation pass and return the merged-and-normalized
 * next qualifier state. Falls back to the prior state on any failure so the
 * caller never crashes on AI flakes.
 */
async function evaluateQualifier({ thread, history, currentMessage, draftText, leadName, channel }) {
    const prior = normalizeQualifier(thread.qualifier);
    const meaningfulLeadReplyCount = countMeaningfulLeadReplies(history, currentMessage);

    // Auto-fill hook_context if it's still null and we can infer one. Done
    // BEFORE the prompt so the model sees the context we already have.
    if (!prior.facts.hook_context) {
        const inferred = inferHookContext({ history, customData: thread.custom_data });
        if (inferred) prior.facts.hook_context = inferred;
    }

    const prompt = buildEvaluationPrompt({
        leadName,
        channel,
        currentQualifier: prior,
        history,
        currentMessage,
        draftText,
        customData: thread.custom_data,
        meaningfulLeadReplyCount,
    });

    let raw = '';
    let modelUsed = 'none';
    try {
        // Lower temperature than the draft model — we want consistent
        // structured output, not creative voice.
        const evalResult = await runQualifierEvaluation(prompt);
        if (!evalResult.parsed) {
            throw new Error(evalResult.error || 'evaluation_failed');
        }
        raw = JSON.stringify(evalResult.parsed);
        modelUsed = evalResult.model || modelUsed;
    } catch (err) {
        console.warn('[qualifier-engine] Gemini evaluation failed:', err.message);
        return { qualifier: prior, evaluated: false, error: err.message, model: modelUsed };
    }

    const parsed = parseEvaluationOutput(raw);
    if (!parsed) {
        console.warn('[qualifier-engine] failed to parse JSON from output:', raw.slice(0, 200));
        return { qualifier: prior, evaluated: false, error: 'parse_failed', model: modelUsed };
    }

    // Merge: keep prior facts unless the model returned a non-null value.
    const priorRelationshipChecklist = normalizeRelationshipChecklist(prior.facts || {});
    const parsedRelationshipChecklist = normalizeRelationshipChecklist(parsed.facts || {});
    const relationshipChecklist = {};
    for (const key of RELATIONSHIP_CHECKLIST_KEYS) {
        relationshipChecklist[key] = parsedRelationshipChecklist[key] ?? priorRelationshipChecklist[key];
    }
    const mergedFacts = {
        hook_context: cleanFactValue(parsed.facts?.hook_context) ?? prior.facts.hook_context,
        relationship_context: cleanFactValue(parsed.facts?.relationship_context) ?? prior.facts.relationship_context,
        relationship_checklist: relationshipChecklist,
        current_state: cleanFactValue(parsed.facts?.current_state) ?? prior.facts.current_state,
        motivation: cleanFactValue(parsed.facts?.motivation) ?? prior.facts.motivation,
        history_blockers: cleanFactValue(parsed.facts?.history_blockers) ?? prior.facts.history_blockers,
        commitment: cleanFactValue(parsed.facts?.commitment) ?? prior.facts.commitment,
    };
    const behaviorProfile = mergeBehaviorProfiles(prior.behavior_profile, parsed.behavior_profile);
    const bridgePlan = normalizeBridgePlan(parsed.bridge_plan || prior.bridge_plan);
    const conversationPsychology = normalizeConversationPsychology(
        parsed.conversation_psychology || prior.conversation_psychology
    );

    let next = normalizeQualifier({
        stage: parsed.stage || prior.stage,
        facts: mergedFacts,
        warmth_score: parsed.warmth_score ?? prior.warmth_score,
        warmth_label: warmthLabelFor(parsed.warmth_score ?? prior.warmth_score),
        commercial_stage: parsed.commercial_stage || prior.commercial_stage,
        commercial_reason: parsed.commercial_reason || prior.commercial_reason,
        bridge_plan: bridgePlan,
        conversation_psychology: conversationPsychology,
        next_question: parsed.next_question || prior.next_question,
        why_now: parsed.why_now || prior.why_now,
        quote_evidence: parsed.quote_evidence ?? prior.quote_evidence,
        is_question_moment: parsed.is_question_moment !== undefined ? !!parsed.is_question_moment : prior.is_question_moment,
        challenge_route: parsed.challenge_route || prior.challenge_route,
        behavior_profile: behaviorProfile,
        meaningful_lead_reply_count: meaningfulLeadReplyCount,
        evaluated_at: new Date().toISOString(),
    });
    next.meaningful_lead_reply_count = meaningfulLeadReplyCount;
    next = applyRapportGate({ qualifier: next, currentMessage, leadReplyCount: meaningfulLeadReplyCount });
    next.commercial_stage = deriveCommercialStage({
        qualifier: next,
        currentMessage,
        proposedStage: parsed.commercial_stage,
    });
    next.commercial_reason = cleanProfileText(parsed.commercial_reason, 180)
        || `Commercial stage: ${next.commercial_stage.replace(/_/g, ' ')}.`;

    return { qualifier: next, evaluated: true, error: null, model: modelUsed };
}

// ============================================================
// Persist
// ============================================================

async function persistQualifier(threadId, qualifier) {
    if (!threadId || !qualifier) return false;
    try {
        await supabaseQuery(`ig_threads?id=eq.${threadId}`, {
            method: 'PATCH',
            body: { qualifier },
            prefer: 'return=minimal',
        });
        return true;
    } catch (err) {
        console.warn(`[qualifier-engine] persist failed for thread ${threadId}: ${err.message}`);
        return false;
    }
}

// ============================================================
// Push notification formatting
// ============================================================

/**
 * Compact header text for the FCM data payload `senderName` field. Format:
 *   "Sarah · S2/4 warm"           — qualifier-eligible lead with stage info
 *   "Sarah · S2/4 warm · MOVE"    — when this turn has a next move
 *   "Sarah"                       — qualifier ineligible / no data
 *
 * Title sits at the top of the lock-screen banner so the stage is visible
 * at a glance even before Shannon expands the notification.
 */
function formatPushTitle({ leadName, qualifier, eligible }) {
    if (!eligible || !qualifier) return leadName;
    if (TERMINAL_STAGES.has(qualifier.stage)) {
        const tag = qualifier.stage === 'won' ? 'WON' : qualifier.stage.toUpperCase();
        return `${leadName} · ${tag}`;
    }
    const stagePart = `S${qualifier.stage_index}/4 ${qualifier.warmth_label}`;
    if (qualifier.is_question_moment) {
        return `${leadName} · ${stagePart} · MOVE`;
    }
    return `${leadName} · ${stagePart}`;
}

/**
 * Body line composed for the push notification. The draft itself now
 * includes the qualifier next move as a trailing chunk when there is a
 * push moment, so the body is always just the draft preview.
 * The push title already carries "· MOVE" from formatPushTitle.
 */
function formatPushBody({ qualifier, draftText, fallbackText, eligible }) {
    return draftText || fallbackText || '';
}

/**
 * Flat string fields for the FCM data payload. Native services and PWA
 * pushes can read these to render the qualifier strip without parsing the
 * full JSON.
 */
function summarizeForFcmData(qualifier) {
    if (!qualifier) return {};
    const behavior = normalizeBehaviorProfile(qualifier.behavior_profile);
    return {
        qualifierStage: qualifier.stage || '',
        qualifierStageLabel: qualifier.stage_label || '',
        qualifierStageIndex: String(qualifier.stage_index || ''),
        qualifierWarmth: String(qualifier.warmth_score || ''),
        qualifierWarmthLabel: qualifier.warmth_label || '',
        qualifierCommercialStage: normalizeCommercialStage(qualifier.commercial_stage),
        qualifierCommercialReason: qualifier.commercial_reason || '',
        qualifierNextQuestion: qualifier.next_question || '',
        qualifierWhyNow: qualifier.why_now || '',
        qualifierIsQuestionMoment: qualifier.is_question_moment ? '1' : '0',
        qualifierChallengeRoute: qualifier.challenge_route || '',
        qualifierPrimaryNeed: behavior.primary_need || '',
        qualifierProtectionPattern: behavior.protection_pattern || '',
        qualifierAutonomySensitivity: behavior.autonomy_sensitivity || '',
        qualifierSalesReadiness: behavior.sales_readiness || '',
        qualifierBestNextMove: behavior.best_next_move || '',
    };
}

function _hasPromptFact(value) {
    return cleanFactValue(value) != null;
}

function humanizeProfileToken(value) {
    return String(value || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, ch => ch.toUpperCase());
}

function buildQualifierRelationshipBlock(qualifier) {
    if (!qualifier || typeof qualifier !== 'object') return '';
    const facts = qualifier.facts || {};
    const checklist = normalizeRelationshipChecklist(facts);
    const behavior = normalizeBehaviorProfile(qualifier.behavior_profile);
    const lines = [];
    const stageLabel = qualifier.stage_label || (qualifier.stage || '').replace(/_/g, ' ');
    const stageIndex = qualifier.stage_index ? `S${qualifier.stage_index}/4` : '';
    const warmth = (qualifier.warmth_label || qualifier.warmth_score)
        ? `Warmth: ${qualifier.warmth_score || '?'}${qualifier.warmth_label ? ` (${qualifier.warmth_label})` : ''}`
        : '';
    if (stageLabel || warmth) {
        lines.push(['Qualifier', stageIndex, stageLabel, warmth].filter(Boolean).join(' | '));
    }
    lines.push(`Commercial stage: ${humanizeProfileToken(normalizeCommercialStage(qualifier.commercial_stage))}`);
    if (qualifier.commercial_reason) lines.push(`Commercial evidence: ${qualifier.commercial_reason}`);
    if (Number(qualifier.meaningful_lead_reply_count) > 0) {
        lines.push(`Meaningful lead replies: ${Number(qualifier.meaningful_lead_reply_count)} (soft invite window starts at 3)`);
    }
    const anchorLines = [
        _hasPromptFact(checklist.loves) ? `What they love: ${checklist.loves}` : 'What they love: (not ticked off yet)',
        _hasPromptFact(checklist.stressors_frustrations) ? `Stressors/frustrations: ${checklist.stressors_frustrations}` : 'Stressors/frustrations: (not ticked off yet)',
    ];
    lines.push('Core connection anchors:\n' + anchorLines.join('\n'));
    const lifeLines = [
        ['Location', checklist.location],
        ['Work/study', checklist.work_study],
        ['Family/household', checklist.household_family],
        ['Dogs/pets', checklist.pets],
        ['Daily rhythm', checklist.daily_rhythm],
        ['Food setup', checklist.food_setup],
        ['Training background', checklist.training_background],
    ].filter(([, value]) => _hasPromptFact(value))
        .map(([label, value]) => `${label}: ${value}`);
    if (lifeLines.length) lines.push('Life context:\n' + lifeLines.join('\n'));
    const funnelLines = [
        ['Current state', facts.current_state],
        ['Motivation', facts.motivation],
        ['History/blockers', facts.history_blockers],
        ['Commitment', facts.commitment],
    ].filter(([, value]) => _hasPromptFact(value))
        .map(([label, value]) => `${label}: ${value}`);
    if (funnelLines.length) lines.push('Funnel facts:\n' + funnelLines.join('\n'));
    const behaviorLines = [
        behavior.primary_need && behavior.primary_need !== 'unknown' ? `Primary need: ${humanizeProfileToken(behavior.primary_need)}` : '',
        behavior.protection_pattern && behavior.protection_pattern !== 'unknown' ? `Protection pattern: ${humanizeProfileToken(behavior.protection_pattern)}` : '',
        behavior.autonomy_sensitivity && behavior.autonomy_sensitivity !== 'unknown' ? `Autonomy sensitivity: ${humanizeProfileToken(behavior.autonomy_sensitivity)}` : '',
        behavior.sales_readiness ? `Sales readiness: ${humanizeProfileToken(behavior.sales_readiness)}` : '',
        behavior.identity_signal ? `Identity signal: ${behavior.identity_signal}` : '',
        behavior.best_next_move ? `Best next move: ${behavior.best_next_move}` : '',
    ].filter(Boolean);
    if (behaviorLines.length) {
        lines.push('Lead behavior profile:\n' + behaviorLines.join('\n'));
    }
    const bridge = normalizeBridgePlan(qualifier.bridge_plan);
    if (bridge.current_anchor || bridge.next_adjacent_step) {
        lines.push('Private subtle bridge plan (planning only, do not recite):\n' + [
            bridge.current_anchor ? `Live human anchor: ${bridge.current_anchor}` : '',
            `Route stage: ${bridge.current_stage} -> ${bridge.destination}`,
            `Distance to explicit fitness context: ${bridge.distance_to_fitness}`,
            bridge.next_adjacent_step ? `Next adjacent step: ${bridge.next_adjacent_step}` : '',
            `Move this turn: ${bridge.move_this_turn}`,
            `Direct fitness question allowed: ${bridge.direct_fitness_question_allowed ? 'yes' : 'no'}`,
            bridge.evidence ? `Evidence: ${bridge.evidence}` : '',
        ].filter(Boolean).join('\n'));
    }
    const psychology = normalizeConversationPsychology(qualifier.conversation_psychology);
    if (
        psychology.need_right_now !== 'unknown'
        || psychology.change_talk_strength !== 'none'
        || psychology.friction_type !== 'unknown'
    ) {
        lines.push('Private ethical conversation psychology (never diagnose or recite):\n' + [
            `Need right now: ${psychology.need_right_now}`,
            `Change talk: ${psychology.change_talk_strength}`,
            `Confidence: ${psychology.confidence_signal}`,
            `Friction: ${psychology.friction_type}`,
            `Allowed move: ${psychology.allowed_move}`,
            `Objection: ${psychology.objection_type}`,
            `Decision state: ${psychology.decision_state}`,
            psychology.objection_evidence ? `Objection evidence: ${psychology.objection_evidence}` : '',
            psychology.change_talk_evidence ? `Change-talk evidence: ${psychology.change_talk_evidence}` : '',
            psychology.confidence_evidence ? `Confidence evidence: ${psychology.confidence_evidence}` : '',
            psychology.desired_direction ? `Their desired direction: ${psychology.desired_direction}` : '',
            psychology.current_pattern ? `Their current pattern: ${psychology.current_pattern}` : '',
            'Use this to support autonomy and evoke their own thinking. Never use it to pressure an offer.',
        ].filter(Boolean).join('\n'));
    }
    if (qualifier.next_question && qualifier.is_question_moment) {
        lines.push(`Suggested relationship move: ${qualifier.next_question}`);
    }
    if (lines.length === 0) return '';
    return `\n\nLEAD RELATIONSHIP CHECKLIST (use this to build connection and avoid asking what is already ticked off):\n${lines.join('\n\n')}`;
}

module.exports = {
    STAGES,
    RELATIONSHIP_CHECKLIST,
    RELATIONSHIP_CHECKLIST_KEYS,
    TERMINAL_STAGES,
    isQualifierEligible,
    freshQualifier,
    normalizeQualifier,
    normalizeBridgePlan,
    normalizeConversationPsychology,
    normalizeBehaviorProfile,
    normalizeCommercialStage,
    deriveCommercialStage,
    hasDirectBuyerIntent,
    hasCommercialProblemEvidence,
    inferNativeStoryHookContext,
    inferHookContext,
    formatQualifierCustomDataText,
    cleanFactValue,
    evaluateQualifier,
    persistQualifier,
    applyRapportGate,
    protectEarnedLeadProgression,
    hasCurrentLeadQualificationSignal,
    hasSalesSuspicionSignal,
    hasLeadQualificationStopSignal,
    formatPushTitle,
    formatPushBody,
    summarizeForFcmData,
    buildQualifierRelationshipBlock,
    isUnsafeStockDiscoveryQuestion,
    hasHumanHelpIntent,
    hasChallengeInviteReadinessSignal,
    isInPersonOrExistingCoachPreference,
    handlesInPersonOrExistingCoachPreference,
    isMeaningfulLeadReply,
    countMeaningfulLeadReplies,
    hasEarnedChallengeInviteMoment,
    isChallengeInviteText,
    isChallengeOfferWarningText,
    isAppOrWorkoutPlanSupportRequest,
    isPrematureChallengeInvite,
    isUnrequestedOfferInjection,
    warmthLabelFor,
    stageMetaFor,
};
