/**
 * Shared client-context utilities for coach draft functions.
 *
 * Consumed by:
 *   - netlify/functions/instant-coach-draft.js     (client → admin DM)
 *   - netlify/functions/pb-celebration-draft.js    (client hits a PB)
 *   - netlify/functions/onboarding-welcome-draft.js (day 0 welcome)
 *   - netlify/functions/onboarding-scheduled-scan.js (days 3/7/14/30)
 *
 * Provides:
 *   - supabaseQuery: thin PostgREST wrapper
 *   - loadClientMemory / buildMemoryBlock: relationship memory for prompts
 *   - loadEditExamples: learn-from-edits corpus for the prompt
 *   - callVertexAIModel: fine-tuned Shannon voice (v7)
 *   - callGeminiFallback: low-cost Gemma/Gemini fallback chain for graceful degradation
 *   - stripLeadingGreeting: kills "hey Hannah," style openings (no greets)
 */

const { callGeminiModelChain } = require('./ai-router');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fine-tuned Shannon voice model on Vertex AI (v7 — trained on 402 curated client conversations)
const VERTEX_PROJECT_ID = '103426154831';
const VERTEX_ENDPOINT_ID = '3547200982821634048';
const VERTEX_LOCATION = 'us-central1';

let _vertexAccessTokenCache = { token: null, expiresAt: 0 };

// ============================================================
// Supabase REST
// ============================================================

async function supabaseQuery(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured');
    }
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
        const text = await response.text();
        const err = new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
        err.status = response.status;
        err.body = text;
        // PostgREST surfaces sqlstate inside the body JSON. Lift it onto the
        // error so callers can branch on 23505 (unique violation) without
        // string-matching the message.
        try {
            const parsed = JSON.parse(text);
            if (parsed && parsed.code) err.sqlstate = parsed.code;
        } catch { /* body wasn't JSON — leave sqlstate undefined */ }
        throw err;
    }
    const text = await response.text();
    if (!text || text.trim() === '') return [];
    try { return JSON.parse(text); } catch { return []; }
}

// ============================================================
// Idempotent coach_alerts insert
// ------------------------------------------------------------
// All proactive-alert producers (first-workout, onboarding, badge_earned,
// pb-celebration, instant-coach-draft, pulses, weekly digest/check-in,
// plateau) fan out to identical (coach, client, event) triples on retry —
// trigger fan-out for per-row INSERTs, scheduler overlap, pg_net retries,
// frontend double-fires. Without DB-level dedup the producer's
// SELECT-then-INSERT race produced visible duplicate notifications
// (Shannon got 5 first-workout pushes for one client on 2026-04-27).
//
// `idempotency_key` + the partial UNIQUE index added in
// coach_alerts_idempotency_migration.sql closes the race: every producer
// sets a deterministic key, the second/third/Nth INSERT fails with
// sqlstate 23505, and this helper translates that into a `deduped: true`
// response so the caller skips its push.
// ============================================================

async function insertCoachAlert(alertRow, idempotencyKey) {
    const row = { ...alertRow };
    if (idempotencyKey) row.idempotency_key = idempotencyKey;
    try {
        const inserted = await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: [row],
            prefer: 'return=representation',
        });
        return { alertId: inserted?.[0]?.id || null, deduped: false };
    } catch (err) {
        const isUniqueViolation = err.sqlstate === '23505'
            || /23505|duplicate key value violates unique/.test(err.message || '');
        if (!isUniqueViolation || !idempotencyKey) throw err;
        // Race lost — another concurrent invocation already inserted this
        // alert. Look up the surviving row so the caller has the alert id
        // to chain auto-send / push decisions onto if it wants, then
        // signal `deduped: true` so it skips its own push.
        try {
            const existing = await supabaseQuery(
                `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
            );
            return { alertId: existing?.[0]?.id || null, deduped: true };
        } catch (lookupErr) {
            return { alertId: null, deduped: true };
        }
    }
}

// ============================================================
// Coach bio — facts about Shannon for the AI to draw on when a
// client asks something personal (where do you live, are you
// vegan, etc). The fine-tuned Vertex v7 model already SOUNDS like
// Shannon; this block gives it the FACTS so it doesn't hallucinate
// when a client probes about his life. Always present in the
// instant-coach-draft prompt; the model is instructed to use these
// only when relevant.
// ============================================================

const COACH_BIO = `
ABOUT SHANNON (the coach you are speaking as — facts to draw on if a client asks something personal; never volunteer them unprompted):
- 34, lives on the Gold Coast, Queensland, Australia (Coomera area)
- Vegetarian since birth — Seventh-day Adventist family heritage on his grandparents' side. Not religious himself anymore, but the vegetarian habit stuck
- Grew up on Tamborine Mountain in the Gold Coast hinterland
- Was deep into freestyle BMX as a kid; broke both knees and pivoted to fitness
- Bachelor of Exercise Science
- Owned and ran his own weight-training studio in Hampton, Melbourne for ~8 years; lived above the studio with his rabbit Sunshine; ran 3 weight-training classes a day
- Friday training sessions with mates ("the boys") — one was an osteopath, picked up a lot of posture/technique knowledge from him
- Moved back to Queensland a few years ago, sold the gym, lived with his dad initially
- Built and runs Plant Based Balance / FITGotchi
- Australian casual tone, lowercase-friendly, no corporate fluff`;

function buildCoachBioBlock() {
    return COACH_BIO;
}

const APP_XP_GUIDE = `
BALANCE XP GUIDE (use only when relevant, especially if a client asks how to earn XP):
- Meals: +1 XP per accepted meal log. Photo/AI meal logs are the safest path. If meal reminders are set, logging within 30 minutes of the scheduled meal time can add +1 on-time meal XP.
- Daily nutrition: +2 XP once per day for completing the nutrition day with at least one meal logged and calories/protein/carbs/fat within 20% of the user's targets. Finishing the day without hitting targets records the day but gives no bonus.
- Workout wins: +1 XP for each new personal best, including volume PRs. Verified workout photo/log routes can earn +1 XP. Do not tell clients to wait for a post-workout share/photo popup, that prompt has been removed.
- Feed and social: workout-related image posts/stories can earn +2 XP when Balance verifies the content. Eligible verified activity cards can show +1 XP when shared to the feed. Nudging an inactive friend from Home earns +1 XP, capped once per friend per week.
- Progress and daily cards: weekly progress photo +10 XP, daily weigh-in +1 XP, fitness diary +1 XP, and completing all three daily mood check-ins (morning, afternoon, evening) +1 XP.
- Learning: Health IQ lessons require 100% to earn XP. New lesson +1 XP, unit complete +2 XP, module complete +5 XP, daily quiz bonus +5 XP, and Health IQ level-ups add their shown bonus.
- Wearables: Fitbit 10,000 steps gives +2 XP once per day.
- Challenges and boosts: winning a challenge awards +200 XP and can grant a 30-day 2x XP boost. Being in active challenges or double-XP windows can multiply eligible rewards, but do not promise every reward doubles unless the app shows it. Referrals can grant one week of double XP.
- XP and coins are separate. XP levels the character and contributes to XP challenges; coins are for shop/challenge entry systems.
`;

function buildAppXpGuideBlock() {
    return APP_XP_GUIDE;
}

const NAME_USE_POLICY = `
NAME USE POLICY:
- Use the client's name far less. Real texting does not repeat someone's name just because we know it.
- For ongoing same-day conversations, usually do not use their name at all.
- If this feels like the first message of the day, a meaningful milestone, or a genuinely warm reset, one first-name mention is okay. Never more than once in a draft.
- Do not use the name as filler at the end of sentences ("nice work Sarah", "proud of you Sarah"). If unsure, leave it out.`;

function buildNameUsePolicyBlock() {
    return NAME_USE_POLICY;
}

const RELATIONSHIP_DISCOVERY_GUIDE = `
RELATIONSHIP DISCOVERY GUIDE:
- Shannon wants to know the person, not just their goals. Over time, look for natural chances to learn: where they live, work/study or shift rhythm, partner/kids/family names, dogs/pets and their names, household setup, cooking/food situation, training/sport background, stress/support, and what makes consistency easier or harder.
- Two high-value anchors are what they genuinely love and what genuinely ticks them off, stresses them, or makes health feel harder. Learn these naturally over time. Their "love" might be dogs, kids, food, music, sport, gaming, hiking, routine, a place, or a tiny daily ritual. Their "tick-off" might be work pressure, diet culture, boring meals, gym intimidation, family chaos, tiredness, time, injuries, or feeling judged.
- When Shannon can honestly relate to one of those anchors, use it lightly to build connection. Do not force a "same here" moment, do not make the reply about Shannon, and never pretend to share an experience that is not in the coach bio or conversation.
- Treat this like a loose checklist, not a script. Do not ask a question every reply. A short reaction, joke, direct answer, or "nice, love that" style message is often more Shannon than another discovery question.
- Ask one human question at a time only when the conversation gives you an opening. If Shannon already asked a question and they answered it, respond to the answer first. Do not immediately stack a new deeper question unless it clearly fits.
- Prefer natural follow-ups to new topics when they share something personal, but keep the follow-up normal and light. Example: if they mention kids, ask how the day usually works. If they mention a dog, ask the dog's name only if you do not already know it. If they mention work, ask what their days usually look like.
- Do not bundle several discovery questions together. Do not make it feel like intake. Answer or validate the current message first, then ask the one most natural question if useful.
- Use remembered personal details occasionally and specifically, but do not replace real attention with repeated name use.`;

function buildRelationshipDiscoveryBlock() {
    return RELATIONSHIP_DISCOVERY_GUIDE;
}

// ============================================================
// Client memory (per-coach per-client relationship notes)
// See database/client_memory_migration.sql
// ============================================================

/**
 * Returns true if the client was messaged by the coach within the last `hours`
 * hours via an in-app nudge. Used to suppress proactive alerts (morning pulse,
 * PB celebration, weekly check-in, plateau, onboarding drafts, coaching_idea
 * subtypes) when Shannon has just talked to this client — either manually in
 * the admin dashboard or via the auto_send path — so we don't double-message.
 *
 * Returns false on missing IDs or any error — it's a noise-reduction filter,
 * not a safety gate, and erring on "send" is fine.
 *
 * Does NOT apply to reply drafts (instant-coach-draft) or event-driven
 * celebrations that must fire immediately (first-workout).
 */
async function recentlyMessaged({ coachId, clientId, hours = 24 } = {}) {
    if (!coachId || !clientId) return false;
    try {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        const rows = await supabaseQuery(
            `nudges?select=id&sender_id=eq.${coachId}&receiver_id=eq.${clientId}&created_at=gte.${cutoff}&limit=1`
        );
        return rows.length > 0;
    } catch (e) {
        return false;
    }
}

/**
 * Returns true if the user is flagged as a test/fake account (users.is_test_account).
 * All proactive alert generators short-circuit on true so these accounts stop
 * surfacing as actionable alerts. Event-driven generators call this after the
 * initial user lookup to avoid spinning up Vertex calls for nothing.
 */
async function isTestAccount(clientId) {
    if (!clientId) return false;
    try {
        const rows = await supabaseQuery(
            `users?select=is_test_account&id=eq.${clientId}&limit=1`
        );
        return !!rows[0]?.is_test_account;
    } catch (e) {
        return false;
    }
}

async function loadClientMemory(coachId, clientId) {
    try {
        const rows = await supabaseQuery(
            `client_memory?select=goals,communication_style,running_notes,injuries_limits,personal_context,coach_instructions&coach_id=eq.${coachId}&client_id=eq.${clientId}&limit=1`
        );
        return rows[0] || null;
    } catch (e) {
        return null;
    }
}

/**
 * Returns true when Shannon has flipped the auto_send_enabled toggle on this
 * specific (coach, client) pair in the client_memory table. Used by every
 * coach-draft function to decide between the approve-gate push flow and the
 * auto-send flow.
 *
 * Defaults to false on error / missing row — the approve-gate path is the
 * safe default so a stale or missing client_memory row can't accidentally
 * auto-send.
 */
async function isAutoSendEnabled(coachId, clientId) {
    if (!coachId || !clientId) return false;
    try {
        const rows = await supabaseQuery(
            `client_memory?select=auto_send_enabled&coach_id=eq.${coachId}&client_id=eq.${clientId}&limit=1`
        );
        return !!rows[0]?.auto_send_enabled;
    } catch (e) {
        return false;
    }
}

/**
 * Auto-send path for trusted clients.
 *
 * Called by every coach-draft function (instant-coach-draft, pb-celebration,
 * onboarding, morning-pulse, weekly-checkin, plateau, first-workout) after
 * it's generated a draft + inserted a `pending` coach_alerts row.
 *
 * When `client_memory.auto_send_enabled` is TRUE for the (coach, client) pair:
 *   1. Insert the draft as a nudge from coach → client (same path Shannon's
 *      inline-reply takes, minus the human edit step).
 *   2. Flip the coach_alert to `status='sent'` with sent_via='auto_send' so
 *      the admin dashboard's "sent" view can distinguish these from
 *      Shannon-approved replies, and the learn-from-edits loop ignores them
 *      (was_edited=false — they're by definition the raw AI voice).
 *   3. Fire a low-key FYI push to Shannon via the normal dm_message channel
 *      so he's never surprised when the client replies. No RemoteInput,
 *      no approve gate, just "here's what went out in your name".
 *
 * Returns `true` if auto-send fired (caller should SKIP the coach_draft_ready
 * push); `false` otherwise (caller should push as normal).
 *
 * Guards:
 *   - Needs a non-empty draftText (nothing to auto-send for simple-reply
 *     alerts with no suggested_message).
 *   - Needs an alertId (we need to flip its status).
 *   - Defaults to false on any error so we never silently fail both paths.
 */
async function maybeAutoSendDraft({
    coachId,
    clientId,
    clientName,
    alertId,
    alertType,
    draftText,
    siteUrl,
    pushTitlePrefix = '📤 Auto-sent',
}) {
    if (!coachId || !clientId || !alertId) return false;
    draftText = normalizeCoachDraftText(draftText);
    if (!draftText || !draftText.trim()) return false;

    let enabled = false;
    try {
        enabled = await isAutoSendEnabled(coachId, clientId);
    } catch (e) {
        return false;
    }
    if (!enabled) return false;

    const sentAt = new Date().toISOString();

    // 1. Insert the reply nudge (coach → client). The existing
    //    notify_nudge_recipient trigger fires a normal DM push to the client,
    //    so they get Shannon's reply on their phone as if he typed it.
    try {
        await supabaseQuery('nudges', {
            method: 'POST',
            body: [{
                sender_id: coachId,
                receiver_id: clientId,
                message: draftText,
            }],
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.error(`[auto-send] nudge insert failed for alert ${alertId}: ${err.message}`);
        return false;
    }

    // 2. Mark alert as sent. Merge with existing data so the original draft
    //    context (milestone, signal_reason, etc.) is preserved for analytics.
    try {
        const existing = await supabaseQuery(`coach_alerts?select=data&id=eq.${alertId}&limit=1`);
        const existingData = existing[0]?.data || {};
        const mergedData = {
            ...existingData,
            sent_message: draftText,
            was_edited: false,
            sent_at: sentAt,
            sent_via: 'auto_send',
            auto_sent_alert_type: alertType || existingData.milestone || 'unknown',
        };
        await supabaseQuery(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: {
                status: 'sent',
                actioned_at: sentAt,
                data: mergedData,
            },
            prefer: 'return=minimal',
        });
        fireCoachEditAnalysis({
            alertId,
            draftText,
            sentMessage: draftText,
            source: 'auto_send',
        });
    } catch (err) {
        console.warn(`[auto-send] alert status update failed for ${alertId}: ${err.message}`);
        // Don't abort — reply is already delivered. Bookkeeping can lag.
    }

    // 3. Confirmation push to Shannon (normal dm_message channel — no
    //    RemoteInput, no approve gate). Non-fatal if it fails; the message
    //    still went out.
    if (siteUrl) {
        try {
            const label = clientName || 'client';
            const preview = truncate(draftText, 160);
            await fetch(`${siteUrl}/.netlify/functions/send-dm-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId: coachId,
                    senderId: clientId,
                    senderName: `${pushTitlePrefix} → ${label}`,
                    messageText: preview,
                    type: 'auto_sent_confirmation',
                    alertId,
                    clientId,
                    clientName: label,
                }),
            }).catch(e => console.warn(`[auto-send] confirmation push dispatch failed: ${e.message}`));
        } catch (err) {
            console.warn(`[auto-send] confirmation push failed: ${err.message}`);
        }
    }

    console.log(`[auto-send] alert ${alertId} auto-sent to ${clientId} (${alertType || 'unknown'})`);
    return true;
}

