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
 *   3. Load recent conversation + client profile + client_memory for context
 *   4. Call fine-tuned Shannon model (Vertex v7, fallback Gemini) to draft a reply
 *   5. Insert coach_alerts row with type='incoming_dm', priority='high'
 *   6. Fire a "draft ready" push so Shannon's phone buzzes with the suggested reply
 *
 * Admin-only — does NOT draft replies for non-admin recipients.
 */

const {
    supabaseQuery,
    loadClientMemory,
    buildMemoryBlock,
    loadEditExamples,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

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
// Context loading — recent conversation + lightweight client facts
// ============================================================

async function loadConversationContext(senderId, receiverId, currentMessage) {
    const history = await supabaseQuery(
        `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId}))&order=created_at.desc&limit=9`
    );
    const prior = history.filter(m => m.message !== currentMessage).reverse();
    return prior.slice(-8);
}

async function loadClientSnapshot(senderId) {
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

async function generateDraftReply({ clientName, clientSnapshot, conversationHistory, currentMessage, memoryBlock }) {
    const editExamples = await loadEditExamples({ lookback: 15, max: 6 });

    const historyText = conversationHistory.length > 0
        ? conversationHistory.map(m => `${m.sender_id === clientSnapshot.id ? clientName : 'Shannon'}: ${m.message}`).join('\n')
        : '(no prior conversation)';

    const snapshotText = clientSnapshot.recent.length > 0
        ? clientSnapshot.recent.join('\n')
        : '(no recent activity snapshot)';

    const prompt = `Draft a SHORT reply to this incoming client DM in Shannon's voice.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content. This is an ongoing conversation, not a first message.

Keep it brief — 1–3 sentences max. Match energy: if they're celebrating, celebrate. If they're stressed, validate first. If it's a practical question, answer directly. Australian casual tone, lowercase-friendly, no corporate fluff.

CLIENT: ${clientName}${memoryBlock || ''}

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
    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error('[instant-draft] Gemini fallback failed:', err.message);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Push notification — "draft ready" buzz with the actual draft
// ============================================================

async function sendDraftReadyPush({ adminId, clientId, clientName, clientMessage, draftText, alertId, isSimpleReply }) {
    try {
        const hasDraft = !!draftText && !isSimpleReply;
        const title = hasDraft
            ? `💬 ${clientName} — draft ready`
            : `💬 ${clientName} just messaged`;
        const body = hasDraft
            ? `"${truncate(clientMessage, 80)}"\n→ ${truncate(draftText, 140)}`
            : `"${truncate(clientMessage, 180)}"`;

        const pushUrl = `${SITE_URL}/.netlify/functions/send-dm-notification`;
        await fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: adminId,
                senderId: clientId,
                senderName: title,
                messageText: body,
                type: 'coach_draft_ready',
                alertId,
                clientId,
                clientName,
                draftText: draftText || '',
                isSimpleReply: !!isSimpleReply,
            }),
        }).catch(e => console.warn('[instant-draft] push dispatch failed:', e.message));
    } catch (err) {
        console.warn('[instant-draft] draft-ready push failed:', err.message);
    }
}

// ============================================================
// Main handler
// ============================================================

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
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

    // 4. Short-circuit for trivial replies
    const simple = isSimpleReply(messageText);

    let draftText = '';
    let draftModel = 'skipped-simple-reply';

    if (!simple) {
        try {
            const [history, memory] = await Promise.all([
                loadConversationContext(senderId, receiverId, messageText),
                loadClientMemory(receiverId, senderId),
            ]);
            const memoryBlock = buildMemoryBlock(memory);
            const draft = await generateDraftReply({
                clientName,
                clientSnapshot,
                conversationHistory: history,
                currentMessage: messageText,
                memoryBlock,
            });
            draftText = draft.text;
            draftModel = draft.model;
        } catch (err) {
            console.error('[instant-draft] draft generation failed:', err.message);
        }
    }

    // 5. Insert coach_alert
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
            hours_waiting: 0,
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

    // 6. Push
    await sendDraftReadyPush({
        adminId: receiverId,
        clientId: senderId,
        clientName,
        clientMessage: messageText,
        draftText,
        alertId,
        isSimpleReply: simple,
    });

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
