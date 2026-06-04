/**
 * Lead Qualifier Engine
 *
 * Per-lead funnel intelligence layered on top of the IG/FB instant-draft
 * pipeline. After every inbound DM from a non-converted lead, this module:
 *
 *   1. Pulls the current qualifier state from ig_threads.qualifier
 *   2. Asks Gemini Flash: "given the conversation so far, what's their
 *      stage, what do we know, how warm are they, and what should Shannon
 *      ask next, with a quote-grounded reason"
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
 * `won`, `lost`, `paused`. `pitched` means Shannon offered the free challenge
 * of 1:1 coaching. `won` means they accepted the offer or signed up.
 *
 * Stages aren't sequential gates. Facts can land out of order if the lead
 * volunteers them. The AI decides whether THIS turn warrants pushing the
 * next question — `is_question_moment=false` means "just chat, no push".
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
        strategy: 'keep rapport first. only ask when their own words create a natural bridge toward health or fitness, and aim for them to name the thing they want help with',
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
        strategy: 'ask only when they have already admitted some friction. the point is to clarify the help they need, not interview them',
    },
    {
        key: 'commitment',
        index: 4,
        label: 'Commitment',
        what_to_learn: 'ready-to-start signal for the free 30-day Balance Challenge + the real-life situation it can naturally support',
        strategy: 'when they ask how to start, ask for the link, plainly say they need help, or have earned a soft bridge, explain how Balance works from their exact context before asking another yes or sending the link',
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

function cleanFactValue(value) {
    if (value == null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\(?\s*(unknown|none|n\/a|null|not sure|unsure)\s*\)?$/i.test(trimmed)) return null;
    return trimmed;
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
    const mentionsOffer = /\b(30\s*day|30-day|challenge|app|program|signup|sign up|link)\b/i.test(s)
        || isOneOnOneCoachingLinkContext(s);
    const inviteLanguage = /\b(join|jump in|jump on\s+(?:the\s+)?(?:challenge|program|call|coaching)|get you in|get started|start monday|send.*link|link|save.*spot|i can set|get you set|get you started|want me to send|keen.*(?:challenge|coaching)|work with me|work with you|coaching details|coaching link|try\s+(?:the|this|my|our|a\s+free|the\s+free)?\s*(?:30\s*day|30-day|challenge|program|coaching)|hear more.*(?:challenge|coaching)|free\s+(?:30\s*day|30-day|challenge|program|coaching)|1\s*[:v]\s*1|one.?on.?one)\b/i.test(s);
    return mentionsOffer && inviteLanguage;
}

function isChallengeOfferWarningText(text) {
    const s = String(text || '').toLowerCase();
    if (!s) return false;
    if (/plantbased-balance\.org\/(vegan-challenge|transform-challenge)\.html|future-balance\.netlify\.app\/coaching\.html|plantbased-balance\.org\/coaching\.html/i.test(s)) return true;
    const mentionsOffer = /\b(30\s*day|30-day|challenge|free challenge|plant.?based challenge|transformation challenge|1\s*[:v]\s*1|one.?on.?one|coaching|personal coaching|online coaching)\b/i.test(s);
    const offerLanguage = /\b(join|jump in|jump on|get you in|get started|start monday|send.*link|link|save.*spot|sign ?up|i can set|get you set|get you started|want me to send|easiest starting point|keen.*(?:challenge|coaching)|work with me|work with you|coaching details|coaching link|try\s+(?:the|this|my|our|a\s+free|the\s+free)?\s*(?:30\s*day|30-day|challenge|program|coaching)|hear more.*(?:challenge|coaching)|free\s+(?:30\s*day|30-day|challenge|program|coaching))\b/i.test(s);
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

function isDeepFunnelQuestion(question) {
    const q = String(question || '').toLowerCase();
    if (!q) return false;
    return /\b(goal|goals|dream scenario|kicked this off|what would change|tried|before|gets? in the way|blocker|challenge|30 days|start|lock it in|program|app|lose weight|muscle|energy)\b/i.test(q);
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
        || /\byou training at the moment\b/i.test(q)
        || /\bwhat do you normally do when you get a bit of time\b/i.test(q)
        || /\bwhat are your goals\b/i.test(q)
        || /\bwhat'?s your goal\b/i.test(q)
        || /\bwhat does your current exercise routine consist of\b/i.test(q);
}

function chooseRapportQuestion(currentMessage, facts = {}) {
    const msg = String(currentMessage || '').toLowerCase();
    const missing = missingRelationshipItems(facts);
    const wants = (key) => missing.some(item => item.key === key);
    const hasProblemLanguage = /\b(hard|hardest|struggl\w*|stuck|slacking|off track|fall(?:ing)? off|fell off|tired|exhausted|fed up|lost|need help|help|can'?t|cannot|overwhelm\w*|motivation|consistent|consistency|binge|craving|injur\w*|sore|pain|hate)\b/i.test(msg);
    const hasFamily = /\b(kid|kids|child|children|mum|mom|dad|family|partner|husband|wife|sister|brother|parents?)\b/i.test(msg);
    const hasPlantBased = /\b(vegan|plant.?based|vegetarian)\b/i.test(msg);
    if (hasFamily && hasPlantBased) {
        return 'how did they take it when you decided to go vegan?';
    }
    if (/\b(friend|mate|bestie|someone)\b/i.test(msg) && /\b(convinced|got me|give it a go|try it|went vegan|go vegan)\b/i.test(msg) && hasPlantBased) {
        return 'what changed for you once you gave it a go?';
    }
    if (/\b(stress|stressed|stressful|annoy\w*|frustrat\w*|fed up|hate|overwhelm\w*|pressure|burnt|burned|chaos|hardest|struggl\w*|ticks? me off|tired|exhausted)\b/i.test(msg)) {
        return wants('stressors_frustrations')
            ? "what do you reckon is making it hardest right now?"
            : 'does that make looking after food or training harder too?';
    }
    if (/\b(kid|kids|child|children|mum|mom|dad|family|partner|husband|wife)\b/i.test(msg)) {
        return hasProblemLanguage
            ? 'does that make looking after yourself harder too?'
            : null;
    }
    if (/\b(work|job|shift|busy|school|study|uni|business)\b/i.test(msg)) {
        return hasProblemLanguage
            ? 'is it mainly time that makes food or training hard to lock in?'
            : null;
    }
    if (/\b(dog|dogs|puppy|cat|cats|pet|pets)\b/i.test(msg)) {
        return null;
    }
    if (/\b(cook|cooking|food|lunch|dinner|takeaway|vegan|plant|vegetarian|meal)\b/i.test(msg)) {
        return hasProblemLanguage
            ? 'is food the bit you feel like you need the most help with?'
            : null;
    }
    if (/\b(gym|train|training|workout|run|walking|sport)\b/i.test(msg)) {
        return hasProblemLanguage
            ? 'what part of training feels hardest to get consistent with?'
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
            why_now: qualifier.why_now || 'No grounded question is needed here. Keep the reply conversational.',
        };
    }
    if (!isUnsafeStockDiscoveryQuestion(qualifier.next_question)) return qualifier;

    const facts = qualifier.facts || {};
    const replacement = chooseRapportQuestion(currentMessage, facts);
    const next = { ...qualifier };

    if (replacement && !isUnsafeStockDiscoveryQuestion(replacement)) {
        next.next_question = replacement;
        next.why_now = 'The previous next question was too generic for the thread. Stay with the newest detail they shared and ask a specific follow-up instead.';
        return next;
    }

    next.is_question_moment = false;
    next.why_now = 'The available next question was too generic, so hold off and keep the reply conversational instead of forcing discovery.';
    return next;
}

function applyRapportGate({ qualifier, currentMessage, leadReplyCount } = {}) {
    if (!qualifier || TERMINAL_STAGES.has(qualifier.stage)) {
        return qualifier;
    }
    if (hasStartIntent(currentMessage)) {
        return applyStockQuestionGuard({ qualifier, currentMessage });
    }

    const facts = qualifier.facts || {};
    const next = { ...qualifier };

    if (
        next.is_question_moment
        && isChallengeInviteText(next.next_question)
        && !hasEarnedChallengeInviteMoment({ qualifier: next, currentMessage, leadReplyCount })
    ) {
        next.next_question = '';
        next.is_question_moment = false;
        next.why_now = 'Hold the free-challenge bridge until there are at least 3 meaningful lead replies plus real relationship and goal/blocker context, unless they directly ask for help or the link.';
    }

    if (hasAnyRelationshipAnchor(facts)) return applyStockQuestionGuard({ qualifier: next, currentMessage });

    next.stage = 'current_state';
    next.stage_label = 'Rapport + current state';
    next.stage_index = 1;

    if (next.is_question_moment && (!next.next_question || isDeepFunnelQuestion(next.next_question))) {
        const bridgeQuestion = chooseRapportQuestion(currentMessage, facts);
        if (bridgeQuestion) {
            next.next_question = bridgeQuestion;
            next.why_now = 'There is a real health or consistency bridge in their words. Ask one grounded question that helps them name what they need help with.';
        } else {
            next.next_question = '';
            next.is_question_moment = false;
            next.why_now = 'No clear health, fitness, or help signal yet. Keep the reply human and do not force a qualifier question.';
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
        next_question: '',
        why_now: "first captured reply in this thread, likely after Shannon's unseen story/post opener. Keep rapport first and wait for a real health, fitness, or help signal before pushing a question.",
        quote_evidence: null,
        is_question_moment: false,
        challenge_route: 'undecided',
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
    return {
        stage,
        stage_label: stageLabel,
        stage_index: stageIndex,
        facts,
        warmth_score: warmthScore,
        warmth_label: raw.warmth_label || warmthLabelFor(warmthScore),
        next_question: typeof raw.next_question === 'string' ? raw.next_question.trim() : '',
        why_now: typeof raw.why_now === 'string' ? raw.why_now.trim() : '',
        quote_evidence: typeof raw.quote_evidence === 'string' ? raw.quote_evidence.trim() : null,
        is_question_moment: !!raw.is_question_moment,
        challenge_route: ['vegan', 'generic', 'undecided'].includes(raw.challenge_route) ? raw.challenge_route : 'undecided',
        meaningful_lead_reply_count: Math.max(0, Math.round(Number(raw.meaningful_lead_reply_count) || 0)),
        evaluated_at: raw.evaluated_at || new Date().toISOString(),
    };
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
function inferHookContext({ history, customData }) {
    // Look for Shannon's first outbound — that's the "hello" that started this thread.
    if (Array.isArray(history)) {
        const firstOutbound = history.find(m => m.direction === 'out' && m.text);
        if (firstOutbound) {
            return truncate(String(firstOutbound.text).replace(/\s+/g, ' ').trim(), 220);
        }
    }
    // Cold inbound (no outbound history yet) — fall back to the ad/referrer label.
    if (customData && typeof customData === 'object') {
        const adName = customData.ad_name || customData.referrer || customData.last_growth_tool || customData.entry_point;
        if (adName) return `entered via ${String(adName).slice(0, 100)}`;
    }
    return null;
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

    const factsSummary = Object.entries(currentQualifier.facts)
        .map(([k, v]) => `  ${k}: ${v ? JSON.stringify(v) : '(unknown)'}`)
        .join('\n');

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
        : "(no prior tracked messages. This is probably the first captured lead reply after Shannon's native story/post opener, so there may be no visible context.)";

    const customDataText = customData && Object.keys(customData).length
        ? Object.entries(customData)
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
            .join('\n')
        : '(none)';

    return `You are scoring a lead's progress through a 4-stage qualifier funnel for Shannon, a personal coach who is currently offering the free 30-day Balance Challenge. It starts Monday, 8 June, is free for new starters, and has a $500 first-place cash prize. Interested leads can get into Balance and start with coaching immediately so they are set up before the challenge starts. Paid coaching is the follow-up after trust is built, not the headline offer in DMs.

IMPORTANT CONTEXT: Shannon initiates these conversations. He finds people by browsing stories, reels, and posts on Instagram/Facebook, then DMs them first (replying to their story, commenting on a post, or cold-messaging). The leads are NOT coming to him. Shannon is the one reaching out and starting the chat. The hook_context field records what Shannon said to open the conversation.

FIRST CAPTURED REPLY CONTEXT: if the conversation history is empty, do NOT assume the lead initiated or that this is the true first DM. Usually Shannon's native story/post opener was not captured by ManyChat. The lead may send a tiny or ambiguous reply because they are answering that unseen opener. Score the turn gently and prefer rapport-building over qualifier progress unless they clearly ask about coaching, what is included, plant-based stuff, a signup link, or they plainly ask Shannon for help because they feel stuck. Joking "send help", "starting from scratch", or "need a kickstart" language is a bridge signal, not an invite signal.

YOUR JOB: read the conversation, update the qualifier state, and decide whether THIS turn should keep chatting, gently bridge toward health/fitness, or move to the free challenge because they have admitted they need help.

CRITICAL TONE RULE: Shannon is chatting like a mate, NOT interviewing like a coach. A question is not required. If you do ask one, it must come from the lead's exact words and help them name what feels hard, what they want to change, or where they need support. The lead should never feel like they're being funnelled or assessed.

RAPPORT HAS A JOB: do not collect facts just to tick boxes. Build normal human back-and-forth, then use their own words to connect the chat toward health, fitness, energy, confidence, food, training, or consistency when it genuinely fits. If relationship_context is blank and their latest message has no health/fitness/food/energy/help signal, usually set is_question_moment=false and let Shannon keep chatting. But once they name a clear blocker, goal, low-energy pattern, consistency issue, or practical help need, stop pen-palling and move one step toward help: a tiny useful lens, a precise fit question, or an earned soft free-challenge bridge. Do not treat playful "send help" as an offer request by itself. Do not ask "what are your goals?" early. Do not bundle age/name/goal/blocker questions.

EARN THE NEXT RESPONSE: every suggested next move should give the lead a reason to reply. It must do at least one of these: answer their direct question, mirror the most specific hook, add one tiny useful lens, or ask one precise question about the real blocker/preference/objection they just raised. Generic validation plus a broad question is a failed turn.

NO DEAD-END STATEMENTS: unless the lead is clearly closing the thread, do not suggest a reply that only agrees, shares a personal aside, or says "hope it goes well". Even light rapport should leave one obvious handle: a specific question from their exact topic, a tiny useful lens, or a playful callback that invites a reply. Food banter, group classes, projects, and wellness skepticism should each move one notch deeper before changing topic.

PLATEAU / TRIED-EVERYTHING GATE: when a lead says they are stuck, plateaued, not progressing, or have already tried lots of fixes and nothing changed, this is a diagnostic coaching moment, not an offer moment. Prefer a specific question about the sticking point, technique, recovery, load/intensity, food, or what changed when they tried those fixes. Do not move to the free challenge purely because they are frustrated.

APP / WORKOUT SUPPORT GATE: if they mention the app glitching, logging problems, reconnecting to Balance, the app/helper, account access, needing a specific workout plan, full-body M/W/F plans, stale exercises, rep schemes, or simplifying tech, treat it as a support/programming request first. Do not convert that into a free challenge offer unless they explicitly ask to start, work with Shannon, or get the link.

LOCAL / IN-PERSON / EXISTING TRAINER GATE: if they say they want someone local, in-person, face-to-face, a PT, a personal trainer, or they already have a trainer/coach, treat that as a preference or compatibility objection. Do not invite or send the link yet. First answer plainly that the challenge support is online through Balance, then ask whether online check-ins/accountability would still be useful, or ask how it needs to fit around their current trainer.

CHALLENGE OFFER GATE: the free 30-day Balance Challenge is not the default reward for a warm reply. This gate is for qualifier-eligible leads only, never linked app users, in-app clients, paying clients, or support/check-in threads. There are two good moments to move it forward: (1) they make the human move first by asking what is included, asking for the link, saying they want to join/start/work with Shannon, or admitting they need help / feel lost / do not know what they are doing; or (2) the conversation has earned a soft bridge because Shannon already has a normal-life anchor plus enough health/fitness context, such as current state plus motivation or blocker, and there have usually been 3-6 meaningful lead replies. In an earned bridge, do not send a link or full brochure. Make the offer feel like one casual throwaway line discovered from their own words, not an app feature explanation. For example: "sounds like you're smashing training tbh, i'm about to start a fitness challenge if you'd be keen?" Do not hardcode that wording, but keep that size and feel. Save app setup, XP, leaderboard, prize, and check-in details for when they ask what is included or ask for the link. Words like "keen", "interested", "haha", "yeah sounds good", "send help", "starting from scratch", or "need a kickstart" are not enough by themselves when the tracked context is thin. If those same positive words come directly after Shannon offered the challenge or details, treat that as acceptance and move to the approved bio-link handoff. The approved link is https://future-balance.netlify.app/bio.html. Current tracked meaningful lead replies from this person: ${leadReplyCount}.

EARNED BRIDGE SHAPE: once the lead has shared enough real context, the bridge should be short and conversational, for example "if a bit of challenge structure would help when work gets messy, i'm starting one soon if you'd be keen". Never use a stock invite line or a mini app brochure.

STOCK QUESTION BAN: do not output generic routine questions like "what does a normal day look like for you at the moment?", "what does a normal day of eating look like for you?", "are you much of a cook or more of a takeaway person?", "you training at the moment?", "what's for lunch?", or "what are your goals?". They sound pasted from a script and are unsafe for auto-send. If there is no specific health, fitness, or help bridge in the lead's latest words, set is_question_moment=false.

RELATIONSHIP CHECKLIST: this is background memory for human context, not a form and not a question bank. Fill items when the lead volunteers them or Shannon naturally asks. Missing items should not force a question:
${relationshipChecklist}

CORE CONNECTION ANCHORS: "What they love" and "Stressors/frustrations" are useful relationship colour, not a hard gate. Shannon should eventually learn them, but only through natural openings. Do not force a standalone deep question just to tick one off. If the lead is chatting, bantering, or answering Shannon's last question, it is fine to set is_question_moment=false and just keep the conversation human.

NEVER use em-dashes in any output (Shannon hates them, they read AI). Use periods, colons, or commas instead.

THE 4-STAGE PLAYBOOK:
${playbook}

Plus terminal states: pitched (free challenge offer made) | won (accepted the free challenge or signed up) | lost (explicit no / cold for 30+ days) | paused (asked to wait).

CURRENT STATE FOR THIS LEAD (${leadName}, channel: ${channelLabel}):
  stage: ${currentQualifier.stage} (${currentQualifier.stage_label}, ${currentQualifier.stage_index}/4)
  warmth: ${currentQualifier.warmth_score}/100 (${currentQualifier.warmth_label})
  challenge_route: ${currentQualifier.challenge_route}
  meaningful lead replies: ${leadReplyCount}
  facts so far:
${factsSummary}

If the stored facts above are blank but the conversation history clearly contains answers, backfill them from the history. The saved state can be stale after webhook retries or model failures, but Shannon still needs continuity.

CURRENT TIME (Australia/Brisbane): ${promptNowText}. Use the exact timestamps, relative ages, and gaps to judge whether this is rapid banter, a delayed reply, or a stale thread.

CONVERSATION HISTORY (oldest → newest, with timestamps so you can judge pace):
${historyText}

THEIR JUST-ARRIVED MESSAGE (around ${promptNowText}):
${leadName}: ${String(currentMessage || '').slice(0, 800)}

DRAFT REPLY SHANNON IS ABOUT TO SEND (already generated by another model — you don't rewrite it, you just tell him whether THIS turn is the right moment to push a qualifier question, or just chat):
${draftText ? draftText : '(no draft generated)'}

ADDITIONAL CONTEXT (ManyChat custom data — referrer ad, etc):
${customDataText}

NOW DECIDE:

1. **facts**: extract facts the lead has revealed in the newest message and any missing facts that are obvious from the recent history. Keep existing facts unchanged unless the new message contradicts or refines them. hook_context records how Shannon started this conversation (he initiates by replying to their stories or cold-DMing them, not the other way around). relationship_context is a compact summary of their normal-life anchors. relationship_checklist stores the specific tick-off facts above: location, work_study, household_family, pets, daily_rhythm, food_setup, training_background, loves, stressors_frustrations. Include names of family members, partners, kids, dogs, or pets only when the lead says them. Capture what they love and what gets under their skin only when they say it or clearly confirm it. Leave fields as-is unless there's a clear update.

2. **stage**: which stage they're at NOW. The stage advances when its corresponding fact gets a meaningful answer, but do not rush beyond current_state while relationship_context is blank unless they clearly asked to start or already volunteered strong goal context. If the lead jumped ahead and answered a later stage's question, capture that fact and move stage to the next still-unanswered one. If Shannon has a relationship anchor, at least two useful core facts (current_state, motivation, history_blockers, commitment), and at least 3 meaningful lead replies, the next move can be a soft invite bridge instead of another getting-to-know-you question. If all 4 facts are filled, the next move is usually to offer the free challenge, not to write a standalone meal plan or workout program in DMs. Missing loves or stressors_frustrations should not block the next step if the person is otherwise warm or asking to move forward. Use "pitched" once Shannon has offered the free challenge. If they explicitly accept that offer ("im in", "save me a spot", "lets do it", "keen") or reply positively right after the pitch ("yes pls", "yeah sounds good", "sounds so good"), advance to "won". If they explicitly decline or have been silent 30+ days, "lost".

3. **warmth_score** (0-100):
   - 0-25 cold: short replies, slow, dodging
   - 26-50 lukewarm: replying but minimal engagement, one-liners, late
   - 51-75 warm: full sentences, asking back, sharing context, prompt
   - 76-100 hot: enthusiasm, "yes please", urgency, asking how to start
   Adjust based on the LATEST message + recent reply latency. Don't ratchet down for one slow reply if the prior thread was warm.

4. **challenge_route**: 'vegan' if they mention plant-based / vegan / vegetarian / dietary curiosity. 'generic' if they want fitness / weight / energy with no diet preference. 'undecided' if not enough signal.

5. **next_question**: only provide a question when this turn naturally supports one. One sentence max, Australian casual, normal phone autocorrect casing, no greetings, no em-dashes. An earned free-challenge offer should be a casual throwaway invite plus a permission question, not an app explainer. The question should either keep a real thread-specific hook alive, bridge their own words toward health/fitness, help them self-identify what they need help with, or softly invite them into the free challenge once enough lead-only context has been earned. Do not ask routine survey questions. Do not ask a question just because the checklist is thin. First/early replies to Shannon's story opener are the strong exception: default to is_question_moment=true about 99% of the time. Only skip the question when they only said thanks/emoji/filler, it is a genuinely short no-response-needed reply, the topic is a current safety/medical/rehab advice situation, or the thread is clearly closing. Old injury, surgery, rehab, hospital, or pain history from an unlinked lead is not sensitive by itself. Treat it as normal rapport if Shannon can reply without advice, diagnosis, a training/rehab prescription, or a challenge pitch off their vulnerability. A Shannon personal aside alone is not enough there; ask one tiny relevant follow-up about their hook, like how they use the app/tool/routine, where the place is, what the food was, or how the session went. No health/fitness/help bridge is required for this first story-reply question. If Shannon asked whether they were okay after a sad animal/pet story and they answer that they are okay but the animals are not, do not ask what happened to the animals. If a question is useful, bridge through vegan/animal-values context instead, such as how long they have been vegan/plant-based or what got them into it; later, bridge to how they go with fitness before offering the free challenge. If the latest message is banter with enough relationship context, a direct answer to Shannon's last question, or there is no clear health/fitness/help bridge, set is_question_moment=false and next_question="". If the latest message is an in-person/local/PT/current-trainer preference, make the next question about that preference first, not the challenge link. If at least 3 meaningful lead replies plus real context have been earned, prefer a contextual throwaway invite like "Sounds like you're smashing training tbh, I'm about to start a fitness challenge if you'd be keen?" over asking another personal-history question. Vary this wording to match the lead's exact situation and do not hardcode that example. If stage is "pitched" and they have not accepted yet, only ask a tiny next-step question if needed, like "Want me to send you the link?" If stage is "won", set is_question_moment=false and make next_question the approved bio-link handoff, not another intake question. Do not mark "pitched" just because they are friendly or vaguely interested; wait for a real help/start/challenge signal or an earned soft bridge.

6. **why_now**: 1-2 sentences explaining the timing, citing a specific phrase from THE LEAD'S WORDS. Format: "She wrote 'X', which signals Y. Now's the moment because Z." Be concrete. If is_question_moment is false, why_now explains why we're holding off ("she just vented about her boss, validate first").

7. **quote_evidence**: the exact phrase from the lead's words your reasoning hinges on. Null if there isn't one (e.g. on a first reply with no signal yet).

8. **is_question_moment**: true if this turn is the right moment to push the next stage's question. false if Shannon should just chat / validate / acknowledge without pushing the funnel forward this turn.

Keep the whole JSON compact. Use null for unknown facts. Each fact string should be under 12 words. next_question should be one short sentence. why_now should be under 18 words. Do not repeat the schema or explain anything outside JSON.

OUTPUT JSON ONLY — no commentary, no code fences:
{
  "stage": "...",
  "facts": { "hook_context": "...", "relationship_context": "...", "relationship_checklist": { "location": "...", "work_study": "...", "household_family": "...", "pets": "...", "daily_rhythm": "...", "food_setup": "...", "training_background": "...", "loves": "...", "stressors_frustrations": "..." }, "current_state": "...", "motivation": "...", "history_blockers": "...", "commitment": "..." },
  "warmth_score": 0,
  "challenge_route": "...",
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
    const generationConfig = { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'application/json' };
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

    let next = normalizeQualifier({
        stage: parsed.stage || prior.stage,
        facts: mergedFacts,
        warmth_score: parsed.warmth_score ?? prior.warmth_score,
        warmth_label: warmthLabelFor(parsed.warmth_score ?? prior.warmth_score),
        next_question: parsed.next_question || prior.next_question,
        why_now: parsed.why_now || prior.why_now,
        quote_evidence: parsed.quote_evidence ?? prior.quote_evidence,
        is_question_moment: parsed.is_question_moment !== undefined ? !!parsed.is_question_moment : prior.is_question_moment,
        challenge_route: parsed.challenge_route || prior.challenge_route,
        meaningful_lead_reply_count: meaningfulLeadReplyCount,
        evaluated_at: new Date().toISOString(),
    });
    next.meaningful_lead_reply_count = meaningfulLeadReplyCount;
    next = applyRapportGate({ qualifier: next, currentMessage, leadReplyCount: meaningfulLeadReplyCount });

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
 *   "Sarah · S2/4 warm · ASK"     — when this turn is a question moment
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
        return `${leadName} · ${stagePart} · ASK`;
    }
    return `${leadName} · ${stagePart}`;
}

/**
 * Body line composed for the push notification. The draft itself now
 * includes the qualifier question as a trailing chunk when it's a
 * question moment, so the body is always just the draft preview.
 * The push title already carries "· ASK" from formatPushTitle.
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
    return {
        qualifierStage: qualifier.stage || '',
        qualifierStageLabel: qualifier.stage_label || '',
        qualifierStageIndex: String(qualifier.stage_index || ''),
        qualifierWarmth: String(qualifier.warmth_score || ''),
        qualifierWarmthLabel: qualifier.warmth_label || '',
        qualifierNextQuestion: qualifier.next_question || '',
        qualifierWhyNow: qualifier.why_now || '',
        qualifierIsQuestionMoment: qualifier.is_question_moment ? '1' : '0',
        qualifierChallengeRoute: qualifier.challenge_route || '',
    };
}

function _hasPromptFact(value) {
    return cleanFactValue(value) != null;
}

function buildQualifierRelationshipBlock(qualifier) {
    if (!qualifier || typeof qualifier !== 'object') return '';
    const facts = qualifier.facts || {};
    const checklist = normalizeRelationshipChecklist(facts);
    const lines = [];
    const stageLabel = qualifier.stage_label || (qualifier.stage || '').replace(/_/g, ' ');
    const stageIndex = qualifier.stage_index ? `S${qualifier.stage_index}/4` : '';
    const warmth = (qualifier.warmth_label || qualifier.warmth_score)
        ? `Warmth: ${qualifier.warmth_score || '?'}${qualifier.warmth_label ? ` (${qualifier.warmth_label})` : ''}`
        : '';
    if (stageLabel || warmth) {
        lines.push(['Qualifier', stageIndex, stageLabel, warmth].filter(Boolean).join(' | '));
    }
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
    if (qualifier.next_question && qualifier.is_question_moment) {
        lines.push(`Suggested relationship question: ${qualifier.next_question}`);
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
    inferHookContext,
    cleanFactValue,
    evaluateQualifier,
    persistQualifier,
    applyRapportGate,
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
    warmthLabelFor,
    stageMetaFor,
};
