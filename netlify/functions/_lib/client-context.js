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
 *   - callGeminiFallback: Gemini 2.0 Flash for graceful degradation
 *   - stripLeadingGreeting: kills "hey Hannah," style openings (no greets)
 */

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
                personExamples = personRecent.filter(
                    e => e.data?.sent_message && e.data.sent_message !== e.suggested_message
                );
            } catch (e) { /* fall through to general only */ }
        }

        // General edit corpus (across all clients) — primary source when no
        // scope is given, fallback floor when scope is given but the person
        // has few edits.
        const generalRecent = await supabaseQuery(
            `coach_alerts?select=alert_type,suggested_message,data&status=eq.sent&data->>sent_message=not.is.null${typeFilter}&order=actioned_at.desc&limit=${lookback}`
        );
        const generalExamples = generalRecent.filter(
            e => e.data?.sent_message && e.data.sent_message !== e.suggested_message
        );

        const personSlice = personExamples.slice(0, max);
        const personSentMessages = new Set(personSlice.map(p => p.data.sent_message));

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
            .filter(g => !personSentMessages.has(g.data.sent_message))
            .slice(0, generalLimit);

        if (personSlice.length === 0 && generalSlice.length === 0) return '';

        const formatExample = (e, i) =>
            `Example ${i + 1}:\nAI draft: ${e.suggested_message}\nShannon rewrote it to: ${e.data.sent_message}`;

        let block = '';
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
    // gemini-2.5-flash is the current GA stable model (replaced 2.0-flash in
    // June 2025). Critical: the paid Tier 2 key returns 429 "Resource
    // exhausted" on the deprecated 2.0-flash endpoint -- looks like a rate
    // limit but is actually a model-deprecation rejection. 2.5-flash works
    // cleanly. Bumped maxOutputTokens default to 2048 because 2.5 uses
    // "thinking" tokens that count toward the output budget.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 2048, temperature: 0.8, ...generationConfig },
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini call failed: ${response.status} ${errText.slice(0, 500)}`);
    }
    const data = await response.json();
    return extractCandidateText(data, 'gemini');
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
 * Strips robotic "hey Hannah," / "hi there" / "yo" openers. All coach
 * drafts are replies in an ongoing relationship — real greetings are
 * almost never what Shannon actually sends.
 */
function stripLeadingGreeting(text) {
    if (!text) return text;
    let out = String(text).trim();
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
async function loadRecentWorkouts(userId, sinceIso, limit = 10) {
    try {
        // Pull enough rows to dedup. Cap wide — one client might log 30+ sets
        // per session; we need all of them to count exercises correctly.
        const rows = await supabaseQuery(
            `workouts?select=template_name,exercise_name,created_at,workout_date&user_id=eq.${userId}&created_at=gte.${sinceIso}&template_name=not.is.null&is_current_workout=eq.false&order=created_at.desc&limit=500`
        );
        const buckets = new Map();
        for (const r of rows) {
            if (!r.template_name) continue;
            const dateKey = (r.workout_date || (r.created_at || '').slice(0, 10));
            const key = `${r.template_name}__${dateKey}`;
            if (!buckets.has(key)) {
                buckets.set(key, {
                    templateName: r.template_name.trim(),
                    completedAt: r.created_at,
                    exerciseSet: new Set(),
                });
            }
            const b = buckets.get(key);
            if (r.exercise_name) b.exerciseSet.add(r.exercise_name.trim().toLowerCase());
            // Keep the newest created_at in the bucket
            if (r.created_at && r.created_at > b.completedAt) b.completedAt = r.created_at;
        }
        const sessions = Array.from(buckets.values())
            .map(b => ({ templateName: b.templateName, completedAt: b.completedAt, exerciseCount: b.exerciseSet.size }))
            .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
            .slice(0, limit);
        return sessions;
    } catch (e) {
        return [];
    }
}

// ============================================================
// Onboarding phase detector
// ------------------------------------------------------------
// Returns whether a client is still in the first 72h of their
// relationship with the coach AND whether any challenge has been
// accepted between them yet. Used by instant-coach-draft to shift
// the reply prompt into "still onboarding, keep the conversation
// going, drive toward the challenge invite" mode.
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
    recentlyMessaged,
    isTestAccount,
    buildMemoryBlock,
    buildCoachBioBlock,
    loadEditExamples,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    callVertexGeminiMultimodal,
    stripLeadingGreeting,
    truncate,
    extractPhotoUrls,
    replacePhotoMarkers,
    buildMessageImageParts,
};
