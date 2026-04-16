/**
 * Instant Coach Draft — Event-Driven Function
 *
 * Fires the moment a client sends a DM to an admin/coach account.
 * Generates an AI draft reply in Shannon's voice and queues it as a
 * coach_alert so Shannon can review-edit-send in one tap.
 *
 * Trigger: DB trigger on nudges INSERT (see database/instant_coach_draft_trigger.sql)
 *
 * Flow:
 *   1. Verify receiver is an admin (reject otherwise)
 *   2. Skip "simple reply" messages (emoji-only, "ty", "👍", etc.) — don't waste Vertex calls
 *   3. Load recent conversation + client profile for context
 *   4. Call fine-tuned Shannon model (Vertex v7, fallback Gemini) to draft a reply
 *   5. Insert coach_alerts row with type='incoming_dm', priority='high'
 *   6. Fire a "draft ready" push so Shannon's phone buzzes with the suggested reply
 *
 * Admin-only — does NOT draft replies for non-admin recipients.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fine-tuned Shannon voice model on Vertex AI (v7 — trained on 402 curated client conversations)
const VERTEX_PROJECT_ID = '103426154831';
const VERTEX_ENDPOINT_ID = '3547200982821634048';
const VERTEX_LOCATION = 'us-central1';

let _vertexAccessTokenCache = { token: null, expiresAt: 0 };

async function supabaseQuery(path, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || 'return=representation',
    };
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
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
// Simple-reply detection — skip AI drafting for trivial messages
// ============================================================

/**
 * Returns true when a message is too trivial to warrant an AI draft
 * (emoji-only reactions, "ty", "got it", etc.). We still create a
 * lightweight alert so Shannon knows about the message, but with no
 * suggested_message — saves a Vertex call and his review time.
 */
function isSimpleReply(message) {
    if (!message) return true;
    const text = String(message).trim();
    if (text.length === 0) return true;

    // Strip emoji and whitespace — if nothing meaningful remains, it's a reaction
    const stripped = text
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '')
        .replace(/[\s\p{P}]/gu, '')
        .trim();
    if (stripped.length === 0) return true;

    // Short thank-yous / acknowledgements
    const lower = text.toLowerCase();
    const trivialPatterns = [
        /^(ty|thx|thanks|thank you|tysm|cheers|ok|okay|k|kk|yep|yup|yes|no|nah|got it|sounds good|sg|np|👍|❤️|🙏)\.?!?$/i,
    ];
    if (text.length <= 20 && trivialPatterns.some(p => p.test(lower))) return true;

    return false;
}

// ============================================================
// Vertex AI (fine-tuned Shannon voice) — mirrors ai-client-monitor
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
        exp: now + 3600
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

/**
 * Strip robotic "hey {name}," style greetings — mirrors ai-client-monitor.js.
 * This is a REPLY in an ongoing conversation; greetings are almost never what Shannon says.
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

// ============================================================
// Context loading — recent conversation + lightweight client facts
// ============================================================

async function loadConversationContext(senderId, receiverId, currentMessage) {
    // Last ~8 messages between these two, newest last for natural reading order
    const history = await supabaseQuery(
        `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId}))&order=created_at.desc&limit=9`
    );
    // Drop the current (just-inserted) message, keep previous context
    const prior = history.filter(m => m.message !== currentMessage).reverse();
    return prior.slice(-8);
}

async function loadClientSnapshot(senderId) {
    // Lightweight context — name, last workout date, recent PB, mood today.
    // Kept intentionally thin; full context is available in the admin dashboard
    // if Shannon wants to dig deeper before sending.
    const snapshot = { name: 'Client', recent: [] };

    try {
        const users = await supabaseQuery(`users?select=id,name,email&id=eq.${senderId}&limit=1`);
        if (users[0]) snapshot.name = users[0].name || users[0].email?.split('@')[0] || 'Client';
    } catch (e) { /* non-critical */ }

    try {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [workouts, pbs, mood] = await Promise.all([
            supabaseQuery(`workout_log?select=workout_name,completed_at&user_id=eq.${senderId}&completed_at=gte.${oneWeekAgo}&order=completed_at.desc&limit=3`).catch(() => []),
            supabaseQuery(`personal_bests?select=exercise_name,value,achieved_at&user_id=eq.${senderId}&achieved_at=gte.${oneWeekAgo}&order=achieved_at.desc&limit=3`).catch(() => []),
            supabaseQuery(`mood_logs?select=mood_score,energy_score,created_at&user_id=eq.${senderId}&created_at=gte.${new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()}&order=created_at.desc&limit=3`).catch(() => []),
        ]);
        if (workouts.length) snapshot.recent.push(`Recent workouts: ${workouts.map(w => w.workout_name).join(', ')}`);
        if (pbs.length) snapshot.recent.push(`PBs this week: ${pbs.map(p => `${p.exercise_name} ${p.value}`).join(', ')}`);
        if (mood.length) {
            const latest = mood[0];
            snapshot.recent.push(`Latest mood: ${latest.mood_score}/10, energy ${latest.energy_score}/10`);
        }
    } catch (e) { /* non-critical */ }

    return snapshot;
}

