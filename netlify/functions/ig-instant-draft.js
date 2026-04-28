/**
 * ig-instant-draft — produces an AI draft reply for an inbound Instagram DM
 * captured by the manychat-inbound webhook.
 *
 * Mirrors instant-coach-draft.js for the in-app DM path with channel-specific
 * differences:
 *
 *   - Conversation history comes from ig_messages, not nudges.
 *   - Client identity is by ManyChat subscriber_id, not users.id. The IG
 *     thread might have a linked_user_id (lead converted to app user) — when
 *     present we also load client_memory so the voice stays consistent.
 *   - Coach_alert row is alert_type='ig_incoming_dm' and stamped with
 *     data.channel='instagram' so send-coach-reply routes the outbound
 *     through ManyChat instead of the in-app nudges path.
 *   - Auto-send is intentionally NOT wired in this v1 — IG always goes
 *     through the approve-gate. We'll add an IG-aware auto-send later
 *     (needs a parallel ManyChat send call, not the nudges insert that the
 *     in-app maybeAutoSendDraft uses).
 *
 * Trigger: POST from manychat-inbound after it has persisted the inbound
 * message and upserted the thread.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    buildMemoryBlock,
    buildCoachBioBlock,
    loadEditExamples,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const HISTORY_LIMIT = 12;
const MAX_CHUNKS = 3;

/**
 * Parse the model's JSON-formatted draft into 1-3 message chunks.
 *
 * The IG prompt instructs the model to output `{"messages": [...]}`. When the
 * model complies we split that into chunks for multi-message send (lands as
 * separate IG bubbles, feels less like AI than one wall of text). When it
 * doesn't (occasional plain-text fallback from the fine-tuned model) we still
 * try to recover natural breaks before defaulting to a single chunk.
 */
function parseDraftChunks(rawText) {
    if (!rawText) return { chunks: [], joined: '' };
    const trimmed = String(rawText).trim();
    if (!trimmed) return { chunks: [], joined: '' };

    // Strip optional ```json fences before JSON.parse — Gemini hedges
    // with code fences sometimes despite "JSON only" instructions.
    const jsonCandidate = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    try {
        const parsed = JSON.parse(jsonCandidate);
        if (parsed && Array.isArray(parsed.messages)) {
            const chunks = parsed.messages
                .map(m => typeof m === 'string' ? m.trim() : '')
                .filter(Boolean)
                .slice(0, MAX_CHUNKS);
            if (chunks.length > 0) return { chunks, joined: chunks.join('\n') };
        }
    } catch { /* fall through to plain-text splitting */ }

    // Plain-text fallback. Honour explicit paragraph or line breaks the model
    // may have used as natural pauses; otherwise treat as one chunk.
    const paragraphs = trimmed.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    if (paragraphs.length >= 2) {
        const chunks = paragraphs.slice(0, MAX_CHUNKS);
        return { chunks, joined: chunks.join('\n') };
    }
    const lines = trimmed.split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (lines.length >= 2 && lines.length <= 4) {
        const chunks = lines.slice(0, MAX_CHUNKS);
        return { chunks, joined: chunks.join('\n') };
    }
    return { chunks: [trimmed], joined: trimmed };
}

async function loadThread(threadId) {
    const rows = await supabaseQuery(
        `ig_threads?select=id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,custom_data&id=eq.${threadId}&limit=1`
    );
    return rows[0] || null;
}

async function loadIgHistory(threadId, currentText) {
    const rows = await supabaseQuery(
        `ig_messages?select=direction,text,created_at&thread_id=eq.${threadId}&order=created_at.desc&limit=${HISTORY_LIMIT}`
    );
    // Drop the just-inserted current message and reverse to chronological order.
    const prior = rows
        .filter(r => !(r.direction === 'in' && r.text === currentText))
        .reverse();
    return prior;
}

function buildLeadBlock({ profileName, igUsername, customData, leadStage }) {
    const lines = [];
    if (profileName) lines.push(`Name: ${profileName}`);
    if (igUsername) lines.push(`IG handle: ${igUsername}`);
    if (leadStage && leadStage !== 'new') lines.push(`Funnel stage: ${leadStage}`);
    if (customData && typeof customData === 'object') {
        for (const [key, val] of Object.entries(customData)) {
            if (val == null || val === '') continue;
            const rendered = typeof val === 'string' ? val : JSON.stringify(val);
            lines.push(`${key}: ${rendered}`);
        }
    }
    if (lines.length === 0) return '';
    return `\n\nWHAT WE KNOW ABOUT THIS LEAD:\n${lines.join('\n')}`;
}

