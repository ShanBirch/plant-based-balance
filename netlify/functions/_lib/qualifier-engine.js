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
 * The 4-stage playbook (challenge-agnostic — handles plant-based AND generic):
 *
 *   1. Current state     — food + movement + energy now
 *   2. Motivation        — the deeper outcome
 *   3. History + blockers — what they've tried, what stopped them
 *   4. Commitment        — ready to start, save them a spot
 *
 * Plus auto-captured `hook_context` (how Shannon opened the conversation —
 * his first DM to them or the ad's referrer field) and terminal states `pitched`,
 * `won`, `lost`, `paused`. `pitched` means Shannon offered the free challenge.
 * `won` means they accepted the free challenge or signed up.
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
        what_to_learn: 'first learn a light human anchor (location, work/life rhythm, kids/family, household), then food + movement + energy when it feels natural',
        example_questions: [
            "whereabouts are you based?",
            "you got kids or is it just you at home?",
            "what does a normal day look like for you at the moment?",
            "what's for lunch today?",
            "you training at the moment or nah?",
            "you much of a cook or more of a takeaway person?",
            "what does a normal day of eating look like for you?",
        ],
    },
    {
        key: 'motivation',
        index: 2,
        label: 'Motivation',
        what_to_learn: 'the deeper outcome they actually want (feel sexy, keep up with kids, stop feeling tired) — not the surface "lose weight"',
        example_questions: [
            "what kicked this off for you, like what made you think about it now?",
            "if you nailed it what would actually change for you day to day?",
            "what's the dream scenario if everything clicks?",
        ],
    },
    {
        key: 'history_blockers',
        index: 3,
        label: 'History + blockers',
        what_to_learn: "what they've tried before and what got in the way — pre-empts the objection",
        example_questions: [
            "you tried anything like this before or is this brand new territory?",
            "what usually gets in the way when you try to lock something in?",
            "have you done a challenge or program before? how'd it go?",
        ],
    },
    {
        key: 'commitment',
        index: 4,
        label: 'Commitment',
        what_to_learn: 'ready-to-start signal for the free 30-day challenge + what would make 30 days actually stick',
        example_questions: [
            "i'm starting a free 30-day challenge monday, reckon that would help you lock it in?",
            "if i got you set up in the challenge, could you give it 30 days?",
            "keen to jump into the free challenge or still sussing it out?",
        ],
    },
];

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

function hasStartIntent(text) {
    const s = String(text || '').toLowerCase();
    return /\b(i'?m in|im in|keen|yes please|save me|sign me up|how do i start|how to start|send.*link|join|start monday|let'?s do it|lets do it)\b/i.test(s);
}

function isDeepFunnelQuestion(question) {
    const q = String(question || '').toLowerCase();
    if (!q) return false;
    return /\b(goal|goals|dream scenario|kicked this off|what would change|tried|before|gets? in the way|blocker|challenge|30 days|start|lock it in|program|app|lose weight|muscle|energy)\b/i.test(q);
}

function chooseRapportQuestion(currentMessage) {
    const msg = String(currentMessage || '').toLowerCase();
    if (/\b(kid|kids|child|children|mum|mom|dad|family|partner|husband|wife)\b/i.test(msg)) {
        return 'what does a normal day look like for you at the moment?';
    }
    if (/\b(work|job|shift|busy|school|study|uni|business)\b/i.test(msg)) {
        return 'what does a normal day look like for you at the moment?';
    }
    if (/\b(cook|cooking|food|lunch|dinner|takeaway|vegan|plant|vegetarian|meal)\b/i.test(msg)) {
        return 'are you much of a cook or more of a takeaway person?';
    }
    if (/\b(gym|train|training|workout|run|walking|sport)\b/i.test(msg)) {
        return 'you training at the moment or just easing back into it?';
    }
    return 'whereabouts are you based?';
}

