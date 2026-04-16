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
        throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
    }
    const text = await response.text();
    if (!text || text.trim() === '') return [];
    try { return JSON.parse(text); } catch { return []; }
}

// ============================================================
// Client memory (per-coach per-client relationship notes)
// See database/client_memory_migration.sql
// ============================================================

async function loadClientMemory(coachId, clientId) {
    try {
        const rows = await supabaseQuery(
            `client_memory?select=goals,communication_style,running_notes,injuries_limits,personal_context&coach_id=eq.${coachId}&client_id=eq.${clientId}&limit=1`
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
    if (parts.length === 0) return '';
    return `\n\nCLIENT MEMORY (what you know about this client):\n${parts.join('\n')}`;
}

// ============================================================
// Learn-from-edits — pull sent messages where Shannon edited the AI draft
// ============================================================

/**
 * Returns a formatted "LEARN FROM PAST EDITS" block for inclusion in prompts.
 * Queries coach_alerts for sent, edited messages. Falls back to '' on error
 * (non-critical — the pipeline still produces usable drafts without examples).
 *
 * @param {object} opts
 * @param {string=} opts.alertType      filter e.g. 'win_to_celebrate' — omit for any type
 * @param {number=} opts.lookback       rows to fetch (default 15)
 * @param {number=} opts.max            examples to include in block (default 6)
 * @param {string=} opts.label          block header — defaults to generic wording
 */
async function loadEditExamples({ alertType = null, lookback = 15, max = 6, label = null } = {}) {
    try {
        const filter = alertType ? `&alert_type=eq.${alertType}` : '';
        const recent = await supabaseQuery(
            `coach_alerts?select=alert_type,suggested_message,data&status=eq.sent&data->>sent_message=not.is.null${filter}&order=actioned_at.desc&limit=${lookback}`
        );
        const good = recent
            .filter(e => e.data?.sent_message && e.data.sent_message !== e.suggested_message)
            .slice(0, max);
        if (good.length === 0) return '';
        const header = label || 'LEARN FROM PAST EDITS — Shannon rewrote these AI drafts into how he actually talks. Mimic the SECOND version:';
        return '\n\n' + header + '\n\n' + good.map((e, i) =>
            `Example ${i + 1}:\nAI draft: ${e.suggested_message}\nShannon rewrote it to: ${e.data.sent_message}`
        ).join('\n\n');
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

async function callVertexAIModel(contents, generationConfig = {}) {
    const accessToken = await getVertexAIAccessToken();
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT_ID}/locations/${VERTEX_LOCATION}/endpoints/${VERTEX_ENDPOINT_ID}:generateContent`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 512, temperature: 0.8, ...generationConfig },
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vertex AI call failed: ${response.status} ${errText.slice(0, 500)}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGeminiFallback(contents, generationConfig = {}) {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { maxOutputTokens: 512, temperature: 0.8, ...generationConfig },
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini call failed: ${response.status} ${errText.slice(0, 500)}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
    loadClientMemory,
    isAutoSendEnabled,
    maybeAutoSendDraft,
    buildMemoryBlock,
    loadEditExamples,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
};
