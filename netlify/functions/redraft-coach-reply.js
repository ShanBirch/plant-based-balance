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
 *   POST { alertId, hint, currentDraft? }
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
    buildAppNavigationGuideBlock,
    buildAppXpGuideBlock,
    buildNameUsePolicyBlock,
    buildRelationshipDiscoveryBlock,
    buildHeardFirstConversationBlock,
    buildShannonDmTuningBlock,
    loadWeeklyAppContext,
    callVertexAIModel,
    callGeminiFallback,
    normalizeCoachDraftText,
    stripLeadingGreeting,
    truncate,
    replacePhotoMarkers,
    replaceAudioMarkers,
    replaceVideoMarkers,
    formatTimedConversationLine,
    splitCoachDraftIntoDmBubbles,
} = require('./_lib/client-context');

const HISTORY_LIMIT = 30;
const DEEP_REDRAFT_MAX_OUTPUT_TOKENS = 8192;

function tail(s, n) {
    if (!s) return '';
    s = String(s);
    return s.length <= n ? s : '…' + s.slice(-(n - 1));
}

function replaceMediaMarkers(text) {
    return replaceVideoMarkers(
        replaceAudioMarkers(
            replacePhotoMarkers(String(text || ''), () => '[photo]'),
            () => '[voice note]'
        ),
        () => '[video]'
    );
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
        const cleaned = replaceMediaMarkers(m.message || '');
        events.push({
            speaker: `${speaker} (in-app)`,
            text: cleaned,
            created_at: m.created_at,
        });
    });
    ig.forEach(m => {
        const speaker = m.direction === 'in' ? clientName : 'Shannon';
        const cleaned = replaceMediaMarkers(m.text || '');
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
        maxOutputTokens: DEEP_REDRAFT_MAX_OUTPUT_TOKENS,
        lengthInstruction: 'This is a deep reply. It may be 4-10 short IG-style bubbles or paragraphs, roughly 1400-3000+ characters total if needed. Answer the emotional thread, the practical thread, and Shannon-specific questions without becoming polished or therapy-like. Do not compress a long multi-topic client message into a tiny reply.',
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
    const currentDraft = normalizeCoachDraftText(body.currentDraft || '').trim();
    if (currentDraft.length > 8000) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Current draft too long (max 8000 chars)' }) };
    }

    // 1. Load alert
    let alert;
    try {
        const rows = await supabaseQuery(
            `coach_alerts?select=id,client_id,client_name,coach_id,alert_type,status,suggested_message,scheduled_reply_text,data&id=eq.${alertId}&limit=1`
        );
        alert = rows[0];
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert lookup failed' }) };
    }
    if (!alert) return { statusCode: 404, body: JSON.stringify({ error: 'Alert not found' }) };
    if (alert.status !== 'pending') {
        return { statusCode: 409, body: JSON.stringify({ error: 'Alert not pending', status: alert.status }) };
    }
    const data = alert.data || {};
    const storedDraft = normalizeCoachDraftText(
        alert.suggested_message
        || data.draft_text
        || alert.scheduled_reply_text
        || data.scheduled_reply_text
        || ''
    ).trim();
    const previousDraft = currentDraft || storedDraft;
    if (!previousDraft) {
        return { statusCode: 400, body: JSON.stringify({ error: 'No prior draft to redraft' }) };
    }

    const clientName = alert.client_name || 'Client';
    const inboundBatch = Array.isArray(data.inbound_message_batch)
        ? data.inbound_message_batch
            .map((m, i) => {
                const text = replaceMediaMarkers(String(m?.text || '').trim());
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
    const appNavigationGuide = buildAppNavigationGuideBlock();
    const appXpGuide = buildAppXpGuideBlock();
    const nameUsePolicy = buildNameUsePolicyBlock();
    const relationshipDiscovery = buildRelationshipDiscoveryBlock();
    const heardFirstConversation = buildHeardFirstConversationBlock();
    const shannonDmTuning = buildShannonDmTuningBlock();
    const historyBlock = buildHistoryBlock({ inApp, ig, clientName, coachId, clientId });
    const replyMode = resolveRedraftReplyMode({ data, messagePreview, historyBlock });

    // 4. Prompt — explicit "redraft" framing, with the hint as the
    //    primary directive. Keep it tight.
    let prompt = `You are redrafting a reply Shannon (the coach) drafted to a client. The original draft is below. Shannon has given a one-line hint about what to change. Produce a NEW reply that follows the hint while staying true to Shannon's voice.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into content. NO em-dashes. Australian casual, lowercase-friendly. Keep it 1-3 sentences max unless the hint asks otherwise. NEVER reveal AI / automation / "trained on Shannon's voice".
${nameUsePolicy}
${relationshipDiscovery}
${heardFirstConversation}
${shannonDmTuning}
${coachBio}
${appNavigationGuide}
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
    if (normalizeCoachDraftText(newText) === normalizeCoachDraftText(previousDraft)) {
        const retryContents = [{
            role: 'user',
            parts: [{
                text: `${prompt}\n\nThe previous attempt came back the same as the original. Redraft it again now so the wording materially changes and Shannon can see the hint was applied. Output only the new reply text.`,
            }],
        }];
        try {
            const retry = await callVertexAIModel(retryContents, { ...generationConfig, temperature: 0.95 });
            const retryText = stripLeadingGreeting(retry);
            if (retryText && normalizeCoachDraftText(retryText) !== normalizeCoachDraftText(previousDraft)) {
                newText = retryText;
                model = `${model}+retry`;
            }
        } catch (err) {
            console.warn(`[redraft] same-text retry failed: ${err.message}`);
            try {
                const retry = await callGeminiFallback(retryContents, { ...generationConfig, temperature: 0.95 });
                const retryText = stripLeadingGreeting(retry);
                if (retryText && normalizeCoachDraftText(retryText) !== normalizeCoachDraftText(previousDraft)) {
                    newText = retryText;
                    model = `${model}+gemini-retry`;
                }
            } catch (err2) {
                console.warn(`[redraft] same-text Gemini retry failed: ${err2.message}`);
            }
        }
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
    delete mergedData.draft_review;
    delete mergedData.context_review;
    delete mergedData.media_review;
    delete mergedData.last_send_error;
    delete mergedData.last_send_error_code;
    delete mergedData.last_send_error_at;
    delete mergedData.scheduled_reply_text;
    delete mergedData.sent_message;
    try {
        await supabaseQuery(`coach_alerts?id=eq.${alertId}`, {
            method: 'PATCH',
            body: {
                suggested_message: newText,
                scheduled_reply_text: null,
                scheduled_for: null,
                scheduled_at: null,
                data: mergedData,
            },
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
            draft_messages: newChunks.length ? newChunks : [newText],
            model,
            preview: truncate(newText, 200),
        }),
    };
};