function pitchHintForStage(stage) {
    switch (stage) {
        case 'qualifying':
            return "Conversation is warming up. If there's a natural opening (they ask about your training, vegan stuff, weight loss, energy), you can mention you run a 7-day vegan challenge in your app. Keep it casual, no link drops, no urgency.";
        case 'invited':
            return "You've already mentioned the challenge or app. DON'T re-pitch. Answer their questions plainly. If they're close to signing up, help them across the line.";
        case 'in_app':
            return "They're already in the app. Coach them like a normal client. The IG thread is just a parallel channel — same voice, same memory.";
        case 'churned':
            return "They went cold or opted out earlier. Respect the no. Be friendly, no pitch, no follow-up bait.";
        case 'new':
        default:
            return "EARLY in this DM thread. Just chat. Ask one genuine follow-up question that builds on what they said. DO NOT pitch the app, the challenge, or anything else yet — they're a stranger.";
    }
}

async function generateDraft({ leadName, leadBlock, memoryBlock, history, currentMessage, leadStage, channel }) {
    const editExamples = await loadEditExamples({ lookback: 15, max: 6 });
    const coachBio = buildCoachBioBlock();

    const historyText = history.length === 0
        ? '(no prior messages — this is the first DM)'
        : history.map(m => `${m.direction === 'in' ? leadName : 'Shannon'}: ${m.text}`).join('\n');

    const pitchHint = pitchHintForStage(leadStage);
    const channelLabel = channel === 'messenger' ? 'Facebook Messenger' : 'Instagram';
    const channelShort = channel === 'messenger' ? 'Messenger' : 'IG';

    const prompt = `Draft a SHORT ${channelLabel} DM reply in Shannon's voice, broken into 1-3 messages so it lands like real texting (separate bubbles, not one wall of text).

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content.

This is ${channelShort}. Tight chunks: each message 1-2 sentences max, lowercase-friendly, Australian casual. No emojis unless they used one first. No links unless absolutely necessary. Sound like a person texting back, not a brand.

NEVER reveal AI, automation, "trained on Shannon's voice", "24/7", or anything that breaks the personal-coach illusion. Shannon is replying personally.

NO em-dashes. Use periods, colons, or commas instead.

${pitchHint}
${coachBio}

LEAD: ${leadName}${leadBlock}${memoryBlock || ''}

CONVERSATION HISTORY (${channelLabel} DM):
${historyText}

THEIR NEW MESSAGE:
${currentMessage}${editExamples}

OUTPUT FORMAT — JSON only, nothing else:
{"messages": ["chunk 1", "chunk 2 (if needed)", "chunk 3 (if needed)"]}

Rules:
- 1 to 3 chunks. One-liner is fine — just one item in the array.
- Split where Shannon would naturally pause: new thought, change of topic, follow-up question.
- Don't artificially split a single sentence. Each chunk should stand on its own.
- No quotes, labels, code-fence, or commentary outside the JSON.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 2048, temperature: 0.85 };

    let rawText = '';
    let model = 'none';
    try {
        rawText = await callVertexAIModel(contents, generationConfig);
        model = 'vertex-v7';
    } catch (err) {
        console.warn(`[ig-draft] Vertex failed, falling back to Gemini: ${err.message}`);
        try {
            rawText = await callGeminiFallback(contents, generationConfig);
            model = 'gemini-2.0-fallback';
        } catch (err2) {
            console.error('[ig-draft] Gemini fallback failed:', err2.message);
            return { chunks: [], joined: '', model: 'none' };
        }
    }

    const parsed = parseDraftChunks(rawText);
    // Strip robotic openers from the FIRST chunk only — subsequent chunks are
    // continuations and shouldn't have lower-cased capitals or dropped names.
    const cleanedChunks = parsed.chunks.map((c, i) => i === 0 ? stripLeadingGreeting(c) : c).filter(Boolean);
    return {
        chunks: cleanedChunks,
        joined: cleanedChunks.join('\n'),
        model,
    };
}

async function sendDraftReadyPush({ adminId, alertId, leadName, leadMessage, draftText, clientId, channel }) {
    if (!adminId) {
        console.warn('[ig-draft] skipping push — no admin coach_id on thread');
        return;
    }
    if (!clientId) {
        // The Android CoachDraftMessagingService rejects pushes with empty
        // clientId (it uses it as the MessagingStyle Person key). For cold
        // ManyChat leads with no linked_user_id we fall back to the
        // subscriber_id — stable per conversation, satisfies the contract.
        console.warn('[ig-draft] no clientId for push — skipping');
        return;
    }
    try {
        const channelPrefix = channel === 'messenger' ? 'FB' : 'IG';
        const hasDraft = !!draftText;
        const title = hasDraft
            ? `${channelPrefix}: ${leadName} — draft ready`
            : `${channelPrefix}: ${leadName} just messaged`;
        const body = hasDraft
            ? truncate(draftText, 220)
            : `"${truncate(leadMessage, 180)}"`;
        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
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
                clientName: leadName,
                clientMessage: leadMessage || '',
                draftText: draftText || '',
                isSimpleReply: false,
            }),
        }).catch(e => console.warn('[ig-draft] push dispatch failed:', e.message));
    } catch (err) {
        console.warn('[ig-draft] push dispatch errored:', err.message);
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { threadId, messageText, manychatMessageId } = payload;
    if (!threadId || !messageText) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing threadId or messageText' }) };
    }

    const thread = await loadThread(threadId);
    if (!thread) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Thread not found' }) };
    }

    // Idempotency — when ManyChat supplied a message_id, reuse it. Otherwise
    // fall back to thread+timestamp (less robust but better than nothing
    // for ManyChat configs that don't pass message_id through).
    const idempotencyKey = manychatMessageId
        ? `ig_incoming_dm:${manychatMessageId}`
        : `ig_incoming_dm:${threadId}:${Date.now()}`;

    try {
        const existing = await supabaseQuery(
            `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
        );
        if (existing.length > 0) {
            return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate', alert_id: existing[0].id }) };
        }
    } catch (e) { /* continue — partial unique index is the real guarantee */ }

    const leadName = thread.profile_name || thread.ig_username || 'Lead';
    const history = await loadIgHistory(threadId, messageText);

    let memoryBlock = '';
    if (thread.linked_user_id && thread.coach_id) {
        try {
            const memory = await loadClientMemory(thread.coach_id, thread.linked_user_id);
            memoryBlock = buildMemoryBlock(memory);
        } catch (e) { /* non-critical */ }
    }

    const leadBlock = buildLeadBlock({
        profileName: thread.profile_name,
        igUsername: thread.ig_username,
        customData: thread.custom_data,
        leadStage: thread.lead_stage,
    });

    const channel = thread.channel || 'instagram';
    const draft = await generateDraft({
        leadName,
        leadBlock,
        memoryBlock,
        history,
        currentMessage: messageText,
        leadStage: thread.lead_stage || 'new',
        channel,
    });

    const alertType = channel === 'messenger' ? 'fb_incoming_dm' : 'ig_incoming_dm';
    const channelLabel = channel === 'messenger' ? 'Messenger' : 'Instagram';

    const alertRow = {
        // client_id stays NULL for cold ManyChat leads (no users.id yet).
        // Once the lead converts (ig_threads.linked_user_id set), it's
        // populated so client-centric admin views still find the alert.
        client_id: thread.linked_user_id || null,
        client_name: leadName,
        coach_id: thread.coach_id || null,
        alert_type: alertType,
        priority: 'high',
        title: `${leadName} just DM'd on ${channelLabel}`,
        description: `"${truncate(messageText, 200)}"`,
        suggested_message: draft.joined || null,
        status: 'pending',
        data: {
            channel,
            subscriber_id: thread.subscriber_id,
            ig_thread_id: thread.id,
            ig_username: thread.ig_username || null,
            lead_stage: thread.lead_stage || 'new',
            manychat_message_id: manychatMessageId || null,
            message_preview: truncate(messageText, 400),
            // Multi-message split — `draft_messages` is the array of chunks
            // we want to send as separate IG/Messenger bubbles. `draft_text`
            // is the joined version shown in the push notification (so
            // Shannon can review the whole reply at once). send-ig-reply
            // uses draft_messages when Shannon sends without editing; falls
            // back to single-message send when his edit invalidates the
            // chunk boundaries.
            draft_messages: draft.chunks,
            draft_text: draft.joined,
            draft_model: draft.model,
            drafted_at: new Date().toISOString(),
        },
    };

    let alertId = null;
    try {
        const result = await insertCoachAlert(alertRow, idempotencyKey);
        alertId = result.alertId;
        if (result.deduped) {
            return { statusCode: 200, body: JSON.stringify({ skipped: 'duplicate', alert_id: alertId }) };
        }
    } catch (err) {
        console.error('[ig-draft] alert insert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert insert failed', details: err.message }) };
    }

    await sendDraftReadyPush({
        adminId: thread.coach_id,
        alertId,
        leadName,
        leadMessage: messageText,
        draftText: draft.joined,
        // For linked-app users we pass their real users.id so the
        // MessagingStyle conversation merges with any in-app coach drafts
        // for the same client. For cold ManyChat leads we fall back to the
        // subscriber_id — stable per conversation, non-empty so
        // CoachDraftMessagingService doesn't reject the payload.
        clientId: thread.linked_user_id || thread.subscriber_id,
        channel,
    });

    return {
        statusCode: 200,
        body: JSON.stringify({
            alert_id: alertId,
            draft_model: draft.model,
            draft_generated: !!draft.joined,
            chunk_count: draft.chunks.length,
        }),
    };
};
