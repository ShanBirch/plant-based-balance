/**
 * PB Celebration Draft — Event-Driven Function
 *
 * Fires the moment a client breaks a personal best. Generates an AI hype
 * message in Shannon's voice and queues it as a `coach_alerts` row so Shannon
 * can send encouragement within seconds of the PB happening, instead of
 * finding out 2 hours later from the batch scan.
 *
 * Trigger: DB trigger on `pb_history` INSERT
 *          (see database/pb_celebration_trigger.sql)
 *
 * Flow:
 *   1. Dedup against any win_to_celebrate alert for this client + exercise in
 *      the last 24h (covers overlap with ai-client-monitor.js batch scan)
 *   2. Load client snapshot (name, recent activity)
 *   3. Call fine-tuned Shannon model (Vertex v7) with a celebration prompt
 *   4. Insert `coach_alerts` row with alert_type='win_to_celebrate'
 *   5. Fire a "coach_draft_ready" push — same payload shape as the DM inline-
 *      reply flow, so Shannon can send the hype message from the lockscreen
 *      notification with the Android RemoteInput action (see
 *      CoachDraftMessagingService.java)
 *
 * Tone target: match the `showWorkoutSuccessScreen()` "NEW PERSONAL BEST!"
 * energy from dashboard-script-5 — Aussie casual, 1-3 sentences, no greetings.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fine-tuned Shannon voice model on Vertex AI (v7)
const VERTEX_PROJECT_ID = '103426154831';
const VERTEX_ENDPOINT_ID = '3547200982821634048';
const VERTEX_LOCATION = 'us-central1';

let _vertexAccessTokenCache = { token: null, expiresAt: 0 };

async function supabaseQuery(path, options = {}) {
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
// Vertex AI — mirrors instant-coach-draft.js
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
            generationConfig: { maxOutputTokens: 256, temperature: 0.9, ...generationConfig },
        }),
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vertex AI call failed: ${response.status} ${errText.slice(0, 500)}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

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
// Context loading
// ============================================================

async function loadClientSnapshot(userId) {
    const snapshot = { id: userId, name: 'Client', recent: [] };
    try {
        const users = await supabaseQuery(`users?select=id,name,email&id=eq.${userId}&limit=1`);
        if (users[0]) snapshot.name = users[0].name || users[0].email?.split('@')[0] || 'Client';
    } catch (e) { /* non-critical */ }

    try {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const [workouts, otherPBs] = await Promise.all([
            supabaseQuery(`workout_log?select=workout_name,completed_at&user_id=eq.${userId}&completed_at=gte.${oneWeekAgo}&order=completed_at.desc&limit=3`).catch(() => []),
            supabaseQuery(`pb_history?select=exercise_name,pb_type,new_value,achieved_at&user_id=eq.${userId}&achieved_at=gte.${oneWeekAgo}&order=achieved_at.desc&limit=5`).catch(() => []),
        ]);
        if (workouts.length) snapshot.recent.push(`Recent workouts: ${workouts.map(w => w.workout_name).join(', ')}`);
        if (otherPBs.length > 1) {
            snapshot.recent.push(`Also hit ${otherPBs.length - 1} other PB(s) in the past week — momentum is on`);
        }
    } catch (e) { /* non-critical */ }

    return snapshot;
}

// ============================================================
// Draft generation
// ============================================================

