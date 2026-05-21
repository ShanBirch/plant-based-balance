/**
 * needs-attention-draft
 *
 * Creates a follow_up_review coach_alert from a recent conversation where
 * Shannon sent the latest message and may want a gentle follow-up.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    loadClientProfileFacts,
    buildMemoryBlock,
    buildClientProfileBlock,
    buildCoachBioBlock,
    buildNameUsePolicyBlock,
    buildHeardFirstConversationBlock,
    buildShannonDmTuningBlock,
    loadEditExamples,
    callVertexAIModel,
    callGeminiFallback,
    normalizeCoachDraftText,
    stripLeadingGreeting,
    truncate,
    formatTimedConversationLine,
} = require('./_lib/client-context');

const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function response(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function getHeader(headers = {}, name) {
    const lower = name.toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

function assertUuid(value, label) {
    const id = String(value || '').trim();
    if (!UUID_RE.test(id)) {
        const err = new Error(`Invalid ${label}`);
        err.statusCode = 400;
        throw err;
    }
    return id;
}

async function requireShannonAdmin(event) {
    const authHeader = getHeader(event.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: response(401, { error: 'Unauthorized' }) };

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) return { response: response(401, { error: 'Unauthorized' }) };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (email !== BALANCE_ADMIN_EMAIL) return { response: response(403, { error: 'Forbidden' }) };
    return { user };
}

function cleanText(value) {
    return String(value || '')
        .replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '[photo]')
        .replace(/\[AUDIO:https?:\/\/[^\s\]]+\]/gi, '[voice note]')
        .replace(/\[(?:VIDEO|video):\s*https?:\/\/[^\]]+\]/gi, '[video]')
        .replace(/\s+/g, ' ')
        .trim();
}

function newestFirst(rows) {
    return [...(rows || [])].sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
}

function buildHistoryLines(messages, { outboundSpeaker = 'Shannon', inboundSpeaker = 'Client' } = {}) {
    const ascending = [...(messages || [])].sort((a, b) => Date.parse(a.created_at || '') - Date.parse(b.created_at || ''));
    return ascending.map((m, idx) => {
        const isOut = m.direction === 'out' || m.sender === 'coach';
        return formatTimedConversationLine({
            speaker: isOut ? outboundSpeaker : inboundSpeaker,
            text: cleanText(m.text || m.message || ''),
            createdAt: m.created_at,
            previousCreatedAt: ascending[idx - 1]?.created_at,
            now: new Date(),
        });
    }).join('\n');
}

async function loadLeadTarget(threadId) {
    const rows = await supabaseQuery(
        `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,lead_stage,last_inbound_at,last_outbound_at,linked_user_id,coach_id,goals,communication_style,running_notes,injuries_limits,personal_context,coach_instructions,qualifier,custom_data&id=eq.${encodeURIComponent(threadId)}&limit=1`
    );
    const thread = rows[0];
    if (!thread) {
        const err = new Error('Thread not found');
        err.statusCode = 404;
        throw err;
    }

    const messages = newestFirst(await supabaseQuery(
        `ig_messages?select=id,direction,text,created_at&thread_id=eq.${encodeURIComponent(threadId)}&order=created_at.desc&limit=18`
    ));
    const latest = messages[0] || null;
    if (!latest || latest.direction !== 'out') {
        const err = new Error('They have replied since your last message. Open DMs instead.');
        err.statusCode = 409;
        throw err;
    }

    let linkedProfile = null;
    if (thread.linked_user_id) {
        try { linkedProfile = await loadClientProfileFacts(thread.linked_user_id); }
        catch { linkedProfile = null; }
    }

    const name = linkedProfile?.name || thread.profile_name || thread.ig_username || 'Lead';
    const memoryBlock = thread.linked_user_id && thread.coach_id
        ? buildMemoryBlock(await loadClientMemory(thread.coach_id, thread.linked_user_id).catch(() => null))
        : buildMemoryBlock({
            goals: thread.goals,
            communication_style: thread.communication_style,
            running_notes: thread.running_notes,
            injuries_limits: thread.injuries_limits,
            personal_context: thread.personal_context,
            coach_instructions: thread.coach_instructions,
        });
    const profileBlock = buildClientProfileBlock({
        clientName: name,
        profile: linkedProfile || { customData: thread.custom_data || {} },
        customData: thread.custom_data || {},
    });

    return {
        targetType: 'lead',
        coachId: thread.coach_id || '',
        clientId: thread.linked_user_id || null,
        name,
        channel: thread.channel === 'messenger' ? 'messenger' : 'instagram',
        thread,
        messages,
        latest,
        lastOutboundAt: thread.last_outbound_at || latest.created_at,
        lastInboundAt: thread.last_inbound_at || '',
        memoryBlock,
        profileBlock,
        idempotencyKey: `needs_attention:lead:${thread.id}:${thread.last_outbound_at || latest.created_at}`,
    };
}

async function loadClientTarget(clientId, coachId) {
    const users = await supabaseQuery(
        `users?select=id,name,email,ig_handle&id=eq.${encodeURIComponent(clientId)}&limit=1`
    );
    const user = users[0];
    if (!user) {
        const err = new Error('Client not found');
        err.statusCode = 404;
        throw err;
    }

    const pairs = encodeURIComponent(`(and(sender_id.eq.${coachId},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${coachId}))`);
    const rawMessages = newestFirst(await supabaseQuery(
        `nudges?select=id,sender_id,receiver_id,message,created_at&or=${pairs}&order=created_at.desc&limit=18`
    ));
    const messages = rawMessages.map(m => ({
        ...m,
        text: m.message,
        direction: m.sender_id === coachId ? 'out' : 'in',
        sender: m.sender_id === coachId ? 'coach' : 'client',
    }));
    const latest = messages[0] || null;
    if (!latest || latest.direction !== 'out') {
        const err = new Error('They have replied since your last message. Open DMs instead.');
        err.statusCode = 409;
        throw err;
    }

    const memoryBlock = buildMemoryBlock(await loadClientMemory(coachId, clientId).catch(() => null));
    const profile = await loadClientProfileFacts(clientId).catch(() => null);
    const profileBlock = buildClientProfileBlock({
        clientName: user.name || user.email || 'Client',
        profile: profile || {},
    });

    return {
        targetType: 'client',
        coachId,
        clientId,
        name: user.name || user.email || 'Client',
        channel: 'in_app',
        thread: null,
        messages,
        latest,
        lastOutboundAt: latest.created_at,
        lastInboundAt: messages.find(m => m.direction === 'in')?.created_at || '',
        memoryBlock,
        profileBlock,
        idempotencyKey: `needs_attention:client:${clientId}:${latest.created_at}`,
    };
}

async function generateNeedsAttentionDraft(target) {
    const historyText = buildHistoryLines(target.messages, {
        inboundSpeaker: target.name,
    }) || '(no recent history found)';
    const editExamples = await loadEditExamples({
        clientId: target.clientId || undefined,
        max: 4,
    }).catch(() => '');
    const promptNow = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' });
    const prompt = `
You are drafting a private message as Shannon from Balance. Do not mention AI, automation, prompts, or systems.

This is a Needs Attention follow-up. Shannon sent the latest message and the person has not replied yet.
Your job is to decide whether the thread needs a real follow-up or a very light no-pressure check-in.

Rules:
- Keep it casual, human, and short. One to three sentences.
- Do not guilt them for not replying.
- If Shannon's last message asked a concrete question or left a next step, follow up on that exact thing.
- If the conversation looks naturally finished, send a tiny low-pressure check-in or leave-the-door-open message.
- Do not restart with generic discovery questions like "what does a normal day look like".
- Do not pitch the app, challenge, or coaching unless they were already clearly asking how to start.
- No greetings unless it would feel odd without one. Use their name sparingly.
- Use Australian casual language, but do not overdo slang.

${buildCoachBioBlock()}
${buildNameUsePolicyBlock()}
${buildHeardFirstConversationBlock()}
${buildShannonDmTuningBlock()}

PERSON: ${target.name}
CHANNEL: ${target.channel}
CURRENT TIME (Australia/Brisbane): ${promptNow}
${target.profileBlock || ''}
${target.memoryBlock || ''}

RECENT CONVERSATION (oldest to newest):
${historyText}
${editExamples || ''}

Reply with just the message text.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 900, temperature: 0.75 };
    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(normalizeCoachDraftText(reply), target.name), model: 'vertex-v7-needs-attention' };
    } catch (err) {
        console.warn('[needs-attention-draft] Vertex failed, falling back:', err.message);
    }
    const fallback = await callGeminiFallback(contents, generationConfig);
    return { text: stripLeadingGreeting(normalizeCoachDraftText(fallback), target.name), model: 'gemini-needs-attention-fallback' };
}

function buildAlertRow(target, draft) {
    const latestOut = target.messages.find(m => m.direction === 'out') || target.latest || {};
    const latestIn = target.messages.find(m => m.direction === 'in') || {};
    const channelLabel = target.channel === 'messenger' ? 'Messenger' : (target.channel === 'instagram' ? 'Instagram' : 'in-app');
    const data = {
        channel: target.channel,
        delivery_channel: target.channel === 'in_app' ? 'in_app' : target.channel,
        ig_thread_id: target.thread?.id || null,
        subscriber_id: target.thread?.subscriber_id || null,
        ig_username: target.thread?.ig_username || null,
        lead_stage: target.thread?.lead_stage || null,
        qualifier: target.thread?.qualifier || null,
        follow_up_reason: 'Shannon sent the latest message and they have not replied yet.',
        follow_up_source: `${channelLabel} conversation from the last week`,
        follow_up_signal: 'needs_attention_recent_waiting',
        target_type: target.targetType,
        drafted_at: new Date().toISOString(),
        draft_model: draft.model,
        draft_text: draft.text,
        last_outbound_at: target.lastOutboundAt || latestOut.created_at || null,
        last_inbound_at: target.lastInboundAt || latestIn.created_at || null,
        last_outbound_message: latestOut.text ? truncate(cleanText(latestOut.text), 500) : null,
        last_inbound_message: latestIn.text ? truncate(cleanText(latestIn.text), 500) : null,
    };
    return {
        client_id: target.clientId,
        client_name: target.name,
        coach_id: target.coachId,
        alert_type: 'follow_up_review',
        priority: 'medium',
        title: `${target.name} may need a follow-up`,
        description: `Last ${channelLabel} message from Shannon was ${target.lastOutboundAt ? 'sent ' + target.lastOutboundAt : 'the latest message'}.`,
        suggested_message: draft.text,
        status: 'pending',
        data,
    };
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return response(500, { error: 'Server misconfigured' });

    const admin = await requireShannonAdmin(event);
    if (admin.response) return admin.response;

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return response(400, { error: 'Invalid JSON' }); }

    try {
        const targetType = String(body.targetType || '').trim();
        const targetId = assertUuid(body.targetId, 'targetId');
        const coachId = admin.user?.id;
        let target;
        if (targetType === 'lead') {
            target = await loadLeadTarget(targetId);
            target.coachId = target.coachId || coachId;
        } else if (targetType === 'client') {
            target = await loadClientTarget(targetId, coachId);
        } else {
            return response(400, { error: 'Invalid targetType' });
        }
        if (target.coachId && target.coachId !== coachId) {
            return response(403, { error: 'Forbidden' });
        }
        target.coachId = coachId;

        const draft = await generateNeedsAttentionDraft(target);
        if (!draft.text) return response(500, { error: 'Draft came back empty' });

        const result = await insertCoachAlert(buildAlertRow(target, draft), target.idempotencyKey);
        return response(200, {
            ok: true,
            alert_id: result.alertId,
            deduped: !!result.deduped,
            draft_model: draft.model,
        });
    } catch (err) {
        console.error('[needs-attention-draft] failed:', err);
        return response(err.statusCode || 500, { error: err.message || 'Failed to draft message' });
    }
};