// ============================================================
// Draft generation
// ============================================================

async function generateDraftReply({ clientName, clientSnapshot, conversationHistory, currentMessage }) {
    // Learn from Shannon's past edits (same pattern as batch monitor)
    let editExamples = '';
    try {
        const recentEdits = await supabaseQuery(
            `coach_alerts?select=alert_type,suggested_message,data&status=eq.sent&data->>sent_message=not.is.null&order=actioned_at.desc&limit=15`
        );
        const goodExamples = recentEdits
            .filter(e => e.data?.sent_message && e.data.sent_message !== e.suggested_message)
            .slice(0, 6);
        if (goodExamples.length > 0) {
            editExamples = '\n\nLEARN FROM PAST EDITS — Shannon rewrote these AI drafts into how he actually talks. Mimic the SECOND version:\n\n' +
                goodExamples.map((e, i) =>
                    `Example ${i + 1}:\nAI draft: ${e.suggested_message}\nShannon rewrote it to: ${e.data.sent_message}`
                ).join('\n\n');
        }
    } catch (e) { /* non-critical */ }

    const historyText = conversationHistory.length > 0
        ? conversationHistory.map(m => `${m.sender_id === clientSnapshot.id ? clientName : 'Shannon'}: ${m.message}`).join('\n')
        : '(no prior conversation)';

    const snapshotText = clientSnapshot.recent.length > 0
        ? clientSnapshot.recent.join('\n')
        : '(no recent activity snapshot)';

    const prompt = `Draft a SHORT reply to this incoming client DM in Shannon's voice.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content. This is an ongoing conversation, not a first message.

Keep it brief — 1–3 sentences max. Match energy: if they're celebrating, celebrate. If they're stressed, validate first. If it's a practical question, answer directly. Australian casual tone, lowercase-friendly, no corporate fluff.

CLIENT: ${clientName}

RECENT ACTIVITY:
${snapshotText}

CONVERSATION HISTORY:
${historyText}

THEIR NEW MESSAGE:
${currentMessage}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 512, temperature: 0.8 };

    // Primary: fine-tuned Shannon model
    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[instant-draft] Vertex failed, falling back to Gemini: ${err.message}`);
    }

    // Fallback: Gemini 2.0 Flash
    if (!GEMINI_API_KEY) {
        console.error('[instant-draft] No Gemini fallback configured');
        return { text: '', model: 'none' };
    }
    try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents, generationConfig }),
        });
        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error('[instant-draft] Gemini fallback failed:', err.message);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Push notification — "draft ready" buzz with the actual draft
// ============================================================

