/**
 * redraft-coach-reply — re-runs the AI draft for a pending alert with a
 * Shannon-supplied hint ("warmer", "shorter", "ask about her trip", etc.).
 *
 * Saves the back-and-forth tedium of editing a draft from scratch when the
 * AI is in the right ballpark but missed a beat — Shannon types one line
 * of guidance, the AI redrafts. The new text replaces alert.suggested_message
 * and the prior draft + the hint are stamped into data.redraft_history so
 * the voice-match feedback loop can later study what kinds of hints land.
 *
 * Auth: capability-token model — alertId is the cap. Same as send-coach-
 * reply, schedule-coach-reply, etc.
 *
 * Request:
 *   POST { alertId, hint }
 *
 * Response:
 *   { ok: true, alertId, suggested_message, redraft_count }
 */

const {
    supabaseQuery,
    loadClientMemory,
    buildMemoryBlock,
    loadClientProfileFacts,
    buildClientProfileBlock,
    buildCoachBioBlock,
    buildAppXpGuideBlock,
    buildNameUsePolicyBlock,
    buildRelationshipDiscoveryBlock,
    loadWeeklyAppContext,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    replacePhotoMarkers,
    formatTimedConversationLine,
    splitCoachDraftIntoDmBubbles,
} = require('./_lib/client-context');

const HISTORY_LIMIT = 30;

function tail(s, n) {
    if (!s) return '';
    s = String(s);
    return s.length <= n ? s : '…' + s.slice(-(n - 1));
}

async function loadInAppHistory(coachId, clientId) {
    if (!coachId || !clientId) return [];
    try {
        const rows = await supabaseQuery(
            `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${coachId},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${coachId}))&order=created_at.desc&limit=${HISTORY_LIMIT}`
        );
        return rows.reverse();
    } catch (e) {
        console.warn('[redraft] in-app history load failed:', e.message);
        return [];
    }
}

async function loadIgHistory(threadId) {
    if (!threadId) return [];
    try {
        const rows = await supabaseQuery(
            `ig_messages?select=direction,text,created_at&thread_id=eq.${threadId}&order=created_at.desc&limit=${HISTORY_LIMIT}`
        );
        return rows.reverse();
    } catch (e) {
        console.warn('[redraft] IG history load failed:', e.message);
        return [];
    }
}

function buildHistoryBlock({ inApp, ig, clientName, coachId, clientId }) {
    const events = [];
    inApp.forEach(m => {
        const speaker = m.sender_id === clientId ? clientName : 'Shannon';
        const cleaned = replacePhotoMarkers(m.message || '', () => '[photo]');
        events.push({
            speaker: `${speaker} (in-app)`,
            text: cleaned,
            created_at: m.created_at,
        });
    });
    ig.forEach(m => {
        const speaker = m.direction === 'in' ? clientName : 'Shannon';
        const cleaned = replacePhotoMarkers(m.text || '', () => '[photo]');
        events.push({
            speaker: `${speaker} (IG/FB)`,
            text: cleaned,
            created_at: m.created_at,
        });
    });
    events.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    const now = new Date();
    const lines = events.map((event, i) => formatTimedConversationLine({
        speaker: event.speaker,
        text: event.text,
        createdAt: event.created_at,
        previousCreatedAt: events[i - 1]?.created_at,
        now,
    }));
    return lines.length === 0 ? '(no recent history)' : lines.join('\n');
}

