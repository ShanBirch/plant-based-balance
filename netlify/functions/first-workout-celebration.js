/**
 * First Workout Celebration — Event-Driven Function
 *
 * Fires the moment a coached client logs their very first workout row in
 * public.workouts. Drafts a warm congrats message in Shannon's voice and
 * queues it as a `coach_alerts` row so Shannon can tap-send from the
 * lockscreen.
 *
 * Trigger: database/first_workout_trigger.sql (fires once per first row,
 * only if the user has an active coach_clients assignment).
 *
 * Tone: warm, not over-the-top. A first workout is a meaningful start, but
 * save the "fkn legend" energy for PBs. 1-2 sentences, acknowledge the
 * action, invite a short reply.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    maybeAutoSendDraft,
    buildMemoryBlock,
    loadEditExamples,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    isTestAccount,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

async function resolveCoach(clientId) {
    try {
        const links = await supabaseQuery(
            `coach_clients?select=coach_id&client_id=eq.${clientId}&status=eq.active&order=assigned_at.asc&limit=1`
        );
        return links[0]?.coach_id || null;
    } catch (e) {
        return null;
    }
}

async function loadClientName(clientId) {
    try {
        const users = await supabaseQuery(`users?select=name,email&id=eq.${clientId}&limit=1`);
        if (users[0]) return users[0].name || users[0].email?.split('@')[0] || 'Client';
    } catch (e) { /* non-critical */ }
    return 'Client';
}

async function generateFirstWorkoutDraft({ clientName, memoryBlock, templateName }) {
    const editExamples = await loadEditExamples({ lookback: 15, max: 4 });

    const workoutLine = templateName
        ? `They just logged their FIRST workout: "${templateName}".`
        : `They just logged their FIRST workout.`;

    const prompt = `Draft a SHORT message celebrating a client logging their very first workout with Shannon. This is a meaningful start — a warm acknowledgement, not over-the-top hype (save "fkn legend" for PB moments).

CRITICAL — DO NOT GREET with "hey [name]" / "hi" / "yo". Jump straight into content. Aussie casual, 1-2 sentences max, lowercase-friendly, warm.

${workoutLine} Acknowledge it, maybe tie it back to something they mentioned (goals, plateau, getting started). End with ONE open question OR a short encouragement.

Avoid: "great job", "well done", "congrats on joining", meal plans, instruction. Save hype for later milestones.

CLIENT: ${clientName}${memoryBlock || ''}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 1024, temperature: 0.85 };

    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[first-workout] Vertex failed, falling back: ${err.message}`);
    }
    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error(`[first-workout] Gemini fallback failed: ${err.message}`);
        return { text: '', model: 'none' };
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { clientId, templateName } = payload;
    if (!clientId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing clientId' }) };
    }

    // 1. Resolve coach
    const coachId = await resolveCoach(clientId);
    if (!coachId) {
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_coach' }) };
    }

    // Skip test accounts (Shannon's own second account etc.)
    if (await isTestAccount(clientId)) {
        return { statusCode: 200, body: JSON.stringify({ skipped: 'test_account' }) };
    }

    // 2. Pre-check dedup — cheap exit before the Vertex call. The atomic
    //    guarantee comes from the idempotency_key UNIQUE index on insert
    //    below; this just saves drafting cost when we already know the
    //    alert exists.
    const idempotencyKey = `first_workout:${clientId}`;
    try {
        const existing = await supabaseQuery(
            `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
        );
        if (existing.length > 0) {
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup' }) };
        }
    } catch (e) { /* continue */ }

    // 3. Draft
    const clientName = await loadClientName(clientId);
    const memory = await loadClientMemory(coachId, clientId);
    const memoryBlock = buildMemoryBlock(memory);

    let draftText = '';
    let draftModel = 'none';
    try {
        const draft = await generateFirstWorkoutDraft({ clientName, memoryBlock, templateName });
        draftText = draft.text;
        draftModel = draft.model;
    } catch (err) {
        console.error('[first-workout] draft generation failed:', err.message);
    }

    // 4. Insert alert
    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'first_workout',
        priority: 'high',
        title: `🏁 ${clientName} logged their first workout!`,
        description: templateName ? `First workout: "${truncate(templateName, 120)}". Drop a warm acknowledgement.` : `First workout logged. Drop a warm acknowledgement.`,
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            template_name: templateName || null,
            draft_model: draftModel,
            drafted_at: new Date().toISOString(),
        },
    };

    let alertId = null;
    let deduped = false;
    try {
        const result = await insertCoachAlert(alertRow, idempotencyKey);
        alertId = result.alertId;
        deduped = result.deduped;
        if (deduped) {
            console.log(`[first-workout] dedup race — alert ${alertId} already exists for ${clientId}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup_race', alert_id: alertId }) };
        }
        console.log(`[first-workout] alert ${alertId} for ${clientId} (model: ${draftModel})`);
    } catch (err) {
        console.error('[first-workout] alert insert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    // 5. Auto-send for trusted clients, otherwise push the approve-gate
    //    notification.
    let autoSent = false;
    if (draftText && alertId) {
        autoSent = await maybeAutoSendDraft({
            coachId,
            clientId,
            clientName,
            alertId,
            alertType: 'first_workout',
            draftText,
            siteUrl: SITE_URL,
            pushTitlePrefix: '🏁 Auto-sent',
        });
    }

    if (!autoSent && draftText && alertId) {
        try {
            const title = `🏁 ${clientName} — first workout!`;
            const body = templateName
                ? `Just logged: ${truncate(templateName, 60)}\n→ ${truncate(draftText, 140)}`
                : `Their first workout.\n→ ${truncate(draftText, 140)}`;
            await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
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
                    draftText,
                    isSimpleReply: false,
                }),
            }).catch(e => console.warn(`[first-workout] push dispatch failed: ${e.message}`));
        } catch (err) {
            console.warn('[first-workout] push failed:', err.message);
        }
    }

    return { statusCode: 200, body: JSON.stringify({ alert_id: alertId, draft_model: draftModel, draft_generated: !!draftText, auto_sent: autoSent }) };
};
