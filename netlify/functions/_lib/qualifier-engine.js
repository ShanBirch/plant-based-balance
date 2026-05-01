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
 * Plus auto-captured `hook_context` (what got them on Shannon's radar — from
 * his opening DM or the ad's referrer field) and terminal states `pitched`,
 * `won`, `lost`, `paused`.
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
    truncate,
} = require('./client-context');

// ============================================================
// Playbook
// ============================================================

const STAGES = [
    {
        key: 'current_state',
        index: 1,
        label: 'Current state',
        what_to_learn: 'food + movement + energy now (routes plant-based vs generic challenge)',
        example_question: "what's eating like for you at the moment, mostly home cooked or eating out?",
    },
    {
        key: 'motivation',
        index: 2,
        label: 'Motivation',
        what_to_learn: 'the deeper outcome they actually want (feel sexy, keep up with kids, stop feeling tired) — not the surface "lose weight"',
        example_question: "what would changing this actually do for you, like the bigger picture?",
    },
    {
        key: 'history_blockers',
        index: 3,
        label: 'History + blockers',
        what_to_learn: "what they've tried before and what got in the way — pre-empts the objection",
        example_question: "have you tried to lock something like this in before? what tripped you up?",
    },
    {
        key: 'commitment',
        index: 4,
        label: 'Commitment',
        what_to_learn: 'ready-to-start signal + what would make 30 days actually stick',
        example_question: "if you were gonna do something for the next 30 days what would make it actually work this time?",
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
        stage_label: 'Current state',
        stage_index: 1,
        facts: {
            hook_context: hookContext,
            current_state: null,
            motivation: null,
            history_blockers: null,
            commitment: null,
        },
        warmth_score: 30,
        warmth_label: 'lukewarm',
        next_question: STAGES[0].example_question,
        why_now: 'first reply in this thread — kick off with the lightest stage 1 question.',
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
        hook_context: raw.facts?.hook_context ?? null,
        current_state: raw.facts?.current_state ?? null,
        motivation: raw.facts?.motivation ?? null,
        history_blockers: raw.facts?.history_blockers ?? null,
        commitment: raw.facts?.commitment ?? null,
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
 * Shannon's most recent OUTBOUND message in the IG/FB thread (he typically
 * opens with "saw your story about X, …") OR from the ManyChat custom_data
 * referrer field (ad name when the lead came in cold).
 *
 * Returns a string snippet ("commented on her morning run story") or null.
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
    const playbook = STAGES.map(s =>
        `  ${s.index}. ${s.label} (${s.key}) — ${s.what_to_learn}\n     example phrasing: "${s.example_question}"`
    ).join('\n');

    const factsSummary = Object.entries(currentQualifier.facts)
        .map(([k, v]) => `  ${k}: ${v ? JSON.stringify(v) : '(unknown)'}`)
        .join('\n');

    const historyText = (history && history.length > 0)
        ? history.map(m => {
            const speaker = m.direction === 'in' ? leadName : 'Shannon';
            const ts = m.created_at ? ` [${m.created_at}]` : '';
            return `${speaker}${ts}: ${String(m.text || '').slice(0, 400)}`;
        }).join('\n')
        : '(no prior messages — this is the first DM)';

    const customDataText = customData && Object.keys(customData).length
        ? Object.entries(customData)
            .filter(([, v]) => v != null && v !== '')
            .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
            .join('\n')
        : '(none)';

    return `You are scoring a lead's progress through a 4-stage qualifier funnel for Shannon, a personal coach who runs a 30-day plant-based wellness challenge AND a generic 30-day fitness challenge for non-vegan leads.

YOUR JOB: read the conversation, update the qualifier state, and tell Shannon what question to ask NEXT — with a quote-grounded reason.

NEVER use em-dashes in any output (Shannon hates them, they read AI). Use periods, colons, or commas instead.

THE 4-STAGE PLAYBOOK:
${playbook}

Plus terminal states: pitched (challenge offer made) | won (signed up) | lost (explicit no / cold for 30+ days) | paused (asked to wait).

CURRENT STATE FOR THIS LEAD (${leadName}, channel: ${channelLabel}):
  stage: ${currentQualifier.stage} (${currentQualifier.stage_label}, ${currentQualifier.stage_index}/4)
  warmth: ${currentQualifier.warmth_score}/100 (${currentQualifier.warmth_label})
  challenge_route: ${currentQualifier.challenge_route}
  facts so far:
${factsSummary}

CONVERSATION HISTORY (oldest → newest, with timestamps so you can judge pace):
${historyText}

THEIR JUST-ARRIVED MESSAGE:
${leadName}: ${String(currentMessage || '').slice(0, 800)}

DRAFT REPLY SHANNON IS ABOUT TO SEND (already generated by another model — you don't rewrite it, you just tell him whether THIS turn is the right moment to push a qualifier question, or just chat):
${draftText ? draftText : '(no draft generated)'}

ADDITIONAL CONTEXT (ManyChat custom data — referrer ad, etc):
${customDataText}

NOW DECIDE:

1. **facts**: extract any new facts the lead just revealed. Update only the fields the new message actually touches. Keep existing facts unchanged unless the new message contradicts or refines them. hook_context can stay as-is unless the lead explicitly says what brought them in.

2. **stage**: which stage they're at NOW. The stage advances when its corresponding fact gets a meaningful answer. If the lead jumped ahead and answered a later stage's question, capture that fact and move stage to the next still-unanswered one. If all 4 facts are filled, advance to "pitched". If they explicitly accept ("im in", "save me a spot", "lets do it"), advance to "won". If they explicitly decline or have been silent 30+ days, "lost".

3. **warmth_score** (0-100):
   - 0-25 cold: short replies, slow, dodging
   - 26-50 lukewarm: replying but minimal engagement, one-liners, late
   - 51-75 warm: full sentences, asking back, sharing context, prompt
   - 76-100 hot: enthusiasm, "yes please", urgency, asking how to start
   Adjust based on the LATEST message + recent reply latency. Don't ratchet down for one slow reply if the prior thread was warm.

4. **challenge_route**: 'vegan' if they mention plant-based / vegan / vegetarian / dietary curiosity. 'generic' if they want fitness / weight / energy with no diet preference. 'undecided' if not enough signal.

5. **next_question**: the actual question Shannon could ask in his NEXT reply (Australian casual, lowercase friendly, no greetings, no em-dashes). One sentence. Pulled from the playbook stage's example phrasing but re-worded to fit what the lead just said. If they just answered a stage, the next_question targets the NEXT stage. If the conversation has moved past intake (they're chatting about something else, or just venting), set is_question_moment=false and let next_question be a soft re-engage like "how's your week been?"

6. **why_now**: 1-2 sentences explaining the timing, citing a specific phrase from THE LEAD'S WORDS. Format: "She wrote 'X', which signals Y. Now's the moment because Z." Be concrete. If is_question_moment is false, why_now explains why we're holding off ("she just vented about her boss, validate first").

7. **quote_evidence**: the exact phrase from the lead's words your reasoning hinges on. Null if there isn't one (e.g. on a first reply with no signal yet).

8. **is_question_moment**: true if this turn is the right moment to push the next stage's question. false if Shannon should just chat / validate / acknowledge without pushing the funnel forward this turn.

OUTPUT JSON ONLY — no commentary, no code fences:
{
  "stage": "...",
  "facts": { "hook_context": "...", "current_state": "...", "motivation": "...", "history_blockers": "...", "commitment": "..." },
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
    try {
        const contents = [{ role: 'user', parts: [{ text: prompt }] }];
        // Lower temperature than the draft model — we want consistent
        // structured output, not creative voice.
        raw = await callGeminiFallback(contents, { temperature: 0.3, maxOutputTokens: 1024 });
    } catch (err) {
        console.warn('[qualifier-engine] Gemini evaluation failed:', err.message);
        return { qualifier: prior, evaluated: false, error: err.message };
    }

    const parsed = parseEvaluationOutput(raw);
    if (!parsed) {
        console.warn('[qualifier-engine] failed to parse JSON from output:', raw.slice(0, 200));
        return { qualifier: prior, evaluated: false, error: 'parse_failed' };
    }

    // Merge: keep prior facts unless the model returned a non-null value.
    const mergedFacts = {
        hook_context: parsed.facts?.hook_context ?? prior.facts.hook_context,
        current_state: parsed.facts?.current_state ?? prior.facts.current_state,
        motivation: parsed.facts?.motivation ?? prior.facts.motivation,
        history_blockers: parsed.facts?.history_blockers ?? prior.facts.history_blockers,
        commitment: parsed.facts?.commitment ?? prior.facts.commitment,
    };

    const next = normalizeQualifier({
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

    return { qualifier: next, evaluated: true, error: null };
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
    evaluateQualifier,
    persistQualifier,
    formatPushTitle,
    formatPushBody,
    summarizeForFcmData,
    warmthLabelFor,
    stageMetaFor,
};