async function sendDraftReadyPush({ adminId, clientName, clientMessage, draftText, alertId }) {
    // Send a notification with both the original message and the draft reply,
    // so Shannon can decide whether to open the dashboard or just glance.
    try {
        const title = `💬 ${clientName} — draft ready`;
        const body = draftText
            ? `"${truncate(clientMessage, 80)}"\n→ ${truncate(draftText, 140)}`
            : `"${truncate(clientMessage, 180)}"`;

        const pushUrl = `${SITE_URL}/.netlify/functions/send-dm-notification`;
        await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: adminId,
                senderId: 'coach-assistant',
                senderName: title,
                messageText: body,
                // send-dm-notification ignores these extras today, but future-proof
                type: 'coach_draft_ready',
                alertId,
            }),
        }).catch(e => console.warn('[instant-draft] push dispatch failed:', e.message));
    } catch (err) {
        console.warn('[instant-draft] draft-ready push failed:', err.message);
    }
}

function truncate(s, n) {
    if (!s) return '';
    return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

// ============================================================
// Main handler
// ============================================================

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { nudgeId, senderId, receiverId, messageText } = payload;
    if (!nudgeId || !senderId || !receiverId || !messageText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // 1. Safety check — only draft for admin/coach recipients
    const admins = await supabaseQuery(`admin_users?select=user_id&user_id=eq.${receiverId}&limit=1`);
    if (admins.length === 0) {
        console.log(`[instant-draft] receiver ${receiverId} is not admin — ignoring`);
        return { statusCode: 200, body: JSON.stringify({ skipped: 'not_admin' }) };
    }

    // 2. Dedup — don't create duplicate alerts for the same nudge
    try {
        const existing = await supabaseQuery(
            `coach_alerts?select=id&data->>nudge_id=eq.${nudgeId}&limit=1`
        );
        if (existing.length > 0) {
            console.log(`[instant-draft] alert already exists for nudge ${nudgeId}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate' }) };
        }
    } catch (e) { /* continue */ }

    // 3. Resolve client name
    const clientSnapshot = await loadClientSnapshot(senderId);
    clientSnapshot.id = senderId;
    const clientName = clientSnapshot.name;

    // 4. Short-circuit for trivial replies — skip AI, create lightweight alert
    const simple = isSimpleReply(messageText);

    let draftText = '';
    let draftModel = 'skipped-simple-reply';

    if (!simple) {
        try {
            const history = await loadConversationContext(senderId, receiverId, messageText);
            const draft = await generateDraftReply({
                clientName,
                clientSnapshot,
                conversationHistory: history,
                currentMessage: messageText,
            });
            draftText = draft.text;
            draftModel = draft.model;
        } catch (err) {
            console.error('[instant-draft] draft generation failed:', err.message);
        }
    }

    // 5. Insert coach_alert
    const hoursSince = 0; // by definition — just arrived
    const alertRow = {
        client_id: senderId,
        client_name: clientName,
        coach_id: receiverId,
        alert_type: 'incoming_dm',
        priority: simple ? 'medium' : 'high',
        title: `${clientName} just messaged you`,
        description: `"${truncate(messageText, 200)}"`,
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            nudge_id: nudgeId,
            message_preview: truncate(messageText, 400),
            hours_waiting: hoursSince,
            draft_model: draftModel,
            is_simple_reply: simple,
            drafted_at: new Date().toISOString(),
        },
    };

    let alertId = null;
    try {
        const inserted = await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: [alertRow],
            prefer: 'return=representation',
        });
        alertId = inserted?.[0]?.id || null;
        console.log(`[instant-draft] alert ${alertId} created for nudge ${nudgeId} (model: ${draftModel})`);
    } catch (err) {
        console.error('[instant-draft] alert insert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert insert failed', details: err.message }) };
    }

    // 6. Push the draft-ready notification (non-blocking — don't fail the trigger)
    if (!simple && draftText) {
        await sendDraftReadyPush({
            adminId: receiverId,
            clientName,
            clientMessage: messageText,
            draftText,
            alertId,
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            alert_id: alertId,
            draft_model: draftModel,
            draft_generated: !!draftText,
            is_simple_reply: simple,
        }),
    };
};