/**
 * Render client_memory as a CLIENT MEMORY block that slots into Vertex prompts
 * immediately after the CLIENT: <name> line. Skips any empty fields; if the
 * whole row is empty, returns '' so callers can inject `${memoryBlock || ''}`
 * with zero regression.
 */
function buildMemoryBlock(memory) {
    if (!memory) return '';
    const parts = [];
    if (memory.goals) parts.push(`Goals: ${memory.goals}`);
    if (memory.communication_style) parts.push(`How they chat: ${memory.communication_style}`);
    if (memory.injuries_limits) parts.push(`Injuries/limits: ${memory.injuries_limits}`);
    if (memory.personal_context) parts.push(`Personal context: ${memory.personal_context}`);
    if (memory.running_notes) {
        const lines = String(memory.running_notes).split('\n').filter(l => l.trim());
        const tail = lines.slice(-10).join('\n');
        if (tail) parts.push(`Recent notes:\n${tail}`);
    }
    let block = '';
    if (parts.length > 0) {
        block = `\n\nCLIENT MEMORY (what you know about this client):\n${parts.join('\n')}`;
    }
    // Coach instructions: explicit per-client guidance Shannon wrote for
    // the AI. Rendered as a SEPARATE, prominent block so the model treats
    // it as a directive rather than another fact. Examples: "responds
    // well to vulnerability — ask deeper questions" / "don't push the
    // challenge with this one" / "keep replies short". Wins over
    // conflicting memory.
    if (memory.coach_instructions && String(memory.coach_instructions).trim()) {
        block += `\n\nCOACH'S INSTRUCTIONS FOR YOU ON THIS CLIENT (directives Shannon wrote about how to handle this person — these override any conflicting cues from memory or general voice):\n${String(memory.coach_instructions).trim()}`;
    }
    return block;
}

function normalizeSex(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;
    if (['f', 'female', 'woman', 'women', 'girl'].includes(raw)) return 'female';
    if (['m', 'male', 'man', 'men', 'boy'].includes(raw)) return 'male';
    if (['nonbinary', 'non-binary', 'nb', 'gender diverse', 'other'].includes(raw)) return raw;
    return raw.length <= 32 ? raw : null;
}

async function loadClientProfileFacts(clientId) {
    const profile = {
        name: null,
        email: null,
        sex: null,
        personalDetails: {},
    };
    if (!clientId) return profile;

    try {
        const users = await supabaseQuery(`users?select=name,email,sex&id=eq.${clientId}&limit=1`);
        if (users[0]) {
            profile.name = users[0].name || null;
            profile.email = users[0].email || null;
            profile.sex = normalizeSex(users[0].sex);
        }
    } catch (e) { /* non-critical */ }

    try {
        const facts = await supabaseQuery(`user_facts?select=personal_details&user_id=eq.${clientId}&limit=1`);
        const pd = facts[0]?.personal_details || {};
        profile.personalDetails = pd;
        if (!profile.sex) {
            profile.sex = normalizeSex(pd.sex || pd.gender);
        }
    } catch (e) { /* non-critical */ }

    return profile;
}

function buildClientProfileBlock({ clientName = 'Client', profile = {}, customData = null } = {}) {
    const pd = profile.personalDetails || {};
    const custom = customData || profile.customData || {};
    const confirmedSex = normalizeSex(profile.sex || pd.sex || pd.gender || custom.sex || custom.gender);

    const lines = [];
    if (confirmedSex) {
        lines.push(`Confirmed sex: ${confirmedSex}`);
    } else {
        lines.push('Confirmed sex: unknown');
    }

    const age = pd.age || custom.age;
    if (age) lines.push(`Age: ${age}`);

    const menopauseStatus = pd.menopause_status || custom.menopause_status;
    if (menopauseStatus) lines.push(`Menopause status: ${menopauseStatus}`);

    const hormoneProfile = pd.hormone_profile || custom.hormone_profile;
    if (hormoneProfile) lines.push(`Hormone profile: ${hormoneProfile}`);

    const cycleSync = pd.cycle_sync_preference || custom.cycle_sync_preference;
    if (cycleSync) lines.push(`Cycle sync preference: ${cycleSync}`);

    const periodEnergy = pd.period_energy_response || pd.cycle_body_response || custom.period_energy_response || custom.cycle_body_response;
    if (periodEnergy) lines.push(`Period energy response: ${periodEnergy}`);

    if (pd.last_period_start || custom.last_period_start) {
        lines.push(`Last period start: ${pd.last_period_start || custom.last_period_start}`);
    }

    const guidance = confirmedSex
        ? 'Use confirmed sex/cycle details only when relevant. Still follow the client wording, the relationship history, and Shannon-specific instructions first.'
        : `${clientName}'s sex is not confirmed. You may treat first name, pronouns, and conversation context as weak clues only. Do not state or rely on a man/woman assumption. Do not ask just to fill a profile. If sex, cycle, hormones, or pronouns matter for the reply, ask a casual clarifying question or wait for Shannon/client confirmation.`;

    return `\n\nCLIENT PROFILE:\n${lines.join('\n')}\nGuidance: ${guidance}`;
}

// ============================================================
// Learn-from-edits — pull sent messages where Shannon edited the AI draft
// ============================================================

/**
 * Returns a formatted "LEARN FROM PAST EDITS" block for inclusion in prompts.
 * Queries coach_alerts for sent, edited messages. Falls back to '' on error
 * (non-critical — the pipeline still produces usable drafts without examples).
 *
 * Per-conversation tailoring: when `clientId` (in-app users) or `igThreadId`
 * (ManyChat threads) is supplied, person-specific edits are pulled FIRST and
 * presented as the canonical voice for THIS conversation. General edits across
 * all clients fill any remaining slots up to `max`. This lets the AI pick up
 * patterns like "Shannon flirts more with one person, stays business-only
 * with another" once a few real edits exist for the relationship.
 *
 * @param {object} opts
 * @param {string=} opts.alertType      filter e.g. 'win_to_celebrate' — omit for any type
 * @param {number=} opts.lookback       rows to fetch per scope (default 15)
 * @param {number=} opts.max            examples to include in block (default 6)
 * @param {string=} opts.label          block header — defaults to generic wording
 * @param {string=} opts.clientId       in-app user id, scopes person-specific edits
 * @param {string=} opts.igThreadId     ig_threads.id for ManyChat conversations
 */
async function loadEditExamples({
    alertType = null,
    lookback = 40,
    max = 15,
    label = null,
    clientId = null,
    igThreadId = null,
    generalCap = 3,
} = {}) {
    try {
        const typeFilter = alertType ? `&alert_type=eq.${alertType}` : '';
        const hasScope = !!(clientId || igThreadId);
        const buildExamples = (rows = []) => {
            const examples = [];
            const seen = new Set();
            const addExample = ({ alertType, draft, final, reason, source }) => {
                const cleanDraft = normalizeCoachDraftText(draft || '').trim();
                const cleanFinal = normalizeCoachDraftText(final || '').trim();
                if (!cleanDraft || !cleanFinal || cleanDraft === cleanFinal) return;
                const key = `${cleanDraft}\n---\n${cleanFinal}`;
                if (seen.has(key)) return;
                seen.add(key);
                examples.push({
                    alert_type: alertType || 'unknown',
                    draft: cleanDraft,
                    final: cleanFinal,
                    reason: String(reason || '').trim(),
                    source: source || 'edit',
                });
            };

            for (const row of Array.isArray(rows) ? rows : []) {
                const data = row.data || {};
                const finalMessage = data.sent_message || row.suggested_message || data.draft_text || '';
                addExample({
                    alertType: row.alert_type,
                    draft: row.suggested_message || data.draft_text,
                    final: finalMessage,
                    reason: data.edit_reason || data.edit_analysis?.summary,
                    source: 'manual_edit',
                });

                const redraftHistory = Array.isArray(data.redraft_history) ? data.redraft_history : [];
                for (const h of redraftHistory.slice(-3)) {
                    addExample({
                        alertType: row.alert_type,
                        draft: h.previous,
                        final: finalMessage,
                        reason: h.hint ? `redraft hint: ${h.hint}` : '',
                        source: 'redraft_hint',
                    });
                }
            }
            return examples;
        };

        // Pull person-specific edits first when a scope is given. Either
        // clientId (in-app) or igThreadId (ManyChat) — usually one, sometimes
        // both for converted leads.
        let personExamples = [];
        if (hasScope) {
            try {
                let scopeFilter;
                if (clientId && igThreadId) {
                    scopeFilter = `&or=(client_id.eq.${clientId},data->>ig_thread_id.eq.${igThreadId})`;
                } else if (clientId) {
                    scopeFilter = `&client_id=eq.${clientId}`;
                } else {
                    scopeFilter = `&data->>ig_thread_id=eq.${igThreadId}`;
                }
                const personRecent = await supabaseQuery(
                    `coach_alerts?select=alert_type,suggested_message,data&status=eq.sent&data->>sent_message=not.is.null${typeFilter}${scopeFilter}&order=actioned_at.desc&limit=${lookback}`
                );
                personExamples = buildExamples(personRecent);
            } catch (e) { /* fall through to general only */ }
        }

        // General edit corpus (across all clients) — primary source when no
        // scope is given, fallback floor when scope is given but the person
        // has few edits.
        const generalRecent = await supabaseQuery(
            `coach_alerts?select=alert_type,suggested_message,data&status=eq.sent&data->>sent_message=not.is.null${typeFilter}&order=actioned_at.desc&limit=${lookback}`
        );
        const generalExamples = buildExamples(generalRecent);

        const personSlice = personExamples.slice(0, max);
        const personSentMessages = new Set(personSlice.map(p => p.final));

        // Sizing logic:
        //   - Without scope: use full `max` from general (legacy behavior for
        //     proactive scans like badge_earned that don't pass a scope).
        //   - With scope: cap general at `generalCap` so a flood of unrelated
        //     edits across other clients doesn't drown out the per-person
        //     signal we're trying to amplify.
        const generalLimit = hasScope
            ? Math.min(generalCap, Math.max(0, max - personSlice.length))
            : max;
        const generalSlice = generalExamples
            .filter(g => !personSentMessages.has(g.final))
            .slice(0, generalLimit);

        if (personSlice.length === 0 && generalSlice.length === 0) return '';

        const formatExample = (e, i) => {
            const reason = e.reason ? `\nWhy Shannon changed it: ${e.reason}` : '';
            return `Example ${i + 1}:\nAI draft: ${e.draft}\nShannon rewrote it to: ${e.final}${reason}`;
        };

        let block = `\n\nRECENT SHANNON EDIT LESSONS TO APPLY BEFORE COPYING ANY EXAMPLE:\n- Do not ask a question every reply. In friendly ongoing banter, sometimes the right reply is only a short reaction or joke.\n- If the AI draft asks two questions, usually cut it to one or none.\n- If the client is replying to a story/post Shannon sent natively and the context is missing, keep it short or ask a tiny clarifier. Do not invent a deep thread.\n- Use names sparingly. IG handles are not always real names.\n- When Shannon writes an edit reason or redraft hint below, treat that reason as higher priority than the old draft.\n`;
        if (personSlice.length > 0) {
            block += '\n\nLEARN FROM PAST EDITS WITH THIS PERSON — these show the voice Shannon uses with THEM specifically (which may differ from how he writes to others). The SECOND version is the canonical tone for this conversation. Mimic it:\n\n';
            block += personSlice.map(formatExample).join('\n\n');
        }
        if (generalSlice.length > 0) {
            const generalHeader = personSlice.length > 0
                ? '\n\nGENERAL VOICE EXAMPLES (other clients — useful for tone but lower priority than the person-specific ones above):\n\n'
                : '\n\n' + (label || 'LEARN FROM PAST EDITS — Shannon rewrote these AI drafts into how he actually talks. Mimic the SECOND version:') + '\n\n';
            block += generalHeader;
            block += generalSlice.map(formatExample).join('\n\n');
        }
        return block;
    } catch (e) {
        return '';
    }
}

