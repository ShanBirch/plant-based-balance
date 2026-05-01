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
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    replacePhotoMarkers,
    formatTimedConversationLine,
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
    const messagePreview = data.message_preview || '';

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
    const coachBio = buildCoachBioBlock();
    const historyBlock = buildHistoryBlock({ inApp, ig, clientName, coachId, clientId });

    // 4. Prompt — explicit "redraft" framing, with the hint as the
    //    primary directive. Keep it tight.
    const prompt = `You are redrafting a reply Shannon (the coach) drafted to a client. The original draft is below. Shannon has given a one-line hint about what to change. Produce a NEW reply that follows the hint while staying true to Shannon's voice.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content. NO em-dashes. Australian casual, lowercase-friendly. Keep it 1-3 sentences max unless the hint asks otherwise. NEVER reveal AI / automation / "trained on Shannon's voice".
${coachBio}

CLIENT: ${clientName}${profileBlock}${memoryBlock ? '\n' + memoryBlock : ''}

RECENT CONVERSATION (older → newer):
${tail(historyBlock, 4000)}${messagePreview ? `\n\nTHE NEW CLIENT MESSAGE the original draft was replying to:\n${messagePreview}` : ''}

ORIGINAL DRAFT (this is what you're rewriting):
${previousDraft}

SHANNON'S HINT:
${hint}

Rewrite the reply. Output ONLY the new reply text — no quotes, no labels, no commentary.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 2048, temperature: 0.8 };

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

    const mergedData = {
        ...data,
        redraft_history: newHistory,
        redraft_count: newHistory.length,
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