function applyRapportGate({ qualifier, currentMessage }) {
    if (!qualifier || TERMINAL_STAGES.has(qualifier.stage) || hasStartIntent(currentMessage)) {
        return qualifier;
    }

    const facts = qualifier.facts || {};
    if (hasUsefulFact(facts.relationship_context)) {
        return qualifier;
    }

    const next = {
        ...qualifier,
        stage: 'current_state',
        stage_label: 'Rapport + current state',
        stage_index: 1,
    };

    if (next.is_question_moment && (!next.next_question || isDeepFunnelQuestion(next.next_question))) {
        next.next_question = chooseRapportQuestion(currentMessage);
        next.why_now = 'No normal-life anchor yet. Ask a light context question before digging into goals or blockers.';
        next.quote_evidence = next.quote_evidence || null;
    }

    return next;
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
            current_state: null,
            motivation: null,
            history_blockers: null,
            commitment: null,
        },
        warmth_score: 30,
        warmth_label: 'lukewarm',
        next_question: STAGES[0].example_questions[0],
        why_now: 'first reply in this thread - start with a light human-context question before coaching discovery.',
        quote_evidence: null,
        is_question_moment: true,
        challenge_route: 'undecided',
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

function buildEvaluationPrompt({ leadName, channel, currentQualifier, history, currentMessage, draftText, customData }) {
    const channelLabel = channel === 'messenger' ? 'Facebook Messenger' : 'Instagram';
    const promptNow = new Date();
    const promptNowText = formatCoachLocalTimestamp(promptNow);
    const playbook = STAGES.map(s =>
        `  ${s.index}. ${s.label} (${s.key}) — ${s.what_to_learn}\n     casual ways to learn this: ${s.example_questions.map(q => `"${q}"`).join(' / ')}`
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
        : '(no prior messages — this is the first DM)';

    const customDataText = customData && Object.keys(customData).length
        ? Object.entries(customData)
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
            .join('\n')
        : '(none)';

    return `You are scoring a lead's progress through a 4-stage qualifier funnel for Shannon, a personal coach who runs a 30-day plant-based wellness challenge AND a generic 30-day fitness challenge for non-vegan leads.

IMPORTANT CONTEXT: Shannon initiates these conversations. He finds people by browsing stories, reels, and posts on Instagram/Facebook, then DMs them first (replying to their story, commenting on a post, or cold-messaging). The leads are NOT coming to him. Shannon is the one reaching out and starting the chat. The hook_context field records what Shannon said to open the conversation.

YOUR JOB: read the conversation, update the qualifier state, and suggest what Shannon could casually ask NEXT to learn about this person, with a quote-grounded reason.

CRITICAL TONE RULE: Shannon is chatting like a mate, NOT interviewing like a coach. The questions must feel like natural curiosity in a conversation, never like intake questions. Instead of "what's your diet like?" ask "what's for lunch today?" Instead of "what are your goals?" ask "what kicked this off for you?" The lead should never feel like they're being funnelled or assessed. Every question should feel like something a friend would genuinely ask.

RAPPORT COMES FIRST: before pushing goals, blockers, or commitment, learn at least one normal-life anchor when the conversation allows it. Good anchors: where they are based, kids/family, work/study, household, daily rhythm, cooking situation, sport/training background, or what made them reply to Shannon. If relationship_context is blank and they have not clearly asked to join/start, your next question should usually be a light human-context question, not a health/fitness question. Do not ask "what are your goals?" early. Do not bundle age/name/goal/blocker questions.

NEVER use em-dashes in any output (Shannon hates them, they read AI). Use periods, colons, or commas instead.

THE 4-STAGE PLAYBOOK:
${playbook}

Plus terminal states: pitched (free challenge offer made) | won (accepted the free challenge or signed up) | lost (explicit no / cold for 30+ days) | paused (asked to wait).

CURRENT STATE FOR THIS LEAD (${leadName}, channel: ${channelLabel}):
  stage: ${currentQualifier.stage} (${currentQualifier.stage_label}, ${currentQualifier.stage_index}/4)
  warmth: ${currentQualifier.warmth_score}/100 (${currentQualifier.warmth_label})
  challenge_route: ${currentQualifier.challenge_route}
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

1. **facts**: extract facts the lead has revealed in the newest message and any missing facts that are obvious from the recent history. Keep existing facts unchanged unless the new message contradicts or refines them. hook_context records how Shannon started this conversation (he initiates by replying to their stories or cold-DMing them, not the other way around). relationship_context records normal-life anchors: location, kids/family, work/study, household, routine, cooking situation, sport/training background, why they replied. Leave either field as-is unless there's a clear update.

2. **stage**: which stage they're at NOW. The stage advances when its corresponding fact gets a meaningful answer, but do not rush beyond current_state while relationship_context is blank unless they clearly asked to start or already volunteered strong goal context. If the lead jumped ahead and answered a later stage's question, capture that fact and move stage to the next still-unanswered one. If all 4 facts are filled, the next move is usually to offer the free challenge, not to write a standalone meal plan or workout program in DMs. Use "pitched" once Shannon has offered the free 30-day challenge. If they explicitly accept that offer ("im in", "save me a spot", "lets do it", "keen"), advance to "won". If they explicitly decline or have been silent 30+ days, "lost".

3. **warmth_score** (0-100):
   - 0-25 cold: short replies, slow, dodging
   - 26-50 lukewarm: replying but minimal engagement, one-liners, late
   - 51-75 warm: full sentences, asking back, sharing context, prompt
   - 76-100 hot: enthusiasm, "yes please", urgency, asking how to start
   Adjust based on the LATEST message + recent reply latency. Don't ratchet down for one slow reply if the prior thread was warm.

4. **challenge_route**: 'vegan' if they mention plant-based / vegan / vegetarian / dietary curiosity. 'generic' if they want fitness / weight / energy with no diet preference. 'undecided' if not enough signal.

5. **next_question**: a casual, conversational question that lets Shannon learn the next useful thing WITHOUT sounding like an intake form (Australian casual, lowercase friendly, no greetings, no em-dashes). One sentence max. Think about what a curious friend would ask in this exact moment of the conversation. If relationship_context is blank, prefer a social-context question like "whereabouts are you based?", "you got kids or is it just you at home?", "what does a normal day look like for you at the moment?", or a better version based on their message. If they mentioned food, ask about a specific meal. If they mentioned training, ask what they're doing this week. The question should feel like it belongs in THIS conversation, not pasted from a script. If Shannon already asked a question and the lead answered or is riffing on it, DO NOT ask the same question again. Capture what was learned, then either ask a natural deeper follow-up, move to the next unanswered stage, or set is_question_moment=false. If they just answered a stage, the next_question targets the NEXT stage only after rapport is strong enough. If the conversation has moved past intake (they're chatting about something else, or just venting), set is_question_moment=false and let next_question be a soft re-engage like "how's your week been?" If stage is "pitched", only ask a tiny next-step question if needed, like "want me to send you the link?" If stage is "won", set is_question_moment=false and make next_question the signup/link handoff, not another intake question.

6. **why_now**: 1-2 sentences explaining the timing, citing a specific phrase from THE LEAD'S WORDS. Format: "She wrote 'X', which signals Y. Now's the moment because Z." Be concrete. If is_question_moment is false, why_now explains why we're holding off ("she just vented about her boss, validate first").

7. **quote_evidence**: the exact phrase from the lead's words your reasoning hinges on. Null if there isn't one (e.g. on a first reply with no signal yet).

8. **is_question_moment**: true if this turn is the right moment to push the next stage's question. false if Shannon should just chat / validate / acknowledge without pushing the funnel forward this turn.

OUTPUT JSON ONLY — no commentary, no code fences:
{
  "stage": "...",
  "facts": { "hook_context": "...", "relationship_context": "...", "current_state": "...", "motivation": "...", "history_blockers": "...", "commitment": "..." },
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
    const mergedFacts = {
        hook_context: cleanFactValue(parsed.facts?.hook_context) ?? prior.facts.hook_context,
        relationship_context: cleanFactValue(parsed.facts?.relationship_context) ?? prior.facts.relationship_context,
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
        evaluated_at: new Date().toISOString(),
    });
    next = applyRapportGate({ qualifier: next, currentMessage });

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

module.exports = {
    STAGES,
    TERMINAL_STAGES,
    isQualifierEligible,
    freshQualifier,
    normalizeQualifier,
    inferHookContext,
    cleanFactValue,
    evaluateQualifier,
    persistQualifier,
    formatPushTitle,
    formatPushBody,
    summarizeForFcmData,
    warmthLabelFor,
    stageMetaFor,
};