// ============================================================
// Vertex AI (fine-tuned Shannon voice)
// ============================================================

function getGCPServiceAccount() {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        }
        if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
            return {
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                project_id: process.env.FIREBASE_PROJECT_ID,
            };
        }
    } catch (e) { console.error('GCP service account parse error:', e.message); }
    return null;
}

async function getVertexAIAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (_vertexAccessTokenCache.token && _vertexAccessTokenCache.expiresAt > now + 60) {
        return _vertexAccessTokenCache.token;
    }

    const serviceAccount = getGCPServiceAccount();
    if (!serviceAccount) throw new Error('No GCP service account configured');

    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    })).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(serviceAccount.private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) throw new Error(`Vertex token exchange failed: ${JSON.stringify(tokenData)}`);

    _vertexAccessTokenCache = { token: tokenData.access_token, expiresAt: now + (tokenData.expires_in || 3600) };
    return tokenData.access_token;
}

// Gemini/Vertex can split a single completion across multiple `parts`
// (observed with the fine-tuned Shannon model and long outputs). Taking only
// parts[0] was dropping the tail and delivering mid-sentence drafts to the
// notification. Concatenate every text part, and surface finishReason +
// response shape so MAX_TOKENS / SAFETY / RECITATION cut-offs are visible in
// function logs.
function extractCandidateText(data, source) {
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    // Drop Gemini "thought" parts — those are private reasoning, never the user-facing answer.
    const answerParts = parts.filter(p => p && p.thought !== true);
    const text = answerParts.map(p => p?.text || '').join('');
    const finishReason = candidate?.finishReason;
    const usage = data.usageMetadata || {};
    if (finishReason && finishReason !== 'STOP') {
        console.warn(`[${source}] truncated: finishReason=${finishReason} partCount=${parts.length} textLen=${text.length} promptTok=${usage.promptTokenCount || '?'} outTok=${usage.candidatesTokenCount || '?'} totalTok=${usage.totalTokenCount || '?'} preview=${JSON.stringify(text.slice(-60))}`);
    } else if (text.length < 30) {
        // Unexpectedly short — log the full candidate so we can see what happened.
        console.warn(`[${source}] suspiciously short output: finishReason=${finishReason || 'unknown'} partCount=${parts.length} textLen=${text.length} candidate=${JSON.stringify(candidate).slice(0, 600)}`);
    }
    if (looksLikeReasoningLeak(text)) {
        console.warn(`[${source}] reasoning leak detected — rejecting output. preview=${JSON.stringify(text.slice(0, 200))}`);
        throw new Error('reasoning_leak');
    }
    return text;
}

/**
 * Detects when the model has leaked its planning/reasoning into the response
 * instead of returning a clean draft. Patterns we've seen in the wild:
 *   - opens with "think through…" / "let me think…" / "let's break down…"
 *   - contains multiple numbered planning sections like "**Objective:**",
 *     "**Tone:**", "**Constraint:**", "**Content Requirement:**"
 *   - iterative drafting pattern: "**Attempt N**" paired with "**Critique:**"
 *   - meta-labels like "**Client Name:**"
 *
 * Any of these mean the user would see Claude/Gemini's scratch work instead of
 * Shannon's voice. We reject the output so the caller can fall back (or skip
 * the draft entirely) rather than saving reasoning into `suggested_message`.
 */
function looksLikeReasoningLeak(text) {
    if (!text) return false;
    const t = String(text);
    const head = t.slice(0, 300);
    // Very-meta openers that a real DM would never start with.
    if (/^\s*(think through (the )?user'?s request|think step[- ]by[- ]step|let me think (through|about) (this|the)|here'?s my (thinking|plan|approach)|here'?s how i'?ll approach|first,? (let me|i'?ll) (draft|plan|think))/i.test(head)) {
        return true;
    }
    // Iterative-drafting pattern: "Attempt 1 … Critique: …"
    if (/\*\*\s*attempt\s*\d/i.test(t) && /\*\*\s*critique\s*:?/i.test(t)) return true;
    // Meta section labels that only appear in planning notes.
    if (/\*\*\s*client\s*name\s*:?\s*\*\*/i.test(t)) return true;
    // Multiple structured planning-section labels in one response → reasoning.
    const planningLabels = [/\*\*\s*objective\s*:/i, /\*\*\s*tone\s*:/i, /\*\*\s*(critical\s+)?constraint\s*:/i, /\*\*\s*content\s+requirement/i, /\*\*\s*pattern\s*\/\s*gap/i, /\*\*\s*specific\s+reference\s*:/i];
    if (planningLabels.filter(rx => rx.test(t)).length >= 2) return true;
    return false;
}

async function callVertexAIModel(contents, generationConfig = {}) {
    const accessToken = await getVertexAIAccessToken();
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT_ID}/locations/${VERTEX_LOCATION}/endpoints/${VERTEX_ENDPOINT_ID}:generateContent`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 1024, temperature: 0.8, ...generationConfig },
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vertex AI call failed: ${response.status} ${errText.slice(0, 500)}`);
    }
    const data = await response.json();
    return extractCandidateText(data, 'vertex');
}

async function callGeminiFallback(contents, generationConfig = {}) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
    const { data, model } = await callGeminiModelChain({
        apiKey: GEMINI_API_KEY,
        profile: 'coach_fallback',
        label: 'coach-fallback',
        payload: {
            contents,
            generationConfig: { maxOutputTokens: 2048, temperature: 0.8, ...generationConfig },
        },
    });
    return extractCandidateText(data, model);
}

/**
 * Calls stock Gemini 2.0 Flash via Vertex AI (NOT the public Gemini API).
 * Uses the GCP service-account auth we already have set up for the v7
 * fine-tuned endpoint, so it counts against Shannon's GCP project quota
 * which is far higher than the public Gemini API's free tier (the latter
 * 429s aggressively on multimodal requests).
 *
 * Used as the primary path for image-attached drafts so vision doesn't
 * choke on rate limits the moment Shannon gets a couple of photo DMs in
 * a minute.
 */
async function callVertexGeminiMultimodal(contents, generationConfig = {}) {
    const accessToken = await getVertexAIAccessToken();
    // Vertex AI uses version-suffixed model IDs. `gemini-2.0-flash` (no suffix)
    // is a public-API name and 404s on Vertex. `gemini-1.5-flash-002` is the
    // GA stable multimodal model — universally available across regions and
    // has order-of-magnitude higher quotas than the public Gemini API's free
    // tier, which is what was 429ing on Shannon's photo tests.
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT_ID}/locations/${VERTEX_LOCATION}/publishers/google/models/gemini-2.5-flash:generateContent`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 2048, temperature: 0.8, ...generationConfig },
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vertex Gemini multimodal call failed: ${response.status} ${errText.slice(0, 500)}`);
    }
    const data = await response.json();
    return extractCandidateText(data, 'vertex-gemini');
}

// ============================================================
// Text utilities
// ============================================================

/**
 * Removes optional Markdown fences before trying to parse model JSON.
 */