/** Format the PB in natural language for the prompt + alert title. */
function describePB({ exerciseName, pbType, newValue, newWeightKg, newReps, previousValue, improvement }) {
    const ex = exerciseName || 'that lift';
    if (pbType === 'weight') {
        const weight = newWeightKg || newValue;
        const reps = newReps;
        const prev = previousValue;
        const headline = reps
            ? `${ex}: ${weight}kg × ${reps}`
            : `${ex}: ${weight}kg`;
        const delta = prev && improvement
            ? ` (up from ${prev}kg — +${improvement}kg)`
            : (prev ? ` (prev ${prev}kg)` : '');
        return { headline, detail: headline + delta };
    }
    if (pbType === 'reps') {
        const reps = newReps || newValue;
        const weight = newWeightKg;
        const prev = previousValue;
        const headline = weight
            ? `${ex}: ${reps} reps @ ${weight}kg`
            : `${ex}: ${reps} reps`;
        const delta = prev && improvement
            ? ` (up from ${prev} — +${improvement})`
            : (prev ? ` (prev ${prev})` : '');
        return { headline, detail: headline + delta };
    }
    return { headline: ex, detail: ex };
}

async function generateCelebrationDraft({ clientName, clientSnapshot, pbDescription }) {
    let editExamples = '';
    try {
        const recentEdits = await supabaseQuery(
            `coach_alerts?select=alert_type,suggested_message,data&status=eq.sent&data->>sent_message=not.is.null&alert_type=eq.win_to_celebrate&order=actioned_at.desc&limit=10`
        );
        const goodExamples = recentEdits
            .filter(e => e.data?.sent_message && e.data.sent_message !== e.suggested_message)
            .slice(0, 4);
        if (goodExamples.length > 0) {
            editExamples = '\n\nLEARN FROM PAST EDITS — Shannon rewrote these AI drafts into how he actually celebrates. Mimic the SECOND version:\n\n' +
                goodExamples.map((e, i) =>
                    `Example ${i + 1}:\nAI draft: ${e.suggested_message}\nShannon rewrote it to: ${e.data.sent_message}`
                ).join('\n\n');
        }
    } catch (e) { /* non-critical */ }

    const snapshotText = clientSnapshot.recent.length > 0
        ? clientSnapshot.recent.join('\n')
        : '(no recent activity snapshot)';

    const prompt = `Draft a SHORT celebration message for a client who JUST hit a personal best. Send it unprompted — this is you reaching out to them.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into the hype. Coach-client relationship is already established.

Keep it brief — 1-2 sentences max. Match the energy of someone breaking a PB: hyped, slightly unhinged, Aussie casual, profanity welcome (that's Shannon's voice). No corporate fluff, no "great job" or "well done". Examples of the vibe: "fuckin hell", "legend", "smashed it", "what a unit".

Reference the specific numbers — it shows you noticed. If there's a meaningful improvement (+X kg / +Y reps), call it out.

CLIENT: ${clientName}

PB THEY JUST HIT:
${pbDescription}

RECENT CONTEXT:
${snapshotText}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 256, temperature: 0.9 };

    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[pb-celebration] Vertex failed, falling back to Gemini: ${err.message}`);
    }

    if (!GEMINI_API_KEY) {
        console.error('[pb-celebration] No Gemini fallback configured');
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
        console.error('[pb-celebration] Gemini fallback failed:', err.message);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Push notification — reuses the coach-draft inline-reply flow
// ============================================================

function truncate(s, n) {
    if (!s) return '';
    return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

async function sendCelebrationPush({ clientId, clientName, pbHeadline, draftText, alertId, coachId }) {
    try {
        // Use the same `coach_draft_ready` type so the Android CoachDraftMessagingService
        // handles it — Shannon gets the inline-reply notification on the lockscreen with
        // the drafted hype message pre-filled.
        const title = `🎉 ${clientName} hit a PB!`;
        const body = draftText
            ? `${truncate(pbHeadline, 80)}\n→ ${truncate(draftText, 140)}`
            : truncate(pbHeadline, 180);

        const pushUrl = `${SITE_URL}/.netlify/functions/send-dm-notification`;
        await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: coachId,
                senderId: clientId,
                senderName: title,
                messageText: body,
                type: 'coach_draft_ready',
                alertId,
                clientId,
                clientName,
                draftText: draftText || '',
                isSimpleReply: false,
            }),
        }).catch(e => console.warn('[pb-celebration] push dispatch failed:', e.message));
    } catch (err) {
        console.warn('[pb-celebration] celebration push failed:', err.message);
    }
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

    const {
        historyId,
        userId,
        exerciseName,
        pbType,
        newValue,
        newWeightKg,
        newReps,
        previousValue,
        improvement,
    } = payload;

    if (!userId || !exerciseName || !pbType) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing required PB fields' }) };
    }

    // 1. Dedup — skip if we already alerted on this client's PB for this exercise
    //    in the last 24h (matches ai-client-monitor's dedup window so batch+event
    //    never both create an alert).
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const existing = await supabaseQuery(
            `coach_alerts?select=id&client_id=eq.${userId}&alert_type=eq.win_to_celebrate&data->>exercise_name=eq.${encodeURIComponent(exerciseName)}&created_at=gte.${yesterday}&limit=1`
        );
        if (existing.length > 0) {
            console.log(`[pb-celebration] dedup — existing alert for ${userId} / ${exerciseName}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup' }) };
        }
    } catch (e) { /* continue — better a duplicate than a silent drop */ }

    // 2. Resolve client + find the coach to alert. Each client is managed by a
    //    coach via the `coach_clients` table; fall back to the first admin user
    //    if no coach link exists (e.g. legacy accounts).
    const clientSnapshot = await loadClientSnapshot(userId);
    const clientName = clientSnapshot.name;

    let coachId = null;
    try {
        const links = await supabaseQuery(
            `coach_clients?select=coach_id&client_id=eq.${userId}&order=created_at.asc&limit=1`
        );
        if (links[0]?.coach_id) coachId = links[0].coach_id;
    } catch (e) { /* fall through */ }
    if (!coachId) {
        try {
            const admins = await supabaseQuery(`admin_users?select=user_id&limit=1`);
            if (admins[0]?.user_id) coachId = admins[0].user_id;
        } catch (e) { /* fall through */ }
    }
    if (!coachId) {
        console.warn('[pb-celebration] no coach/admin found — skipping');
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_coach' }) };
    }

    // 3. Describe the PB for prompt + alert title
    const { headline, detail } = describePB({
        exerciseName,
        pbType,
        newValue,
        newWeightKg,
        newReps,
        previousValue,
        improvement,
    });

    // 4. Draft the celebration message
    let draftText = '';
    let draftModel = 'none';
    try {
        const draft = await generateCelebrationDraft({
            clientName,
            clientSnapshot,
            pbDescription: detail,
        });
        draftText = draft.text;
        draftModel = draft.model;
    } catch (err) {
        console.error('[pb-celebration] draft generation failed:', err.message);
    }

    // 5. Insert the coach_alert
    const alertRow = {
        client_id: userId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'win_to_celebrate',
        priority: 'medium',
        title: `${clientName} just smashed ${exerciseName}! 🎉`,
        description: detail + (improvement ? ' · fresh PB, great moment to send a quick hype.' : ''),
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            pb_history_id: historyId || null,
            exercise_name: exerciseName,
            pb_type: pbType,
            new_value: newValue,
            new_weight_kg: newWeightKg,
            new_reps: newReps,
            previous_value: previousValue,
            improvement,
            draft_model: draftModel,
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
        console.log(`[pb-celebration] alert ${alertId} created for ${userId} / ${exerciseName} (model: ${draftModel})`);
    } catch (err) {
        console.error('[pb-celebration] alert insert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert insert failed', details: err.message }) };
    }

    // 6. Push the celebration — reuses the inline-reply notification flow, so
    //    Shannon can tap Send on the lockscreen without opening the app.
    if (draftText) {
        await sendCelebrationPush({
            clientId: userId,
            clientName,
            pbHeadline: headline,
            draftText,
            alertId,
            coachId,
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            alert_id: alertId,
            draft_model: draftModel,
            draft_generated: !!draftText,
        }),
    };
};
