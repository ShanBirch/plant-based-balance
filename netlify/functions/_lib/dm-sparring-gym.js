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

function detectCoachTurnIssues({ coachText, leadText, qualifier, leadStage = 'qualifying' } = {}) {
    const text = String(coachText || '').trim();
    const issues = [];
    if (!text) {
        issues.push('empty_coach_reply');
        return issues;
    }
    if (isChallengeOfferWarningText(text) && !hasChallengeInviteReadinessSignal(leadText)) {
        issues.push('possible_premature_challenge_invite');
    }
    if (isPrematureChallengeInvite({
        draftText: text,
        currentMessage: leadText,
        qualifier,
        leadStage,
        linkedUserId: null,
    })) {
        issues.push('premature_challenge_invite');
    }
    const questionSentences = text
        .split(/(?<=[?.!])\s+/)
        .map(s => s.trim())
        .filter(hasQuestion);
    if (questionSentences.length > 1) {
        issues.push('too_many_questions');
    }
    if (questionSentences.some(isUnsafeStockDiscoveryQuestion)) {
        issues.push('stock_discovery_question');
    }
    if (/\bwhat are your goals\b/i.test(text)) {
        issues.push('generic_goal_question');
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
            maxOutputTokens: 2400,
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
    const raw = await callGeminiFallback(
        [{ role: 'user', parts: [{ text: prompt }] }],
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
            maxOutputTokens: 2200,
        });
        modelCalls.push({ role: 'scenario_writer', model: 'gemini' });
        const drafted = mergeScenarioPersona(persona, writer.parsed);
        const checker = await callJsonModel({
            prompt: buildScenarioCheckerPrompt(drafted),
            label: 'scenario-checker',
            temperature: 0.35,
            maxOutputTokens: 2400,
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
    const explorationNudge = coachTurns.length >= 2 && recentCoachQuestionCount === 0
        ? `
PROGRESSION NUDGE:
The last couple of Shannon turns did not ask a question. Do not stay in a validation-only loop. Add one specific, low-pressure bridge question if it fits the latest message. It should come from their exact topic, not a generic intake question.
- Competitive/self-sufficient lead: ask what they think will make the next target hard, what they are changing to get there, or what they are chasing next.
- Sport/social hobby lead: ask what they are trying to improve, what keeps them playing, or what makes it feel good for them.
- Overwhelmed/no-capacity lead: ask about the tiniest version that would feel doable, whether removing decision-making would help, or what would make it feel low-pressure.
Skip the question only if they asked Shannon a direct personal question that needs a straight answer first.`
        : '';
    const softBridgeNudge = hasSoftBridgeSignal
        ? `
SOFT BRIDGE SIGNAL:
Their latest message contains a possible life/energy/training/food/work hook. Before replying, decide if there is one natural question that keeps that hook alive. Keep it casual. Do not force a challenge mention.`
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
${softBridgeNudge}

ACQUISITION RULES:
- Human first, coach second.
- Keep the challenge invite invisible until the lead gives a real start/help signal.
- Real invite signals: "i need help", "i dunno what i'm doing", "where do i start", "what's included", "send the link", "i'm in", or a clear join/start request.
- Friendly replies, "keen", "haha", "sounds good", food banter, or vague interest are not enough by themselves.
- Ask at most one question. If no question is needed, do not ask one.
- Avoid stock lines like "what does a normal day look like", "are you much of a cook", "what are your goals", or "you training at the moment".
- If you do invite them, make it feel like the obvious next step for their words, not a pitch.
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
        maxOutputTokens: 1600,
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
        maxOutputTokens: 1600,
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
- likely_reply: would this person reply?
- likely_join: would this person join the challenge eventually?

Use risk_flags only for actual problems, not ordinary strategic caveats. If a conversation is going well but needs more time, use [].
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
            ? 'Hold the challenge invite until the lead gives a clear help/start signal.'
            : 'Use the strongest detail from the lead before asking the next question.',
    });
}

async function scoreTranscript({ persona, history, turnIssues, offline = false }) {
    if (offline) return heuristicScore({ history, turnIssues });
    try {
        const prompt = buildJudgePrompt({ persona, history, turnIssues });
        const { parsed } = await callJsonModel({
            prompt,
            label: 'sparring-judge',
            temperature: 0.2,
            maxOutputTokens: 1800,
        });
        return normalizeScorecard(parsed);
    } catch (err) {
        const score = heuristicScore({ history, turnIssues });
        score.risk_flags = [...new Set([...score.risk_flags, `judge_failed:${err.message}`])];
        return score;
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
        });
        if (issues.length) turnIssues.push({ turn: turn + 1, issues, coachText, leadText: leadTurn.message });

        if (leadTurn.state === 'won' || leadTurn.state === 'lost') {
            break;
        }
    }

    const scorecard = await scoreTranscript({ persona: activePersona, history, turnIssues, offline });
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
        turn_issues: turnIssues,
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