function stripMarkdownFence(text) {
    const out = String(text || '').trim();
    const fenced = out.match(/^```(?:json|javascript|js|txt|text)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) return fenced[1].trim();
    return out
        .replace(/^```(?:json|javascript|js|txt|text)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function decodeLooseDraftString(value) {
    let out = '';
    let escaped = false;
    for (const ch of String(value || '')) {
        if (escaped) {
            if (ch === 'n') out += '\n';
            else if (ch === 'r') out += '\r';
            else if (ch === 't') out += '\t';
            else out += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        out += ch;
    }
    if (escaped) out += '\\';
    return out;
}

function extractLooseDraftMessageChunks(text) {
    const trimmed = String(text || '').trim();
    const keyMatch = trimmed.match(/["']?messages?["']?\s*:/i);
    if (!keyMatch) return [];
    const afterKey = trimmed.slice(keyMatch.index + keyMatch[0].length);
    const open = afterKey.indexOf('[');
    if (open === -1) return [];
    const body = afterKey.slice(open + 1);
    const chunks = [];
    let i = 0;

    while (i < body.length) {
        while (i < body.length && /[\s,]/.test(body[i])) i++;
        if (body[i] === ']') break;
        const quote = body[i];
        if (quote !== '"' && quote !== "'") break;
        i++;

        let raw = '';
        let escaped = false;
        let closed = false;
        for (; i < body.length; i++) {
            const ch = body[i];
            if (escaped) {
                raw += '\\' + ch;
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === quote) {
                closed = true;
                i++;
                break;
            }
            raw += ch;
        }

        const cleaned = decodeLooseDraftString(raw).trim();
        if (closed && cleaned) {
            chunks.push(cleaned);
            continue;
        }
        // If the last JSON string was cut off, drop it when we already have
        // complete chunks. Better to show/send two clean bubbles than a broken
        // third half-sentence.
        if (!chunks.length && cleaned) chunks.push(cleaned);
        break;
    }

    return chunks;
}

function extractDraftChunksFromParsedJson(value, depth = 0) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        if (depth < 2 && /^[`]*\s*(?:json\s*[:\-]?\s*)?[\[{]/i.test(trimmed)) {
            const nested = extractDraftChunksFromJsonCandidate(trimmed, depth + 1);
            if (nested.length) return nested;
        }
        return [trimmed];
    }
    if (Array.isArray(value)) {
        return value
            .map(item => {
                if (typeof item === 'string') return item.trim();
                if (item && typeof item === 'object') {
                    return String(item.message || item.text || item.reply || '').trim();
                }
                return '';
            })
            .filter(Boolean);
    }
    if (!value || typeof value !== 'object') return [];
    const direct = value.message
        || value.reply
        || value.text
        || value.draft
        || value.suggested_message
        || value.suggestedMessage;
    if (direct) return extractDraftChunksFromParsedJson(direct, depth + 1);
    if (Array.isArray(value.messages)) return extractDraftChunksFromParsedJson(value.messages, depth + 1);
    if (Array.isArray(value.replies)) return extractDraftChunksFromParsedJson(value.replies, depth + 1);
    if (Array.isArray(value.chunks)) return extractDraftChunksFromParsedJson(value.chunks, depth + 1);
    return [];
}

function extractDraftTextFromParsedJson(value) {
    return extractDraftChunksFromParsedJson(value).join('\n').trim();
}

function extractDraftChunksFromJsonCandidate(candidate, depth = 0) {
    const trimmed = String(candidate || '').trim();
    if (!trimmed) return [];

    const withoutJsonLabel = trimmed
        .replace(/^\s*json\s*[:\-]?\s*/i, '')
        .trim();
    const attempts = [trimmed, withoutJsonLabel].filter(Boolean);

    for (const attempt of attempts) {
        try {
            const parsed = JSON.parse(attempt);
            const extracted = extractDraftChunksFromParsedJson(parsed, depth + 1);
            if (extracted.length) return extracted;
        } catch { /* not direct JSON */ }

        const jsonBlock = attempt.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonBlock) {
            try {
                const parsed = JSON.parse(jsonBlock[0]);
                const extracted = extractDraftChunksFromParsedJson(parsed, depth + 1);
                if (extracted.length) return extracted;
            } catch { /* not a clean JSON block */ }
        }

        const messagesMatch = attempt.match(/["']?messages["']?\s*:\s*(\[[\s\S]*?\])\s*[,}]?\s*$/i);
        if (messagesMatch) {
            try {
                const parsed = JSON.parse(messagesMatch[1]);
                const extracted = extractDraftChunksFromParsedJson(parsed, depth + 1);
                if (extracted.length) return extracted;
            } catch { /* malformed messages array */ }
        }

        const looseChunks = extractLooseDraftMessageChunks(attempt);
        if (looseChunks.length) return looseChunks;
    }

    return [];
}

function parseDraftJsonCandidate(candidate) {
    return extractDraftChunksFromJsonCandidate(candidate).join('\n').trim();
}

function splitPlainDraftTextIntoChunks(text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return [];
    const paragraphs = trimmed.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (paragraphs.length >= 2) return paragraphs;
    const lines = trimmed.split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.length <= 6) return lines;
    return [trimmed];
}

const DEFAULT_DM_BUBBLE_TARGET_CHARS = 420;
const DEFAULT_DM_BUBBLE_HARD_MAX_CHARS = 850;

function cleanOutboundDmBubbleText(text) {
    return String(text || '')
        .replace(/\r\n?/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function findOutboundDmBreak(text, maxChars, minChars, options = {}) {
    const source = String(text || '');
    if (source.length <= maxChars) return -1;
    const head = source.slice(0, Math.max(0, maxChars + 1));
    const patterns = [
        /\n\s*\n/g,
        /[.!?](?:["')\]]+)?\s+/g,
        /\n+/g,
    ];
    if (options.allowClauses) patterns.push(/[,;:]\s+/g);
    if (options.allowWords) patterns.push(/\s+/g);

    for (const pattern of patterns) {
        let best = -1;
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(head)) !== null) {
            const idx = match.index + match[0].length;
            if (idx >= minChars && idx <= maxChars) best = idx;
            if (match[0].length === 0) pattern.lastIndex++;
        }
        if (best > -1) return best;
    }
    return -1;
}

function splitOutboundDmParagraph(paragraph, options = {}) {
    const targetChars = Number(options.targetChars) || DEFAULT_DM_BUBBLE_TARGET_CHARS;
    const hardMaxChars = Number(options.hardMaxChars) || DEFAULT_DM_BUBBLE_HARD_MAX_CHARS;
    const minTargetBreak = Math.max(140, Math.floor(targetChars * 0.45));
    const minHardBreak = Math.max(180, Math.floor(hardMaxChars * 0.45));
    const chunks = [];
    let rest = cleanOutboundDmBubbleText(paragraph);

    while (rest.length > hardMaxChars || rest.length > targetChars) {
        let breakAt = -1;
        if (rest.length > targetChars) {
            breakAt = findOutboundDmBreak(rest, targetChars, minTargetBreak);
        }
        if (breakAt === -1 && rest.length > hardMaxChars) {
            breakAt = findOutboundDmBreak(rest, hardMaxChars, minHardBreak, {
                allowClauses: true,
                allowWords: true,
            });
        }
        if (breakAt === -1) break;

        const head = cleanOutboundDmBubbleText(rest.slice(0, breakAt));
        if (head) chunks.push(head);
        rest = cleanOutboundDmBubbleText(rest.slice(breakAt));
        if (!rest) break;
    }

    if (rest) chunks.push(rest);
    return chunks;
}

function repairLikelySplitWords(chunks) {
    const repaired = [];
    for (const raw of chunks) {
        const chunk = cleanOutboundDmBubbleText(raw);
        if (!chunk) continue;
        const prev = repaired[repaired.length - 1];
        const tail = prev ? (prev.match(/[A-Za-z]+$/) || [''])[0] : '';
        if (prev && tail.length === 1 && !/[aAiI]/.test(tail) && /^[a-z]/.test(chunk)) {
            repaired[repaired.length - 1] = prev + chunk;
        } else {
            repaired.push(chunk);
        }
    }
    return repaired;
}

function splitCoachDraftIntoDmBubbles(input, options = {}) {
    const sourceChunks = Array.isArray(input)
        ? input.map(v => typeof v === 'string' ? v : String(v || ''))
        : normalizeCoachDraftChunks(input);
    const repairedChunks = repairLikelySplitWords(sourceChunks);
    const bubbles = [];

    for (const source of repairedChunks) {
        const text = cleanOutboundDmBubbleText(source);
        if (!text) continue;
        const paragraphs = text.split(/\n+/).map(s => cleanOutboundDmBubbleText(s)).filter(Boolean);
        for (const paragraph of paragraphs.length ? paragraphs : [text]) {
            bubbles.push(...splitOutboundDmParagraph(paragraph, options));
        }
    }

    return bubbles
        .map(s => cleanOutboundDmBubbleText(s))
        .filter(Boolean);
}

function normalizeCoachDraftChunks(text) {
    if (!text) return [];
    if (Array.isArray(text)) {
        const chunks = text
            .flatMap(item => {
                if (item && typeof item === 'object') return normalizeCoachDraftChunks(item);
                const value = String(item || '').trim();
                if (!value) return [];
                if (/^[`]*\s*(?:json\s*[:\-]?\s*)?[\[{]/i.test(value) || /["']?messages?["']?\s*:/i.test(value)) {
                    return normalizeCoachDraftChunks(value);
                }
                return [value];
            })
            .map(s => String(s || '').trim())
            .filter(Boolean);
        return chunks;
    }
    if (typeof text === 'object') {
        return extractDraftChunksFromParsedJson(text);
    }
    const original = String(text).trim();
    if (!original) return [];

    const candidates = [stripMarkdownFence(original)];
    const fenced = original.match(/```(?:json|javascript|js|txt|text)?\s*([\s\S]*?)\s*```/i);
    if (fenced) candidates.push(fenced[1].trim());

    for (const candidate of candidates) {
        const chunks = extractDraftChunksFromJsonCandidate(candidate);
        if (chunks.length) return chunks;
    }

    return splitPlainDraftTextIntoChunks(candidates[0] || original);
}

/**
 * Models occasionally ignore "plain text only" and return the IG-style
 * JSON wrapper (`{"messages":[...]}`), sometimes inside ```json fences.
 * Keep that implementation detail out of notifications, sends, and stored
 * suggested_message values.
 */
function normalizeCoachDraftText(text) {
    return normalizeCoachDraftChunks(text).join('\n').trim();
}

/**
 * Strips robotic "hey Hannah," / "hi there" / "yo" openers. All coach
 * drafts are replies in an ongoing relationship, so real greetings are
 * almost never what Shannon actually sends.
 */
function stripLeadingGreeting(text) {
    if (!text) return text;
    let out = normalizeCoachDraftText(text);
    for (let i = 0; i < 3; i++) {
        const before = out;
        out = out.replace(/^(hey|hi|hello|yo|heya|howdy|g'day|gday|oi)\b[^\n.!?]*?[,!\-—:]\s*/i, '');
        out = out.replace(/^(hey|hi|hello|yo)\s+(?=[a-z])/i, '');
        if (out === before) break;
    }
    out = out.trim();
    if (out && /^[A-Z][a-z]/.test(out) && /[a-z]/.test(text)) {
        out = out[0].toLowerCase() + out.slice(1);
    }
    return out || text;
}

function truncate(s, n) {
    if (!s) return '';
    return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function truncateTail(s, n) {
    if (!s) return '';
    return s.length <= n ? s : '…' + s.slice(-(n - 1));
}

const COACH_TIME_ZONE = 'Australia/Brisbane';

function parseDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatCoachLocalTimestamp(value = new Date()) {
    const date = parseDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat('en-AU', {
        timeZone: COACH_TIME_ZONE,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZoneName: 'short',
    }).format(date);
}

function formatDurationWords(ms) {
    const absMs = Math.abs(Number(ms) || 0);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (absMs < minute) return 'under 1 minute';
    if (absMs < hour) {
        const n = Math.round(absMs / minute);
        return `${n} minute${n === 1 ? '' : 's'}`;
    }
    if (absMs < day) {
        const n = Math.round(absMs / hour);
        return `${n} hour${n === 1 ? '' : 's'}`;
    }
    const n = Math.round(absMs / day);
    return `${n} day${n === 1 ? '' : 's'}`;
}

function formatRelativeTime(value, now = new Date()) {
    const date = parseDate(value);
    const nowDate = parseDate(now);
    if (!date || !nowDate) return '';
    const diff = nowDate.getTime() - date.getTime();
    if (Math.abs(diff) < 60 * 1000) return 'just now';
    return diff >= 0
        ? `${formatDurationWords(diff)} ago`
        : `in ${formatDurationWords(diff)}`;
}

function formatGapSincePrevious(previousValue, value) {
    const previous = parseDate(previousValue);
    const date = parseDate(value);
    if (!previous || !date) return '';
    const diff = date.getTime() - previous.getTime();
    if (diff <= 0) return '';
    return `${formatDurationWords(diff)} after previous`;
}

function formatTimedConversationLine({ speaker, text, createdAt, previousCreatedAt, now = new Date() }) {
    const cleanedSpeaker = String(speaker || 'Unknown').trim() || 'Unknown';
    const cleanedText = String(text || '').trim();
    const timing = [
        formatCoachLocalTimestamp(createdAt),
        formatRelativeTime(createdAt, now),
        formatGapSincePrevious(previousCreatedAt, createdAt),
    ].filter(Boolean).join(', ');
    return `${cleanedSpeaker}${timing ? ` [${timing}]` : ''}: ${cleanedText}`;
}

// ============================================================
// Recent workouts — canonical query
// ============================================================

/**
 * Returns up to `limit` distinct completed-workout sessions for the user
 * since the given ISO cutoff, newest first.
 *
 * The `workouts` table stores ONE ROW PER SET × exercise — not per session.
 * So we deduplicate by (template_name, date-of-created_at) and return a
 * compact summary the prompt builders can use directly.
 *
 * Returns array of `{ templateName, completedAt, exerciseCount }` — where
 * `exerciseCount` is the number of distinct exercise names inside that
 * template+date bucket (a rough "how substantial was this session" signal).
 */
function cleanWorkoutField(value, max = 80) {
    if (value == null) return '';
    return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseWorkoutNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const match = raw.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
}

function formatWorkoutNumber(n) {
    if (!Number.isFinite(n)) return '';
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function formatSetEvidence(row) {
    const reps = cleanWorkoutField(row.reps, 24);
    const time = cleanWorkoutField(row.time_duration, 24);
    const rawWeight = cleanWorkoutField(row.weight_kg, 24);
    const weightNum = parseWorkoutNumber(rawWeight);
    const weightLabel = weightNum != null && weightNum > 0
        ? `${formatWorkoutNumber(weightNum)}kg`
        : (/body\s*weight|bodyweight/i.test(rawWeight) ? 'bodyweight' : '');

    let label = '';
    if (weightLabel && reps) {
        label = `${weightLabel} x ${reps}`;
    } else if (weightLabel) {
        label = weightLabel;
    } else if (reps) {
        label = `${reps} reps`;
    } else if (time) {
        label = time;
    }

    if (row.is_drop_set) {
        const dropWeights = cleanWorkoutField(row.drop_set_weights, 40);
        const dropReps = cleanWorkoutField(row.drop_set_reps, 40);
        const drop = [dropWeights ? `weights ${dropWeights}` : '', dropReps ? `reps ${dropReps}` : ''].filter(Boolean).join(', ');
        if (drop) label = label ? `${label} (drop set: ${drop})` : `drop set: ${drop}`;
    }

    return label;
}

function summarizeExerciseEvidence(exerciseName, rows) {
    const name = cleanWorkoutField(exerciseName || 'Exercise', 70);
    const labels = rows
        .slice()
        .sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0))
        .map(formatSetEvidence)
        .filter(Boolean);
    const unique = [];
    for (const label of labels) {
        if (!unique.includes(label)) unique.push(label);
        if (unique.length >= 3) break;
    }
    const more = labels.length > unique.length ? ` +${labels.length - unique.length} more` : '';
    return unique.length ? `${name}: ${unique.join(', ')}${more}` : name;
}

function summarizeWorkoutSession(session, maxExercises = 5) {
    if (!session) return '';
    const date = session.workoutDate || (session.completedAt || '').slice(0, 10) || 'recent';
    const name = cleanWorkoutField(session.templateName || 'Workout', 70);
    const exercises = Array.isArray(session.exercises) ? session.exercises : [];
    const exerciseLines = exercises
        .slice(0, maxExercises)
        .map(e => e.summary)
        .filter(Boolean);
    const hiddenCount = Math.max(0, exercises.length - exerciseLines.length);
    const hidden = hiddenCount ? `; +${hiddenCount} more exercise${hiddenCount === 1 ? '' : 's'}` : '';
    const detail = exerciseLines.length ? ` - ${exerciseLines.join('; ')}${hidden}` : '';
    const count = session.exerciseCount ? ` (${session.exerciseCount} exercise${session.exerciseCount === 1 ? '' : 's'})` : '';
    return `${date}: ${name}${count}${detail}`;
}

function formatRecentWorkoutEvidence(workouts, maxSessions = 5) {
    if (!Array.isArray(workouts) || workouts.length === 0) return '';
    return workouts
        .slice(0, maxSessions)
        .map(w => w.summary || summarizeWorkoutSession(w))
        .filter(Boolean)
        .join('\n');
}

async function loadRecentWorkouts(userId, sinceIso, limit = 10) {
    try {
        // Pull enough rows to dedup. Cap wide — one client might log 30+ sets
        // per session; we need all of them to count exercises correctly.
        const rows = await supabaseQuery(
            `workouts?select=template_name,exercise_name,set_number,time_duration,reps,weight_kg,is_drop_set,drop_set_weights,drop_set_reps,created_at,workout_date&user_id=eq.${userId}&created_at=gte.${sinceIso}&workout_type=eq.history&is_current_workout=eq.false&order=created_at.desc&limit=500`
        );
        const buckets = new Map();
        for (const r of rows) {
            const templateName = cleanWorkoutField(r.template_name || 'Workout', 100) || 'Workout';
            const dateKey = (r.workout_date || (r.created_at || '').slice(0, 10));
            const key = `${templateName}__${dateKey}`;
            if (!buckets.has(key)) {
                buckets.set(key, {
                    templateName,
                    workoutDate: dateKey,
                    completedAt: r.created_at,
                    exerciseSet: new Set(),
                    exerciseRows: new Map(),
                });
            }
            const b = buckets.get(key);
            const exerciseName = cleanWorkoutField(r.exercise_name, 100);
            if (exerciseName) {
                const exerciseKey = exerciseName.toLowerCase();
                b.exerciseSet.add(exerciseKey);
                if (!b.exerciseRows.has(exerciseKey)) {
                    b.exerciseRows.set(exerciseKey, { name: exerciseName, rows: [] });
                }
                b.exerciseRows.get(exerciseKey).rows.push(r);
            }
            // Keep the newest created_at in the bucket
            if (r.created_at && r.created_at > b.completedAt) b.completedAt = r.created_at;
        }
        const sessions = Array.from(buckets.values())
            .map(b => {
                const exercises = Array.from(b.exerciseRows.values()).map(ex => ({
                    name: ex.name,
                    setCount: ex.rows.length,
                    summary: summarizeExerciseEvidence(ex.name, ex.rows),
                }));
                const session = {
                    templateName: b.templateName,
                    completedAt: b.completedAt,
                    workoutDate: b.workoutDate,
                    exerciseCount: b.exerciseSet.size,
                    exercises,
                };
                session.summary = summarizeWorkoutSession(session);
                return session;
            })
            .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
            .slice(0, limit);
        return sessions;
    } catch (e) {
        return [];
    }
}

function formatDateKey(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
}

function formatCompactNumber(value, suffix = '') {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    const rounded = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
    return `${rounded}${suffix}`;
}

function averageNumeric(rows, key) {
    const values = (Array.isArray(rows) ? rows : [])
        .map(r => Number(r?.[key]))
        .filter(Number.isFinite);
    if (!values.length) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function dayOfChallenge(challenge, now = new Date()) {
    if (!challenge?.start_date) return null;
    const start = new Date(`${challenge.start_date}T00:00:00Z`);
    if (!Number.isFinite(start.getTime())) return null;
    return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1);
}

function daysUntilDate(dateKey, now = new Date()) {
    if (!dateKey) return null;
    const end = new Date(`${dateKey}T23:59:59Z`);
    if (!Number.isFinite(end.getTime())) return null;
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}

async function loadChallengeRank(challengeId, userId) {
    if (!challengeId || !userId) return null;
    try {
        const rows = await supabaseQuery(
            `challenge_participants?select=user_id,challenge_points,current_points,status&challenge_id=eq.${challengeId}&status=eq.accepted&order=challenge_points.desc&limit=200`
        );
        const idx = rows.findIndex(r => r.user_id === userId);
        if (idx < 0) return null;
        const above = idx > 0 ? rows[idx - 1] : null;
        return {
            rank: idx + 1,
            total: rows.length,
            gapToNext: above ? Math.max(0, Number(above.challenge_points || 0) - Number(rows[idx].challenge_points || 0)) : 0,
        };
    } catch (e) {
        return null;
    }
}

async function loadChallengeContext(userId, now = new Date()) {
    if (!userId) return [];
    try {
        const participants = await supabaseQuery(
            `challenge_participants?select=challenge_id,status,current_points,challenge_points,starting_points,accepted_at,invited_at,weight_goal,milestone_progress&user_id=eq.${userId}&status=in.(accepted,invited,pending)&order=accepted_at.desc.nullslast,invited_at.desc.nullslast&limit=8`
        );
        const ids = participants.map(p => p.challenge_id).filter(Boolean);
        if (!ids.length) return [];
        const challenges = await supabaseQuery(
            `challenges?select=id,name,challenge_type,status,start_date,end_date,duration_days,cohort_type,is_system_cohort&id=in.(${ids.join(',')})&limit=20`
        ).catch(() => []);
        const challengeById = new Map(challenges.map(c => [c.id, c]));
        const active = participants
            .map(p => ({ participant: p, challenge: challengeById.get(p.challenge_id) || null }))
            .filter(item => item.challenge && item.challenge.status !== 'completed' && item.challenge.status !== 'canceled');

        const withRanks = [];
        for (const item of active) {
            const rank = item.participant.status === 'accepted'
                ? await loadChallengeRank(item.participant.challenge_id, userId)
                : null;
            withRanks.push({ ...item, rank });
        }
        return withRanks.map(({ participant, challenge, rank }) => {
            const day = dayOfChallenge(challenge, now);
            const duration = Number(challenge.duration_days || 0) || null;
            const daysLeft = daysUntilDate(challenge.end_date, now);
            const points = Number(participant.challenge_points ?? participant.current_points ?? 0);
            const parts = [
                `${challenge.name || 'Challenge'} (${challenge.challenge_type || 'challenge'}, ${participant.status})`,
                day && duration ? `day ${Math.min(day, duration)}/${duration}` : '',
                daysLeft != null ? `${daysLeft}d left` : '',
                Number.isFinite(points) ? `${points} pts` : '',
                rank ? `rank ${rank.rank}/${rank.total}${rank.gapToNext ? `, ${rank.gapToNext} pts behind next` : ', leading/tied at top'}` : '',
                participant.weight_goal ? `weight goal: ${participant.weight_goal}` : '',
            ].filter(Boolean);
            return `- ${parts.join(', ')}`;
        });
    } catch (e) {
        return [];
    }
}

async function loadWeeklyAppContext(userId, options = {}) {
    if (!userId) return { text: '', recentWorkoutEvidence: '' };
    const now = options.now || new Date();
    const lookbackDays = Number(options.lookbackDays || 7);
    const since = new Date(now.getTime() - lookbackDays * 86400000);
    const sinceIso = since.toISOString();
    const sinceDate = sinceIso.slice(0, 10);

    const [
        challengeLines,
        workouts,
        moods,
        nutrition,
        weighIns,
        checkins,
        points,
        progressPhotos,
        userPoints,
    ] = await Promise.all([
        loadChallengeContext(userId, now),
        loadRecentWorkouts(userId, sinceIso, 5),
        supabaseQuery(`mood_logs?select=mood_score,energy_score,stress_score,created_at,log_date&user_id=eq.${userId}&created_at=gte.${sinceIso}&order=created_at.desc&limit=7`).catch(() => []),
        supabaseQuery(`daily_nutrition?select=nutrition_date,total_calories,total_protein_g,total_carbs_g,total_fat_g,total_fiber_g,meal_count,calorie_goal,protein_goal_g&user_id=eq.${userId}&nutrition_date=gte.${sinceDate}&order=nutrition_date.desc&limit=7`).catch(() => []),
        supabaseQuery(`daily_weigh_ins?select=weigh_in_date,weight_kg,body_fat_pct,created_at&user_id=eq.${userId}&weigh_in_date=gte.${sinceDate}&order=weigh_in_date.desc&limit=10`).catch(() => []),
        supabaseQuery(`daily_checkins?select=checkin_date,energy,equipment,sleep,water_intake,created_at&user_id=eq.${userId}&checkin_date=gte.${sinceDate}&order=checkin_date.desc&limit=7`).catch(() => []),
        supabaseQuery(`point_transactions?select=points_amount,reference_type,description,created_at&user_id=eq.${userId}&created_at=gte.${sinceIso}&order=created_at.desc&limit=12`).catch(() => []),
        supabaseQuery(`weekly_progress_photos?select=photo_week,created_at,notes&user_id=eq.${userId}&photo_week=gte.${sinceDate}&order=photo_week.desc&limit=3`).catch(() => []),
        supabaseQuery(`user_points?select=current_points,current_streak,meal_streak,workout_streak,total_meals_logged,total_workouts_logged,last_meal_date,last_workout_date&user_id=eq.${userId}&limit=1`).catch(() => []),
    ]);

    const lines = [];
    if (challengeLines.length) {
        lines.push(`Active challenges:\n${challengeLines.join('\n')}`);
    }

    const recentWorkoutEvidence = formatRecentWorkoutEvidence(workouts, 5);
    if (recentWorkoutEvidence) {
        lines.push(`Completed workouts in last ${lookbackDays}d:\n${recentWorkoutEvidence}`);
    }

    if (nutrition.length) {
        const latest = nutrition[0];
        const avgProtein = averageNumeric(nutrition, 'total_protein_g');
        const avgCalories = averageNumeric(nutrition, 'total_calories');
        const latestNutrition = [
            `${latest.nutrition_date}: ${formatCompactNumber(latest.total_calories, ' cal')}`,
            formatCompactNumber(latest.total_protein_g, 'g protein'),
            latest.meal_count != null ? `${latest.meal_count} meals` : '',
            latest.protein_goal_g ? `protein goal ${formatCompactNumber(latest.protein_goal_g, 'g')}` : '',
        ].filter(Boolean).join(', ');
        lines.push(`Nutrition logged ${nutrition.length}/${lookbackDays}d. Latest: ${latestNutrition}. Averages: ${avgCalories != null ? formatCompactNumber(avgCalories, ' cal') : 'n/a'}, ${avgProtein != null ? formatCompactNumber(avgProtein, 'g protein') : 'n/a'}.`);
    }

    if (moods.length) {
        const latest = moods[0];
        const latestMood = [
            latest.mood_score != null ? `mood ${latest.mood_score}/10` : '',
            latest.energy_score != null ? `energy ${latest.energy_score}/10` : '',
            latest.stress_score != null ? `stress ${latest.stress_score}/10` : '',
        ].filter(Boolean).join(', ');
        if (latestMood) lines.push(`Latest mood log (${formatDateKey(latest.log_date || latest.created_at)}): ${latestMood}.`);
    }

    if (checkins.length) {
        const latest = checkins[0];
        const latestCheckin = [
            latest.energy ? `energy ${latest.energy}` : '',
            latest.sleep ? `sleep ${latest.sleep}` : '',
            latest.equipment ? `equipment ${latest.equipment}` : '',
            latest.water_intake != null ? `water ${latest.water_intake}` : '',
        ].filter(Boolean).join(', ');
        if (latestCheckin) lines.push(`Daily check-ins ${checkins.length}/${lookbackDays}d. Latest: ${latestCheckin}.`);
    }

    if (weighIns.length) {
        const latest = weighIns[0];
        const oldest = weighIns[weighIns.length - 1];
        const change = Number(latest.weight_kg) - Number(oldest.weight_kg);
        const changeText = weighIns.length > 1 && Number.isFinite(change)
            ? `, ${change >= 0 ? '+' : ''}${formatCompactNumber(change, 'kg')} over logged window`
            : '';
        lines.push(`Weigh-ins ${weighIns.length}/${lookbackDays}d. Latest ${formatDateKey(latest.weigh_in_date || latest.created_at)}: ${formatCompactNumber(latest.weight_kg, 'kg')}${changeText}.`);
    }

    const up = userPoints[0];
    if (up) {
        const streaks = [
            up.current_streak != null ? `overall streak ${up.current_streak}` : '',
            up.workout_streak != null ? `workout streak ${up.workout_streak}` : '',
            up.meal_streak != null ? `meal streak ${up.meal_streak}` : '',
            up.current_points != null ? `${up.current_points} current XP` : '',
        ].filter(Boolean);
        if (streaks.length) lines.push(`Streaks/XP: ${streaks.join(', ')}.`);
    }

    if (points.length) {
        const total = points.reduce((sum, p) => sum + (Number(p.points_amount) || 0), 0);
        const recent = points.slice(0, 4)
            .map(p => `${formatCompactNumber(p.points_amount, ' pts')} ${cleanWorkoutField(p.reference_type || p.description || 'activity', 40)}`)
            .filter(Boolean)
            .join('; ');
        lines.push(`Point activity last ${lookbackDays}d: ${total} pts${recent ? ` (${recent})` : ''}.`);
    }

    if (progressPhotos.length) {
        lines.push(`Progress photo uploaded this week: ${progressPhotos[0].photo_week}${progressPhotos[0].notes ? `, note: ${cleanWorkoutField(progressPhotos[0].notes, 120)}` : ''}.`);
    }

    return {
        text: lines.join('\n'),
        recentWorkoutEvidence,
        challengeLines,
    };
}

// ============================================================
// Onboarding phase detector
// ------------------------------------------------------------
// Returns whether a client is still in the first 72h of their
// relationship with the coach AND whether any challenge has been
// accepted between them yet. Onboarding mode is only for the setup
// conversation before that shared challenge is accepted.
// ============================================================

async function loadOnboardingPhase(coachId, clientId, { windowHours = 72 } = {}) {
    const phase = { inOnboarding: false, hoursSinceAssigned: null, challengeAccepted: false, onboardingFacts: [] };
    if (!coachId || !clientId) return phase;

    try {
        const rows = await supabaseQuery(
            `coach_clients?select=assigned_at,status&coach_id=eq.${coachId}&client_id=eq.${clientId}&order=assigned_at.desc&limit=1`
        );
        if (!rows[0]?.assigned_at) return phase;
        const assignedMs = new Date(rows[0].assigned_at).getTime();
        const hours = (Date.now() - assignedMs) / 36e5;
        phase.hoursSinceAssigned = Math.round(hours * 10) / 10;
        phase.inOnboarding = hours <= windowHours && rows[0].status !== 'paused' && rows[0].status !== 'ended';
    } catch (e) { /* non-critical */ }

    if (!phase.inOnboarding) return phase;

    // Has a challenge ever been accepted by BOTH coach and client?
    try {
        const accepted = await supabaseQuery(
            `challenge_participants?select=challenge_id,user_id&user_id=in.(${coachId},${clientId})&status=eq.accepted&limit=40`
        );
        const byChallenge = new Map();
        for (const row of accepted) {
            const set = byChallenge.get(row.challenge_id) || new Set();
            set.add(row.user_id);
            byChallenge.set(row.challenge_id, set);
        }
        for (const [, userIds] of byChallenge) {
            if (userIds.has(coachId) && userIds.has(clientId)) {
                phase.challengeAccepted = true;
                break;
            }
        }
    } catch (e) { /* non-critical */ }

    if (phase.challengeAccepted) {
        phase.inOnboarding = false;
        phase.completedReason = 'challenge_accepted';
        return phase;
    }

    // Pull onboarding quiz facts for the prompt anchor
    try {
        const uf = await supabaseQuery(`user_facts?select=personal_details&user_id=eq.${clientId}&limit=1`);
        const pd = uf[0]?.personal_details || {};
        if (pd.weight && pd.goal_weight) {
            const delta = Math.round(pd.weight - pd.goal_weight);
            if (delta > 0) phase.onboardingFacts.push(`Goal weight: ${pd.weight}kg → ${pd.goal_weight}kg (${delta}kg to lose)`);
            else if (delta < 0) phase.onboardingFacts.push(`Goal weight: ${pd.weight}kg → ${pd.goal_weight}kg (${Math.abs(delta)}kg to gain)`);
        }
        if (pd.goalBodyType) phase.onboardingFacts.push(`Body type goal: ${pd.goalBodyType}`);
        if (pd.training_frequency) phase.onboardingFacts.push(`Training frequency: ${pd.training_frequency}x/week`);
        if (pd.equipment_access) phase.onboardingFacts.push(`Equipment: ${pd.equipment_access}`);
        const exercisePrefs = pd.exercise_preferences || {};
        if (Array.isArray(exercisePrefs.liked_exercises) && exercisePrefs.liked_exercises.length) {
            phase.onboardingFacts.push(`Liked exercises: ${exercisePrefs.liked_exercises.slice(0, 8).join(', ')}`);
        }
        if (Array.isArray(exercisePrefs.avoided_exercises) && exercisePrefs.avoided_exercises.length) {
            phase.onboardingFacts.push(`Exercises to avoid: ${exercisePrefs.avoided_exercises.slice(0, 8).join(', ')}`);
        }
        if (pd.dietary_preference) phase.onboardingFacts.push(`Diet: ${pd.dietary_preference}`);
        if (pd.activity_level) phase.onboardingFacts.push(`Activity level: ${pd.activity_level}`);
    } catch (e) { /* non-critical */ }

    return phase;
}

// ============================================================
// Chat photo inlining — turn [PHOTO:url] markers in a client message
// into Gemini `inlineData` parts so the model can actually see the image
// ============================================================

const PHOTO_MARKER_RE = /\[PHOTO:(https?:\/\/[^\s\]]+)\]/gi;
const PHOTO_MAX_COUNT = 3;
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;   // 4 MB per image
const PHOTO_FETCH_TIMEOUT_MS = 8000;
const AUDIO_MARKER_RE = /\[AUDIO:(https?:\/\/[^\s\]]+)\]/gi;
const AUDIO_MAX_COUNT = 2;
const AUDIO_MAX_BYTES = 10 * 1024 * 1024;  // 10 MB per voice note/audio clip
const AUDIO_FETCH_TIMEOUT_MS = 12000;

/**
 * Extract all `[PHOTO:https://...]` URLs from a message string in document order.
 * chat-widget / dashboard-script-6 emits exactly this format when a client or
 * coach sends a photo through the DM.
 */
function extractPhotoUrls(message) {
    if (!message) return [];
    const urls = [];
    const re = new RegExp(PHOTO_MARKER_RE.source, PHOTO_MARKER_RE.flags);
    let m;
    while ((m = re.exec(message)) !== null) {
        urls.push(m[1]);
        if (urls.length >= PHOTO_MAX_COUNT) break;
    }
    return urls;
}

/**
 * Replace `[PHOTO:url]` markers with `replacement(index)` — used to rewrite
 * a message so the text the model sees references "[attached photo #1]"
 * instead of the raw B2 URL.
 */
function replacePhotoMarkers(message, replacement) {
    if (!message) return message;
    let i = 0;
    return message.replace(PHOTO_MARKER_RE, () => replacement(++i));
}

function extractAudioUrls(message) {
    if (!message) return [];
    const urls = [];
    const re = new RegExp(AUDIO_MARKER_RE.source, AUDIO_MARKER_RE.flags);
    let m;
    while ((m = re.exec(message)) !== null) {
        urls.push(m[1]);
        if (urls.length >= AUDIO_MAX_COUNT) break;
    }
    return urls;
}

function replaceAudioMarkers(message, replacement) {
    if (!message) return message;
    let i = 0;
    return message.replace(AUDIO_MARKER_RE, () => replacement(++i));
}

/**
 * Fetch a chat photo URL and return it as a Gemini-compatible `inlineData`
 * part `{ mimeType, data: base64 }`. Returns null on failure (unreachable,
 * non-image content, too big, wrong content-type) so the caller can fall
 * back to text-only gracefully.
 */
async function fetchPhotoAsInlineData(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS);
    try {
        // Meta's image CDNs (lookaside.fbsbx.com for IG, scontent*.fbcdn.net for
        // Messenger) can return 4xx or non-image content when the request looks
        // like a bot. Send realistic browser headers so the signed-URL flow
        // resolves to the actual image bytes.
        const res = await fetch(url, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
            },
        });
        if (!res.ok) {
            console.warn(`[photo-inline] fetch ${res.status} ${url}`);
            return null;
        }
        const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!contentType.startsWith('image/')) {
            console.warn(`[photo-inline] non-image content-type=${contentType} ${url}`);
            return null;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > PHOTO_MAX_BYTES) {
            console.warn(`[photo-inline] too large bytes=${buf.length} ${url}`);
            return null;
        }
        console.log(`[photo-inline] ok bytes=${buf.length} ct=${contentType} ${url.slice(0, 60)}…`);
        return { mimeType: contentType, data: buf.toString('base64') };
    } catch (e) {
        console.warn(`[photo-inline] fetch failed ${url}: ${e.message}`);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function guessAudioMimeType(url, contentType) {
    const ct = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (ct.startsWith('audio/')) return ct;
    // Some voice-note CDNs label audio-only MP4/WebM files as video.
    if (ct === 'video/mp4' || ct === 'video/webm' || ct === 'application/ogg') return ct;
    const lower = String(url || '').toLowerCase();
    if (/\.(mp3|mpeg)(\?|#|$)/i.test(lower)) return 'audio/mpeg';
    if (/\.(m4a|aac)(\?|#|$)/i.test(lower)) return 'audio/mp4';
    if (/\.(wav)(\?|#|$)/i.test(lower)) return 'audio/wav';
    if (/\.(ogg|oga|opus)(\?|#|$)/i.test(lower)) return 'audio/ogg';
    if (/\.(flac)(\?|#|$)/i.test(lower)) return 'audio/flac';
    if (/\.(amr|3ga)(\?|#|$)/i.test(lower)) return 'audio/amr';
    return null;
}

async function fetchAudioAsInlineData(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AUDIO_FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                'Accept': 'audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/*,video/mp4,video/webm,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Dest': 'audio',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
            },
        });
        if (!res.ok) {
            console.warn(`[audio-inline] fetch ${res.status} ${url}`);
            return null;
        }
        const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        const mimeType = guessAudioMimeType(url, contentType);
        if (!mimeType) {
            console.warn(`[audio-inline] non-audio content-type=${contentType} ${url}`);
            return null;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > AUDIO_MAX_BYTES) {
            console.warn(`[audio-inline] too large bytes=${buf.length} ${url}`);
            return null;
        }
        console.log(`[audio-inline] ok bytes=${buf.length} ct=${mimeType} ${url.slice(0, 60)}…`);
        return { mimeType, data: buf.toString('base64') };
    } catch (e) {
        console.warn(`[audio-inline] fetch failed ${url}: ${e.message}`);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Given a raw client message that may contain `[PHOTO:url]` markers, fetch
 * up to {@link PHOTO_MAX_COUNT} of the referenced images and return the
 * Gemini `inlineData` parts plus a rewritten text where each marker has
 * been replaced with `[attached photo #N]`.
 *
 * Failures (404, timeout, non-image) simply drop that image — the rewritten
 * text still references it as `[attached photo #N]` so the caller's prompt
 * remains coherent with however many images actually made it through.
 */
async function buildMessageImageParts(message) {
    const urls = extractPhotoUrls(message);
    if (urls.length === 0) return { imageParts: [], rewrittenMessage: message };

    const fetched = await Promise.all(urls.map(fetchPhotoAsInlineData));
    const imageParts = fetched
        .filter(Boolean)
        .map(p => ({ inlineData: p }));

    const rewrittenMessage = replacePhotoMarkers(message, n => `[attached photo #${n}]`);
    return { imageParts, rewrittenMessage };
}

async function buildMessageMediaParts(message) {
    const photoUrls = extractPhotoUrls(message);
    const audioUrls = extractAudioUrls(message);
    if (photoUrls.length === 0 && audioUrls.length === 0) {
        return {
            imageParts: [],
            audioParts: [],
            mediaParts: [],
            rewrittenMessage: message,
            photoUrlCount: 0,
            audioUrlCount: 0,
        };
    }

    const [fetchedPhotos, fetchedAudio] = await Promise.all([
        Promise.all(photoUrls.map(fetchPhotoAsInlineData)),
        Promise.all(audioUrls.map(fetchAudioAsInlineData)),
    ]);
    const imageParts = fetchedPhotos
        .filter(Boolean)
        .map(p => ({ inlineData: p }));
    const audioParts = fetchedAudio
        .filter(Boolean)
        .map(p => ({ inlineData: p }));

    const rewrittenWithPhotos = replacePhotoMarkers(message, n => `[attached photo #${n}]`);
    const rewrittenMessage = replaceAudioMarkers(rewrittenWithPhotos, n => `[voice note #${n}]`);
    return {
        imageParts,
        audioParts,
        mediaParts: [...imageParts, ...audioParts],
        rewrittenMessage,
        photoUrlCount: photoUrls.length,
        audioUrlCount: audioUrls.length,
    };
}

/**
 * Cancel any prior scheduled (Send-later) alerts for this (coach, client)
 * pair and return their reply text so the caller can fold them into the
 * fresh draft's prompt as "previously drafted but not sent" context.
 *
 * Why we cancel: when a new message arrives mid-wait, Shannon's old draft
 * was a reply to a stale view of the conversation. We don't want it to fire
 * after the new message lands and read like a non-sequitur.
 *
 * Why we keep the text: the model needs to see what Shannon was about to
 * send so it can either fold that intent into the new reply (when the new
 * message is a follow-up) or pivot away (when the new message changes the
 * topic). Without it, the new draft loses Shannon's prior framing.
 *
 * Returns an array of strings (the canceled scheduled_reply_text values).
 * Empty when nothing was scheduled — common case, fire-and-forget.
 */
async function cancelPriorScheduledForClient({ coachId, clientId }) {
    if (!coachId || !clientId) return [];
    let prior = [];
    try {
        prior = await supabaseQuery(
            `coach_alerts?select=id,scheduled_reply_text,suggested_message,data&coach_id=eq.${coachId}&client_id=eq.${clientId}&status=eq.scheduled`
        );
    } catch (e) {
        console.warn('[cancel-prior-scheduled] lookup failed:', e.message);
        return [];
    }
    if (!prior || prior.length === 0) return [];

    const texts = [];
    for (const alert of prior) {
        // Atomic flip — another worker could have claimed this row in the
        // millisecond between our SELECT and PATCH. If the PATCH affects 0
        // rows, treat it as "already gone" and skip.
        try {
            const updated = await supabaseQuery(
                `coach_alerts?id=eq.${alert.id}&status=eq.scheduled`,
                {
                    method: 'PATCH',
                    body: {
                        status: 'canceled',
                        actioned_at: new Date().toISOString(),
                        data: {
                            ...(alert.data || {}),
                            cancel_reason: 'superseded_by_new_message',
                            canceled_at: new Date().toISOString(),
                        },
                    },
                    prefer: 'return=representation',
                }
            );
            if (updated.length === 0) continue;
        } catch (e) {
            console.warn(`[cancel-prior-scheduled] cancel ${alert.id} failed:`, e.message);
            continue;
        }
        const text = (alert.scheduled_reply_text || alert.suggested_message || '').trim();
        if (text) texts.push(text);
    }
    if (texts.length > 0) {
        console.log(`[cancel-prior-scheduled] canceled ${texts.length} scheduled alert(s) for client ${clientId}`);
    }
    return texts;
}

/**
 * IG/Messenger sibling of cancelPriorScheduledForClient. Cold ManyChat leads
 * have no users.id so we key on the ig_thread_id stored in alert.data — same
 * primitive the IG draft producer's coalescing logic uses.
 *
 * Returns the canceled scheduled_reply_text values, joined chunks where
 * applicable.
 */
async function cancelPriorScheduledForIgThread({ igThreadId }) {
    if (!igThreadId) return [];
    let prior = [];
    try {
        prior = await supabaseQuery(
            `coach_alerts?select=id,scheduled_reply_text,suggested_message,data&data->>ig_thread_id=eq.${igThreadId}&status=eq.scheduled`
        );
    } catch (e) {
        console.warn('[cancel-prior-scheduled-ig] lookup failed:', e.message);
        return [];
    }
    if (!prior || prior.length === 0) return [];

    const texts = [];
    for (const alert of prior) {
        try {
            const updated = await supabaseQuery(
                `coach_alerts?id=eq.${alert.id}&status=eq.scheduled`,
                {
                    method: 'PATCH',
                    body: {
                        status: 'canceled',
                        actioned_at: new Date().toISOString(),
                        data: {
                            ...(alert.data || {}),
                            cancel_reason: 'superseded_by_new_message',
                            canceled_at: new Date().toISOString(),
                        },
                    },
                    prefer: 'return=representation',
                }
            );
            if (updated.length === 0) continue;
        } catch (e) {
            console.warn(`[cancel-prior-scheduled-ig] cancel ${alert.id} failed:`, e.message);
            continue;
        }
        const text = (alert.scheduled_reply_text || alert.suggested_message || '').trim();
        if (text) texts.push(text);
    }
    if (texts.length > 0) {
        console.log(`[cancel-prior-scheduled-ig] canceled ${texts.length} scheduled alert(s) for ig_thread ${igThreadId}`);
    }
    return texts;
}

/**
 * From a chronologically-ordered conversation history, pull the streak of
 * inbound messages the client has sent since Shannon's last reply (or since
 * the start of history if he never replied yet). The returned array does NOT
 * include the current/just-arrived message — that's what `messageText`
 * already represents to the caller. Capped at `max` to keep the payload
 * size bounded (notification + FCM + admin dashboard all consume this).
 *
 * Used for the "show all the messages this draft was generated from" UX:
 * when a client double- or triple-messages, Shannon needs to see every one
 * of those inbounds, not just the latest, so he can verify the draft
 * actually addresses everything.
 *
 * `history` — array of { sender_id, message, created_at }, oldest → newest.
 *   This is what loadConversationContext returns in instant-coach-draft.
 *
 * `clientId` — id we treat as "inbound from the client". Anything else in
 *   the history is treated as Shannon (an outbound) and ends the streak.
 *
 * Returns: [{ text, created_at }, ...] in chronological order. Empty when
 * the most recent prior message was from Shannon (i.e. the current message
 * is the first new one since he replied).
 */
function selectRecentInboundSinceLastReply({ history, clientId, max = 5 }) {
    if (!Array.isArray(history) || history.length === 0) return [];
    const collected = [];
    // Walk from newest to oldest. Stop the moment we hit a non-client entry
    // (Shannon's prior reply). Then reverse so output is chronological.
    for (let i = history.length - 1; i >= 0; i--) {
        const m = history[i];
        if (!m) continue;
        if (m.sender_id !== clientId) break;
        collected.push({
            text: String(m.message || '').trim(),
            created_at: m.created_at || null,
        });
        if (collected.length >= max) break;
    }
    return collected.filter(m => m.text).reverse();
}

/**
 * IG/FB sibling: the IG history shape uses `direction: 'in'|'out'` instead
 * of a sender_id. Same semantic — collect the trailing streak of inbound
 * messages, stop at the first outbound. Excludes the current message
 * (caller filters it out before passing in).
 */
// ============================================================
// Lifecycle stage resolution
// ------------------------------------------------------------
// Single source of truth for "where is this person in the funnel" — used
// by both the IG/FB and in-app draft producers to stamp a coloured dot on
// every coach push. Shannon scans dozens of incoming DMs a day and the
// dot tells him instantly whether the person is a cold lead he's still
// qualifying, a free-trial member in their 30-day window, a paying
// customer, or someone who churned. The qualifier strip already covers
// the lead-only stage progression (S1–S4) — this layer covers the
// outer lifecycle that contains the qualifier as one slice.
//
// Resolution priority:
//   1. user-level state (subscription / cohort) — wins when we have a
//      userId, because "paying" trumps any prior lead_stage.
//   2. ig_threads.lead_stage — the qualifier funnel for cold leads who
//      haven't converted yet.
//   3. fallback: churned (we have a userId but no positive signal —
//      either a lapsed trial or a direct signup who never paid).
// ============================================================

const LIFECYCLE_STAGES = {
    lead:           { stage: 'lead',            dot: '🔵', label: 'Lead' },
    invited:        { stage: 'invited',         dot: '🟡', label: 'Invited' },
    trial:          { stage: 'trial',           dot: '🟢', label: 'Free trial' },
    trial_expiring: { stage: 'trial_expiring',  dot: '🟠', label: 'Trial ending' },
    paying:         { stage: 'paying',          dot: '💎', label: 'Paying' },
    churned:        { stage: 'churned',         dot: '⚫', label: 'Churned' },
};

const TRIAL_EXPIRING_DAYS = 7;

const CHURNED_SUBSCRIPTION_STATES = new Set([
    'canceled',
    'past_due',
    'unpaid',
    'incomplete_expired',
]);

/**
 * Resolve the lifecycle stage for a person. Pass `userId` (in-app user)
 * and/or `leadStage` (from `ig_threads.lead_stage`) — the helper picks the
 * most informative signal and returns one of the LIFECYCLE_STAGES values.
 *
 * Always succeeds. On Supabase errors we swallow and fall through to the
 * lead_stage check rather than blocking the push — a missing dot is
 * acceptable, a delayed notification is not.
 */
async function resolveLifecycleStage({ userId, leadStage } = {}) {
    if (userId) {
        try {
            const users = await supabaseQuery(
                `users?select=subscription_status&id=eq.${userId}&limit=1`
            );
            const sub = users[0]?.subscription_status;
            if (sub === 'active') return LIFECYCLE_STAGES.paying;
            if (sub && CHURNED_SUBSCRIPTION_STATES.has(sub)) return LIFECYCLE_STAGES.churned;
            // null / 'trialing' / unknown — fall through to cohort check
        } catch (e) {
            console.warn('[lifecycle] subscription lookup failed:', e.message);
        }

        try {
            // Active enrollment in a system 30-day cohort = the free trial.
            // We pick the most recent active one in case the user re-enrolled.
            const participants = await supabaseQuery(
                `challenge_participants?select=challenges!inner(cohort_type,end_date,status,is_system_cohort)`
                + `&user_id=eq.${userId}&status=eq.accepted`
                + `&challenges.is_system_cohort=eq.true`
                + `&challenges.cohort_type=eq.plant_based_30`
                + `&challenges.status=eq.active`
                + `&order=challenges(end_date).desc&limit=1`
            );
            const endRaw = participants[0]?.challenges?.end_date;
            if (endRaw) {
                const daysLeft = Math.ceil((Date.parse(endRaw) - Date.now()) / 86400000);
                if (daysLeft <= 0) return LIFECYCLE_STAGES.churned;
                if (daysLeft <= TRIAL_EXPIRING_DAYS) return LIFECYCLE_STAGES.trial_expiring;
                return LIFECYCLE_STAGES.trial;
            }
        } catch (e) {
            console.warn('[lifecycle] cohort lookup failed:', e.message);
        }
    }

    if (leadStage === 'invited') return LIFECYCLE_STAGES.invited;
    if (leadStage === 'churned') return LIFECYCLE_STAGES.churned;
    if (leadStage === 'paying') return LIFECYCLE_STAGES.paying;
    if (leadStage === 'new' || leadStage === 'qualifying') return LIFECYCLE_STAGES.lead;

    // userId given but no positive signal = lapsed trial or direct signup
    // who never paid. Falling through with no userId at all = unknown,
    // also returns churned (defensive — the ig draft path always passes
    // either userId or leadStage, so this is the rare "neither" case).
    return LIFECYCLE_STAGES.churned;
}

// ============================================================
// Draft reasoning — one-sentence "why this draft" rationale
// ------------------------------------------------------------
// Two-pass design: the fine-tuned Vertex v7 model writes the draft as
// today (zero risk of voice-quality regression — its prompt is
// untouched), then a cheap Gemini Flash call explains, in ONE sentence,
// the strategic reason this particular draft fits this particular
// conversation. Surfaced in Control Center as "Why this draft" so
// Shannon can decide send / edit / skip with the model's reasoning
// alongside the draft itself.
//
// Each producer (incoming DM, IG, onboarding scan, PB, first workout,
// weekly check-in, plateau, badge, morning pulse) calls
// `generateDraftReasoning` after its draft is finalized, then writes
// the result onto coach_alerts.data.draft_reasoning via
// `updateAlertReasoning`. Failures degrade silently — a missing
// rationale just hides the Control Center accordion, never blocks the
// draft from shipping.
// ============================================================

const ALERT_TYPE_PURPOSES = {
    incoming_dm:        'the client just messaged the coach in-app',
    ig_incoming_dm:     'a lead messaged on Instagram',
    fb_incoming_dm:     'a lead messaged on Messenger',
    onboarding_welcome: 'this is the day-0 welcome message for a brand-new client',
    onboarding_day_3:   'this is the day-3 onboarding check-in',
    onboarding_day_7:   'this is the week-1 onboarding check-in',
    onboarding_day_14:  'this is the week-2 onboarding check-in',
    onboarding_day_30:  'this is the month-1 onboarding milestone check-in',
    win_to_celebrate:   'the client just hit a personal best',
    first_workout:      'the client just completed their first workout',
    weekly_checkin:     'this is the post-onboarding weekly check-in',
    plateau_reassess:   'the client has plateaued (weight or strength) past day 30',
    badge_earned:       'the client earned new milestone badges',
    inactive_client:    'the client has gone quiet — re-engagement nudge',
    unread_message:     'an unread DM has been sitting too long',
    challenge_dropout:  'the client has dropped off a challenge',
    streak_broken:      'a streak was broken',
    nutrition_gap:      'a nutrition pattern is off',
    workout_dropoff:    'workout frequency has dropped',
    meal_dropoff:       'meal-logging has dropped',
    mood_low:           'mood scores are low',
    mood_pattern:       'a mood pattern needs attention',
    wearable_insight:   'a wearable signal warrants a check-in',
    milestone_near:     'a milestone is within reach',
    coaching_idea:      'a coaching opportunity surfaced',
    general_idea:       'a general coaching idea',
    not_in_challenge:   'the client should be invited into the active challenge',
    new_user_onboarding:'a new user needs onboarding outreach',
    level_up:           'the client levelled up',
    comeback:           'the client is making a comeback after time off',
    checkin_due:        'a check-in is due',
};

/**
 * Generate a one-sentence "why this draft" rationale by asking Gemini
 * Flash to explain a draft post-hoc. Returns empty string on any
 * failure — the draft still ships without the rationale.
 *
 * `contextBlocks` is the relevant signal text the original draft
 * generator saw (recent messages, activity snapshot, memory, signal
 * reason, etc.) — concatenated by the caller into a single string so
 * this helper stays generator-agnostic. `clientName` makes the output
 * read naturally ("Sarah said X..." vs "the client said X...").
 */
async function generateDraftReasoning({ draftText, alertType, contextBlocks, clientName }) {
    if (!draftText) return '';
    const purpose = ALERT_TYPE_PURPOSES[alertType] || 'a coach reply was drafted';
    try {
        const prompt = `You're explaining to Shannon (a fitness coach) why his AI assistant chose to send this particular message to a client. In ONE short sentence — under 30 words — explain the strategic reason.

Don't restate the message. Don't be generic ("supportive", "encouraging"). Find the SPECIFIC thing in the context — a quote from the client, a recent stat, a missed workout, a memory note, a milestone — that this message is actually responding to. Quote-ground when you can.

PURPOSE: ${purpose}.
CLIENT: ${clientName || 'the client'}.

CONTEXT:
${contextBlocks || '(no context provided)'}

DRAFT:
${draftText}

Reply with just the one-sentence reason. No quotes around it. No preamble like "this draft" or "the reason is".`;

        const contents = [{ role: 'user', parts: [{ text: prompt }] }];
        const reply = await callGeminiFallback(contents, { maxOutputTokens: 200, temperature: 0.4 });
        return String(reply || '').trim()
            .replace(/^["']+|["']+$/g, '')
            .replace(/^\s*[-•*]\s*/, '');
    } catch (err) {
        console.warn('[draft-reasoning] generation failed:', err.message);
        return '';
    }
}

/**
 * Merge `draft_reasoning` into an existing coach_alerts.data column
 * via PATCH. PostgREST can't do partial JSON merge in a single call, so
 * we read-modify-write — safe because reasoning lands ~1s after insert
 * and no other writer touches data.draft_reasoning.
 *
 * Failure is non-fatal — the alert still has the draft, just no
 * reasoning surface in Control Center.
 */
async function updateAlertReasoning(alertId, reasoning) {
    if (!alertId || !reasoning) return;
    try {
        const rows = await supabaseQuery(`coach_alerts?select=data&id=eq.${alertId}&limit=1`);
        const current = rows[0]?.data || {};
        const merged = { ...current, draft_reasoning: reasoning };
        await supabaseQuery(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: { data: merged },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[draft-reasoning] alert update failed:', err.message);
    }
}

/**
 * Convenience wrapper: kick off reasoning generation + alert update as a
 * single fire-and-forget background promise so the caller's main path
 * (push dispatch, response return) doesn't have to await it. By the time
 * Shannon taps Control Center on the notification (typically several
 * seconds), the reasoning has landed on the alert row.
 */
function fireDraftReasoning({ alertId, draftText, alertType, contextBlocks, clientName }) {
    if (!alertId || !draftText) return;
    generateDraftReasoning({ draftText, alertType, contextBlocks, clientName })
        .then(reasoning => updateAlertReasoning(alertId, reasoning))
        .catch(e => console.warn('[draft-reasoning] background pipeline failed:', e.message));
}

// ============================================================
// Edit learning - compare Shannon's final send to the AI draft
// ------------------------------------------------------------
// Stores deterministic edit metrics on coach_alerts.data.edit_analysis and
// rewrites only the learned section of per-person coach_instructions.
// ============================================================

const EDIT_LEARNING_HEADER = 'Learned from Shannon edits:';
const EDIT_ANALYSIS_MODEL = 'gemini-edit-learning';
const EDIT_METRIC_TOKEN_LIMIT = 240;

function tokenizeForEditMetrics(text) {
    return (String(text || '').toLowerCase().match(/[a-z0-9]+(?:'[a-z0-9]+)?/g) || [])
        .filter(Boolean)
        .slice(0, EDIT_METRIC_TOKEN_LIMIT);
}

function lcsLength(a, b) {
    const left = Array.isArray(a) ? a : [];
    const right = Array.isArray(b) ? b : [];
    if (left.length === 0 || right.length === 0) return 0;
    let prev = new Array(right.length + 1).fill(0);
    let curr = new Array(right.length + 1).fill(0);
    for (let i = 1; i <= left.length; i++) {
        for (let j = 1; j <= right.length; j++) {
            curr[j] = left[i - 1] === right[j - 1]
                ? prev[j - 1] + 1
                : Math.max(prev[j], curr[j - 1]);
        }
        [prev, curr] = [curr, prev.fill(0)];
    }
    return prev[right.length] || 0;
}

function levenshteinDistance(a, b) {
    const s = String(a || '').slice(0, 2000);
    const t = String(b || '').slice(0, 2000);
    if (s === t) return 0;
    if (!s) return t.length;
    if (!t) return s.length;
    let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
    let curr = new Array(t.length + 1);
    for (let i = 1; i <= s.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= t.length; j++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[t.length] || 0;
}

function pct(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function calculateCoachEditMetrics(draftText, sentMessage) {
    const draft = normalizeCoachDraftText(draftText || '').trim();
    const final = normalizeCoachDraftText(sentMessage || '').trim();
    const draftTokens = tokenizeForEditMetrics(draft);
    const finalTokens = tokenizeForEditMetrics(final);
    const retained = lcsLength(draftTokens, finalTokens);
    const distance = levenshteinDistance(draft, final);
    const maxChars = Math.max(draft.length, final.length, 1);
    const finalAiPct = finalTokens.length ? pct((retained / finalTokens.length) * 100) : 0;
    const draftKeptPct = draftTokens.length ? pct((retained / draftTokens.length) * 100) : 0;
    return {
        was_edited: !!draft && !!final && draft !== final,
        draft_chars: draft.length,
        final_chars: final.length,
        draft_tokens: draftTokens.length,
        final_tokens: finalTokens.length,
        retained_tokens: retained,
        final_ai_generated_pct: finalAiPct,
        final_shannon_authored_pct: pct(100 - finalAiPct),
        draft_kept_pct: draftKeptPct,
        character_change_pct: pct((distance / maxChars) * 100),
    };
}

function normalizeAutoLearnedBullets(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/\n+/);
    const seen = new Set();
    const out = [];
    for (const item of raw) {
        let text = String(item || '')
            .replace(/^\s*[-*\u2022]\s*/, '')
            .replace(/\b(ai|automation|model|prompt|system)\b/ig, 'draft')
            .replace(/\s+/g, ' ')
            .trim();
        if (!text) continue;
        text = truncate(text, 180);
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= 6) break;
    }
    return out;
}

function splitCoachInstructionSections(value) {
    const text = String(value || '').trim();
    if (!text) return { manual: '', autoBullets: [] };
    const idx = text.toLowerCase().lastIndexOf(EDIT_LEARNING_HEADER.toLowerCase());
    if (idx < 0) return { manual: text, autoBullets: [] };
    return {
        manual: text.slice(0, idx).trim(),
        autoBullets: normalizeAutoLearnedBullets(text.slice(idx + EDIT_LEARNING_HEADER.length)),
    };
}

function buildCoachInstructionsWithEditLearning(manual, autoBullets) {
    const cleanManual = String(manual || '').trim();
    const bullets = normalizeAutoLearnedBullets(autoBullets);
    if (bullets.length === 0) return cleanManual || null;
    return [
        cleanManual,
        `${EDIT_LEARNING_HEADER}\n${bullets.map(b => `- ${b}`).join('\n')}`,
    ].filter(Boolean).join('\n\n').trim();
}

function parseCoachEditAnalysisJson(text) {
    const cleaned = stripMarkdownFence(String(text || '').trim());
    try {
        return JSON.parse(cleaned);
    } catch (_) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('edit_analysis_json_missing');
        return JSON.parse(match[0]);
    }
}

function normalizeCoachEditLearningPayload(value) {
    const data = value && typeof value === 'object' ? value : {};
    return {
        summary: truncate(String(data.summary || '').trim(), 260),
        change_types: normalizeAutoLearnedBullets(data.change_types || data.changeTypes).slice(0, 6),
        lessons: normalizeAutoLearnedBullets(data.lessons || data.learning || data.rules).slice(0, 6),
        auto_instructions: normalizeAutoLearnedBullets(data.auto_instructions || data.autoInstructions || data.updated_auto_instructions),
        should_update_prompt: data.should_update_prompt !== false,
        confidence: Math.max(0, Math.min(1, Number(data.confidence) || 0)),
    };
}

async function updateAlertEditAnalysis(alertId, editAnalysis) {
    if (!alertId || !editAnalysis) return;
    try {
        const rows = await supabaseQuery(`coach_alerts?select=data&id=eq.${encodeURIComponent(alertId)}&limit=1`);
        const current = rows[0]?.data || {};
        await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
            method: 'PATCH',
            body: { data: { ...current, edit_analysis: editAnalysis } },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[edit-learning] alert analysis update failed:', err.message);
    }
}

async function resolveEditLearningTarget(alert) {
    const data = alert?.data || {};
    if (alert?.coach_id && alert?.client_id) {
        const rows = await supabaseQuery(
            `client_memory?select=coach_instructions&coach_id=eq.${alert.coach_id}&client_id=eq.${alert.client_id}&limit=1`
        ).catch(() => []);
        return {
            type: 'client_memory',
            coachId: alert.coach_id,
            clientId: alert.client_id,
            existingInstructions: rows[0]?.coach_instructions || '',
        };
    }
    if (data.ig_thread_id) {
        const rows = await supabaseQuery(
            `ig_threads?select=coach_instructions&id=eq.${encodeURIComponent(data.ig_thread_id)}&limit=1`
        ).catch(() => []);
        return {
            type: 'ig_threads',
            igThreadId: data.ig_thread_id,
            existingInstructions: rows[0]?.coach_instructions || '',
        };
    }
    return null;
}

async function saveEditLearningInstructions(target, value) {
    if (target?.type === 'client_memory' && target.coachId && target.clientId) {
        await supabaseQuery('client_memory?on_conflict=coach_id,client_id', {
            method: 'POST',
            body: [{
                coach_id: target.coachId,
                client_id: target.clientId,
                coach_instructions: value || null,
            }],
            prefer: 'resolution=merge-duplicates,return=minimal',
        });
        return true;
    }
    if (target?.type === 'ig_threads' && target.igThreadId) {
        await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(target.igThreadId)}`, {
            method: 'PATCH',
            body: { coach_instructions: value || null },
            prefer: 'return=minimal',
        });
        return true;
    }
    return false;
}

async function generateCoachEditLearning({ alert, draftText, sentMessage, metrics, existingInstructions, editReason }) {
    const { manual, autoBullets } = splitCoachInstructionSections(existingInstructions);
    const clientName = alert?.client_name || alert?.data?.profile_name || alert?.data?.ig_username || 'this person';
    const prompt = `You are Shannon's private edit-learning analyst.

Compare the original draft with Shannon's final sent message. Extract reusable rules for how future drafts should speak to this exact person.

Return ONLY valid JSON:
{
  "summary": "one short sentence describing the important edit",
  "change_types": ["shortened", "removed question"],
  "lessons": ["what this edit teaches"],
  "auto_instructions": ["complete replacement bullet list for the Learned from Shannon edits section"],
  "should_update_prompt": true,
  "confidence": 0.0
}

Rules:
- auto_instructions is cumulative. Keep useful existing learned bullets, remove duplicates, and add the new lesson only if it will help future replies to this person.
- Max 6 auto_instructions bullets. Each bullet must be a direct instruction for future drafts.
- Never add client-facing words like AI, automation, model, prompt, or system.
- Do not rewrite Shannon's manual instructions. You only control the learned bullet list.
- If the edit is only spelling, punctuation, or a one-off fact correction, set should_update_prompt=false.

CLIENT: ${clientName}
ALERT TYPE: ${alert?.alert_type || 'unknown'}
CHANNEL: ${alert?.data?.channel || 'in_app'}
CLIENT MESSAGE PREVIEW: ${alert?.data?.message_preview || '(unknown)'}
SHANNON'S OPTIONAL EDIT REASON: ${editReason || '(none)'}

DETERMINISTIC EDIT METRICS:
final_ai_generated_pct=${metrics.final_ai_generated_pct}
final_shannon_authored_pct=${metrics.final_shannon_authored_pct}
draft_kept_pct=${metrics.draft_kept_pct}
character_change_pct=${metrics.character_change_pct}

SHANNON'S MANUAL INSTRUCTIONS (do not rewrite):
${manual || '(none)'}

CURRENT LEARNED BULLETS:
${autoBullets.length ? autoBullets.map(b => `- ${b}`).join('\n') : '(none)'}

ORIGINAL DRAFT:
${draftText}

SHANNON'S FINAL SENT MESSAGE:
${sentMessage}`;
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const reply = await callGeminiFallback(contents, { maxOutputTokens: 700, temperature: 0.2 });
    return normalizeCoachEditLearningPayload(parseCoachEditAnalysisJson(reply));
}

async function analyzeCoachEditAndUpdatePrompt({ alertId, draftText, sentMessage, source } = {}) {
    if (!alertId) return { ok: false, skipped: 'missing_alert_id' };
    const rows = await supabaseQuery(
        `coach_alerts?select=id,client_id,client_name,coach_id,alert_type,suggested_message,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
    );
    const alert = rows[0];
    if (!alert) return { ok: false, skipped: 'alert_not_found' };

    const data = alert.data || {};
    const draft = normalizeCoachDraftText(draftText || data.draft_text || alert.suggested_message || '').trim();
    const final = normalizeCoachDraftText(sentMessage || data.sent_message || '').trim();
    if (!draft || !final) return { ok: false, skipped: 'missing_draft_or_final' };

    const metrics = calculateCoachEditMetrics(draft, final);
    const baseAnalysis = {
        ...metrics,
        source: source || data.sent_via || 'unknown',
        edit_reason: data.edit_reason || null,
        analyzed_at: new Date().toISOString(),
        analyzer_model: EDIT_ANALYSIS_MODEL,
    };

    if (!metrics.was_edited) {
        const editAnalysis = { ...baseAnalysis, summary: 'Sent as drafted.', change_types: [], lessons: [], prompt_updated: false, skipped: 'unchanged' };
        await updateAlertEditAnalysis(alertId, editAnalysis);
        return { ok: true, promptUpdated: false, editAnalysis };
    }

    const target = await resolveEditLearningTarget(alert);
    if (!target) {
        const editAnalysis = { ...baseAnalysis, summary: 'Edited reply captured, but no per-person prompt target was available.', change_types: [], lessons: [], prompt_updated: false, skipped: 'missing_learning_target' };
        await updateAlertEditAnalysis(alertId, editAnalysis);
        return { ok: true, promptUpdated: false, editAnalysis };
    }

    let learning;
    try {
        learning = await generateCoachEditLearning({
            alert,
            draftText: draft,
            sentMessage: final,
            metrics,
            existingInstructions: target.existingInstructions || '',
            editReason: data.edit_reason || '',
        });
    } catch (err) {
        const editAnalysis = {
            ...baseAnalysis,
            summary: 'Edit metrics captured, but qualitative learning failed.',
            change_types: [],
            lessons: [],
            prompt_updated: false,
            skipped: 'learning_generation_failed',
            error: truncate(err.message || String(err), 240),
            target: { type: target.type, client_id: target.clientId || null, ig_thread_id: target.igThreadId || null },
        };
        await updateAlertEditAnalysis(alertId, editAnalysis);
        return { ok: true, promptUpdated: false, editAnalysis };
    }

    const { manual } = splitCoachInstructionSections(target.existingInstructions || '');
    const enoughSignal = metrics.final_shannon_authored_pct >= 12
        || metrics.character_change_pct >= 15
        || !!data.edit_reason;
    let promptUpdated = false;
    if (learning.should_update_prompt && enoughSignal && learning.auto_instructions.length > 0) {
        const nextInstructions = buildCoachInstructionsWithEditLearning(manual, learning.auto_instructions) || '';
        if (nextInstructions.trim() !== String(target.existingInstructions || '').trim()) {
            try {
                promptUpdated = await saveEditLearningInstructions(target, nextInstructions);
            } catch (err) {
                console.warn('[edit-learning] prompt update failed:', err.message);
            }
        }
    }

    const editAnalysis = {
        ...baseAnalysis,
        summary: learning.summary || 'Shannon edited the draft.',
        change_types: learning.change_types,
        lessons: learning.lessons,
        learned_instructions: learning.auto_instructions,
        confidence: learning.confidence,
        prompt_updated: promptUpdated,
        skipped: promptUpdated ? null : (learning.should_update_prompt ? 'no_instruction_change' : 'one_off_or_low_signal'),
        target: { type: target.type, client_id: target.clientId || null, ig_thread_id: target.igThreadId || null },
    };
    await updateAlertEditAnalysis(alertId, editAnalysis);
    return { ok: true, promptUpdated, editAnalysis };
}

function fireCoachEditAnalysis({ alertId, draftText, sentMessage, source } = {}) {
    if (!alertId || !sentMessage) return;
    analyzeCoachEditAndUpdatePrompt({ alertId, draftText, sentMessage, source })
        .catch(e => console.warn('[edit-learning] background analysis failed:', e.message));
}

/**
 * Flat string fields for the FCM data payload — same shape as
 * summarizeForFcmData in qualifier-engine, so send-dm-notification can
 * forward them through to the device with no parsing.
 */
function lifecycleForFcmData(lifecycle) {
    if (!lifecycle) return {};
    return {
        lifecycleStage: lifecycle.stage || '',
        lifecycleDot: lifecycle.dot || '',
        lifecycleLabel: lifecycle.label || '',
    };
}

function selectRecentInboundSinceLastReplyIg({ history, max = 5 }) {
    if (!Array.isArray(history) || history.length === 0) return [];
    const collected = [];
    for (let i = history.length - 1; i >= 0; i--) {
        const m = history[i];
        if (!m) continue;
        if (m.direction !== 'in') break;
        collected.push({
            text: String(m.text || '').trim(),
            created_at: m.created_at || null,
        });
        if (collected.length >= max) break;
    }
    return collected.filter(m => m.text).reverse();
}

module.exports = {
    // constants (exposed for tests / scripts)
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    GEMINI_API_KEY,
    VERTEX_PROJECT_ID,
    VERTEX_ENDPOINT_ID,
    VERTEX_LOCATION,
    // utilities
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    loadOnboardingPhase,
    isAutoSendEnabled,
    maybeAutoSendDraft,
    cancelPriorScheduledForClient,
    cancelPriorScheduledForIgThread,
    selectRecentInboundSinceLastReply,
    selectRecentInboundSinceLastReplyIg,
    resolveLifecycleStage,
    lifecycleForFcmData,
    LIFECYCLE_STAGES,
    generateDraftReasoning,
    updateAlertReasoning,
    fireDraftReasoning,
    calculateCoachEditMetrics,
    analyzeCoachEditAndUpdatePrompt,
    fireCoachEditAnalysis,
    recentlyMessaged,
    isTestAccount,
    buildMemoryBlock,
    normalizeSex,
    loadClientProfileFacts,
    buildClientProfileBlock,
    buildCoachBioBlock,
    buildAppXpGuideBlock,
    buildNameUsePolicyBlock,
    buildRelationshipDiscoveryBlock,
    loadEditExamples,
    loadRecentWorkouts,
    formatRecentWorkoutEvidence,
    loadWeeklyAppContext,
    callVertexAIModel,
    callGeminiFallback,
    callVertexGeminiMultimodal,
    normalizeCoachDraftChunks,
    normalizeCoachDraftText,
    splitCoachDraftIntoDmBubbles,
    stripLeadingGreeting,
    truncate,
    truncateTail,
    formatCoachLocalTimestamp,
    formatTimedConversationLine,
    extractPhotoUrls,
    extractAudioUrls,
    replacePhotoMarkers,
    replaceAudioMarkers,
    buildMessageImageParts,
    buildMessageMediaParts,
};