function countWords(text) {
    return (String(text || '').match(/\b[\w'’]+\b/g) || []).length;
}

function resolveRedraftReplyMode({ data, messagePreview, historyBlock }) {
    const combined = `${messagePreview || ''}\n${historyBlock || ''}`;
    const words = countWords(messagePreview || '');
    const chars = String(messagePreview || '').length;
    const emotionalSignal = /\b(grief|lost|loss|passed|died|death|trauma|depression|dark|pain|lonely|alone|isolat|sister|father|mum|family|trigger|triggered|apolog|bullied|pathetic|koda|pepper|teddy|baby|babies|soul mate|soulmate)\b/i.test(combined);
    const deep = data?.draft_reply_mode === 'deep'
        || words >= 110
        || chars >= 700
        || (emotionalSignal && words >= 55);
    if (!deep) {
        return {
            name: 'standard',
            maxOutputTokens: 2048,
            lengthInstruction: 'Keep it 1-3 sentences max unless the hint asks otherwise.',
        };
    }
    return {
        name: 'deep',
        maxOutputTokens: 4096,
        lengthInstruction: 'This is a deep reply. It may be 3-6 short IG-style bubbles or paragraphs, roughly 900-1600 characters total if needed. Answer the emotional thread, the practical thread, and Shannon-specific questions without becoming polished or therapy-like.',
    };
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const alertId = (body.alertId || '').trim();
    const hint = (body.hint || '').trim();
    if (!alertId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId' }) };
    }
    if (!hint) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing hint — describe what to change' }) };
    }
    if (hint.length > 500) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Hint too long (max 500 chars)' }) };
    }

    // 1. Load alert
    let alert;
    try {
        const rows = await supabaseQuery(
            `coach_alerts?select=id,client_id,client_name,coach_id,alert_type,status,suggested_message,data&id=eq.${alertId}&limit=1`
        );
        alert = rows[0];
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert lookup failed' }) };
    }
    if (!alert) return { statusCode: 404, body: JSON.stringify({ error: 'Alert not found' }) };
    if (alert.status !== 'pending') {
        return { statusCode: 409, body: JSON.stringify({ error: 'Alert not pending', status: alert.status }) };
    }
    if (!alert.suggested_message) {
        return { statusCode: 400, body: JSON.stringify({ error: 'No prior draft to redraft' }) };
    }

    const data = alert.data || {};
    const clientName = alert.client_name || 'Client';
    const previousDraft = alert.suggested_message;
    const inboundBatch = Array.isArray(data.inbound_message_batch)
        ? data.inbound_message_batch
            .map((m, i) => {
                const text = replacePhotoMarkers(String(m?.text || '').trim(), () => '[photo]');
                if (!text) return '';
                return `${i + 1}. ${text}${m?.is_current ? ' (latest)' : ''}`;
            })
            .filter(Boolean)
        : [];
    const messagePreview = inboundBatch.length > 0
        ? inboundBatch.join('\n')
        : (data.message_preview || '');

    // 2. Resolve clientId — same fallback as control-context (linked IG
    //    threads may have alert.client_id=NULL but the thread has
    //    linked_user_id set).
    let clientId = alert.client_id;
    const igThreadId = data.ig_thread_id || null;
    if (!clientId && igThreadId) {
        try {
            const tRows = await supabaseQuery(`ig_threads?select=linked_user_id&id=eq.${igThreadId}&limit=1`);
            if (tRows[0] && tRows[0].linked_user_id) clientId = tRows[0].linked_user_id;
        } catch (e) { /* non-fatal */ }
    }

    // 3. Load context — same union the producers see, so the redraft is
    //    grounded in the same world the original was.
    const coachId = alert.coach_id;
    const [memory, inApp, ig] = await Promise.all([
        coachId && clientId ? loadClientMemory(coachId, clientId).catch(() => null) : Promise.resolve(null),
        loadInAppHistory(coachId, clientId),
        loadIgHistory(igThreadId),
    ]);
    const memoryBlock = memory ? buildMemoryBlock(memory) : '';
    const profile = clientId ? await loadClientProfileFacts(clientId).catch(() => null) : null;
    const profileBlock = buildClientProfileBlock({ clientName, profile: profile || {} });
    const weeklyAppContext = clientId
        ? (await loadWeeklyAppContext(clientId, { lookbackDays: 7 }).catch(() => null))
        : null;
    const weeklyAppText = weeklyAppContext?.text || '';
    const coachBio = buildCoachBioBlock();
    const appXpGuide = buildAppXpGuideBlock();
    const nameUsePolicy = buildNameUsePolicyBlock();
    const relationshipDiscovery = buildRelationshipDiscoveryBlock();
    const historyBlock = buildHistoryBlock({ inApp, ig, clientName, coachId, clientId });
    const replyMode = resolveRedraftReplyMode({ data, messagePreview, historyBlock });

    // 4. Prompt — explicit "redraft" framing, with the hint as the
    //    primary directive. Keep it tight.
    let prompt = `You are redrafting a reply Shannon (the coach) drafted to a client. The original draft is below. Shannon has given a one-line hint about what to change. Produce a NEW reply that follows the hint while staying true to Shannon's voice.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content. NO em-dashes. Australian casual, lowercase-friendly. Keep it 1-3 sentences max unless the hint asks otherwise. NEVER reveal AI / automation / "trained on Shannon's voice".
${nameUsePolicy}
${relationshipDiscovery}
${coachBio}
${appXpGuide}

ACTION CLAIMS:
- You are only rewriting draft text. Do not claim Shannon has updated, moved, fixed, re-linked, checked, created, sent, or changed anything unless the conversation or app data below shows that action already happened.
- Never write a sequence like "I'll do that now" and then "done" / "just finished" in the same reply. That is fake and unnatural.
- If the client asks Shannon to change something, either tell them where they can do it in the app, or say Shannon can sort it / will have a look. Do not claim completion.

CLIENT: ${clientName}${profileBlock}${memoryBlock ? '\n' + memoryBlock : ''}

RECENT CONVERSATION (older → newer):
${tail(historyBlock, 4000)}${messagePreview ? `\n\nTHE NEW CLIENT MESSAGE(S) the original draft was replying to:\n${messagePreview}` : ''}

RECENT APP SNAPSHOT (last 7 days, use only when relevant):
${weeklyAppText || '(no recent app activity snapshot available)'}

ORIGINAL DRAFT (this is what you're rewriting):
${previousDraft}

SHANNON'S HINT:
${hint}

Rewrite the reply. Output ONLY the new reply text — no quotes, no labels, no commentary.`;

    prompt = prompt.replace(
        'Keep it 1-3 sentences max unless the hint asks otherwise.',
        replyMode.lengthInstruction
    );
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: replyMode.maxOutputTokens, temperature: 0.8 };

    let newText = '';
    let model = 'none';
    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        newText = stripLeadingGreeting(reply);
        model = 'vertex-v7-redraft';
    } catch (err) {
        console.warn(`[redraft] Vertex failed, falling back to Gemini: ${err.message}`);
        try {
            const reply = await callGeminiFallback(contents, generationConfig);
            newText = stripLeadingGreeting(reply);
            model = 'gemini-redraft';
        } catch (err2) {
            console.error('[redraft] Gemini fallback failed:', err2.message);
            return { statusCode: 502, body: JSON.stringify({ error: 'Redraft generation failed', details: err2.message }) };
        }
    }
    if (!newText) {
        return { statusCode: 502, body: JSON.stringify({ error: 'Redraft returned empty' }) };
    }

    // 5. Update alert. Append the prior draft + hint to data.redraft_history
    //    so we can later study which hints land which kinds of corrections.
    const priorHistory = Array.isArray(data.redraft_history) ? data.redraft_history : [];
    const newHistory = [
        ...priorHistory,
        {
            previous: previousDraft,
            hint,
            model,
            redrafted_at: new Date().toISOString(),
        },
    ].slice(-10); // cap so the JSONB doesn't grow unbounded

    const redraftedAt = new Date().toISOString();
    const newChunks = splitCoachDraftIntoDmBubbles(newText);
    const mergedData = {
        ...data,
        redraft_history: newHistory,
        redraft_count: newHistory.length,
        redraft_reply_mode: replyMode.name,
        draft_text: newText,
        draft_messages: newChunks.length ? newChunks : [newText],
        drafted_at: redraftedAt,
        draft_evidence: {
            ...(data.draft_evidence || {}),
            source_mode: 'saved_at_redraft',
            current_message: truncate(messagePreview || '', 4000),
            recent_timeline: tail(historyBlock || '', 4000),
            recent_activity: truncate(weeklyAppText || '', 3000),
            recent_workouts: truncate(weeklyAppContext?.recentWorkoutEvidence || data.draft_evidence?.recent_workouts || '', 2000),
            memory_context: truncate(memoryBlock.replace(/\n{3,}/g, '\n\n').trim(), 2000),
        },
    };
    try {
        await supabaseQuery(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: { suggested_message: newText, data: mergedData },
            prefer: 'return=minimal',
        });
    } catch (e) {
        console.error('[redraft] PATCH failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save redraft' }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alertId,
            suggested_message: newText,
            redraft_count: newHistory.length,
            model,
            preview: truncate(newText, 200),
        }),
    };
};
