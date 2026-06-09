/**
 * PB Celebration Draft — Event-Driven Function
 *
 * Fires the moment a client breaks a personal best. Immediate PB coaching
 * alerts are off by default because they happen too often; PBs still feed
 * weekly/Sunday check-ins from `pb_history`.
 *
 * Trigger: DB trigger on `pb_history` INSERT
 *          (see database/pb_celebration_trigger.sql)
 */

const {
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    maybeAutoSendDraft,
    buildMemoryBlock,
    loadClientProfileFacts,
    buildClientProfileBlock,
    buildNameUsePolicyBlock,
    buildRelationshipDiscoveryBlock,
    buildHeardFirstConversationBlock,
    loadEditExamples,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    isTestAccount,
    recentlyMessaged,
    loadClientSocialContact,
    buildSocialContactAlertData,
    fireDraftReasoning,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const PB_COACH_PUSH_ENABLED = process.env.PB_COACH_PUSH_ENABLED === 'true';
const PB_IMMEDIATE_COACH_ALERTS_ENABLED = process.env.PB_IMMEDIATE_COACH_ALERTS_ENABLED === 'true';
const PB_CELEBRATION_AUTO_SEND_ENABLED = false;

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
            loadRecentWorkouts(userId, oneWeekAgo, 3),
            supabaseQuery(`pb_history?select=exercise_name,pb_type,new_value,achieved_at&user_id=eq.${userId}&achieved_at=gte.${oneWeekAgo}&order=achieved_at.desc&limit=5`).catch(() => []),
        ]);
        if (workouts.length) snapshot.recent.push(`Recent workouts: ${workouts.map(w => w.templateName).join(', ')}`);
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

async function generateCelebrationDraft({ clientName, clientSnapshot, pbDescription, profileBlock, memoryBlock }) {
    const editExamples = await loadEditExamples({
        alertType: 'win_to_celebrate',
        lookback: 10,
        max: 4,
        label: 'LEARN FROM PAST EDITS — Shannon rewrote these AI drafts into how he actually celebrates. Mimic the SECOND version:',
    });

    const snapshotText = clientSnapshot.recent.length > 0
        ? clientSnapshot.recent.join('\n')
        : '(no recent activity snapshot)';
    const nameUsePolicy = buildNameUsePolicyBlock();
    const relationshipDiscovery = buildRelationshipDiscoveryBlock();
    const heardFirstConversation = buildHeardFirstConversationBlock();

    const prompt = `Draft a SHORT celebration message for a client who JUST hit a personal best. Send it unprompted — this is you reaching out to them.

CRITICAL — DO NOT GREET: Never start with "hey [name]", "hi", "yo". Jump straight into the hype. Coach-client relationship is already established.

Keep it brief — 1-2 sentences max. Match the energy of someone breaking a PB: hyped, slightly unhinged, Aussie casual, profanity welcome (that's Shannon's voice). No corporate fluff, no "great job" or "well done". Examples of the vibe: "fuckin hell", "legend", "smashed it", "what a unit".

Reference the specific numbers — it shows you noticed. If there's a meaningful improvement (+X kg / +Y reps), call it out.
If it fits naturally, end with ONE quick question about how it felt, what clicked, or what they want to chase next. Skip the question only if pure hype is clearly stronger.

${nameUsePolicy}
${relationshipDiscovery}
${heardFirstConversation}

CLIENT: ${clientName}${profileBlock || ''}${memoryBlock || ''}

PB THEY JUST HIT:
${pbDescription}

RECENT CONTEXT:
${snapshotText}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 1024, temperature: 0.9 };

    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[pb-celebration] Vertex failed, falling back to Gemini: ${err.message}`);
    }

    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error('[pb-celebration] Gemini fallback failed:', err.message);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Push notification — reuses the coach-draft inline-reply flow
// ============================================================

async function sendCelebrationPush({ clientId, clientName, pbHeadline, draftText, alertId, coachId }) {
    try {
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

    if (!PB_IMMEDIATE_COACH_ALERTS_ENABLED) {
        console.log(`[pb-celebration] immediate coaching alert skipped for ${userId} / ${exerciseName}; PB remains available for weekly check-ins`);
        return {
            statusCode: 200,
            body: JSON.stringify({
                skipped: 'immediate_pb_coaching_alerts_disabled',
                retained_for_weekly_checkins: true,
            }),
        };
    }

    // 1. Dedup — skip if we already alerted on this client's PB for this exercise in the last 24h
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const existing = await supabaseQuery(
            `coach_alerts?select=id&client_id=eq.${userId}&alert_type=eq.win_to_celebrate&data->>exercise_name=eq.${encodeURIComponent(exerciseName)}&created_at=gte.${yesterday}&limit=1`
        );
        if (existing.length > 0) {
            console.log(`[pb-celebration] dedup — existing alert for ${userId} / ${exerciseName}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup' }) };
        }
    } catch (e) { /* continue */ }

    // Skip test accounts
    if (await isTestAccount(userId)) {
        return { statusCode: 200, body: JSON.stringify({ skipped: 'test_account' }) };
    }

    // 2. Resolve client + find the coach to alert
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
            const admins = await supabaseQuery(`users?select=id&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
            if (admins[0]?.id) coachId = admins[0].id;
        } catch (e) { /* fall through */ }
    }
    if (!coachId) {
        console.warn('[pb-celebration] no coach/admin found — skipping');
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_coach' }) };
    }

    // Shannon's words: "I chatted to Shane yesterday on IG, so no need to
    // message him". If the coach already nudged this client within the last
    // 24h the PB celebration is almost certainly a double-message.
    if (await recentlyMessaged({ coachId, clientId: userId, hours: 24 })) {
        console.log(`[pb-celebration] skipping ${userId} — messaged within 24h`);
        return { statusCode: 200, body: JSON.stringify({ skipped: 'recently_messaged' }) };
    }

    const socialContact = await loadClientSocialContact(coachId, userId);

    // 3. Describe the PB
    const { headline, detail } = describePB({
        exerciseName, pbType, newValue, newWeightKg, newReps, previousValue, improvement,
    });

    // 4. Draft the celebration message
    let draftText = '';
    let draftModel = 'none';
    try {
        const [memory, profile] = await Promise.all([
            loadClientMemory(coachId, userId),
            loadClientProfileFacts(userId),
        ]);
        const memoryBlock = buildMemoryBlock(memory);
        const profileBlock = buildClientProfileBlock({ clientName, profile });
        const draft = await generateCelebrationDraft({
            clientName,
            clientSnapshot,
            pbDescription: detail,
            profileBlock,
            memoryBlock,
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
            preferred_delivery_channel: socialContact.hasSocialContact ? 'instagram' : 'in_app',
            in_app_fallback_reason: socialContact.hasSocialContact ? null : 'no linked IG contact found, approve into the Balance inbox',
            workout_celebration_social_contact: socialContact.hasSocialContact,
            ...buildSocialContactAlertData(socialContact),
            ...(socialContact.hasSocialContact ? {
                social_contact_reason: 'PB celebration should be approved first, then sent over IG/Facebook if available',
            } : {}),
            needs_you_required: true,
            operator_queue: 'needs_you',
            needs_you_reason: 'post-workout PB celebration needs Shannon approval before sending',
            needs_you_reasons: ['post_workout', 'personal_best'],
            codex_review: {
                decision: 'needs_you',
                queue: 'needs_you',
                reason: 'Post-workout PB celebration is a relationship moment Shannon should approve before it sends.',
                needs_shannon_approval: true,
                source: 'pb-celebration-draft',
                reviewed_at: new Date().toISOString(),
            },
        },
    };

    let alertId = null;
    let deduped = false;
    try {
        // Prefer pb_history_id (one row per PB event, perfect dedup key).
        // Fall back to (user, exercise, date) for cases where the trigger
        // payload omits it.
        const dayKey = new Date().toISOString().slice(0, 10);
        const idempotencyKey = historyId
            ? `win_to_celebrate:${historyId}`
            : `win_to_celebrate:${userId}:${exerciseName}:${dayKey}`;
        const result = await insertCoachAlert(alertRow, idempotencyKey);
        alertId = result.alertId;
        deduped = result.deduped;
        if (deduped) {
            console.log(`[pb-celebration] dedup race — alert ${alertId} already exists for ${userId} / ${exerciseName}`);
            return { statusCode: 200, body: JSON.stringify({ skipped: 'dedup_race', alert_id: alertId }) };
        }
        console.log(`[pb-celebration] alert ${alertId} created for ${userId} / ${exerciseName} (model: ${draftModel})`);
    } catch (err) {
        console.error('[pb-celebration] alert insert failed:', err.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert insert failed', details: err.message }) };
    }

    // 6. PBs are post-workout relationship moments Shannon should approve,
    //    even for clients who are otherwise trusted for auto-send.
    let autoSent = false;
    if (PB_CELEBRATION_AUTO_SEND_ENABLED && draftText && alertId) {
        autoSent = await maybeAutoSendDraft({
            coachId,
            clientId: userId,
            clientName,
            alertId,
            alertType: 'win_to_celebrate',
            draftText,
            siteUrl: SITE_URL,
            sendConfirmationPush: false,
            pushTitlePrefix: '🎉 Auto-hyped',
        });
    }

    if (PB_COACH_PUSH_ENABLED && !autoSent && draftText) {
        await sendCelebrationPush({
            clientId: userId,
            clientName,
            pbHeadline: headline,
            draftText,
            alertId,
            coachId,
        });
    }

    // Reasoning lands on data.draft_reasoning a beat later — Control Center
    // will then explain why this hype message fits THIS PB (which exercise,
    // by how much, what memory note influenced the tone).
    if (alertId && draftText) {
        const contextBlocks = `${clientName} just hit a PB on ${exerciseName}: ${detail}.${improvement ? `\nImprovement vs prior: ${improvement}.` : ''}`;
        fireDraftReasoning({
            alertId,
            draftText,
            alertType: 'win_to_celebrate',
            contextBlocks,
            clientName,
        });
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            alert_id: alertId,
            draft_model: draftModel,
            draft_generated: !!draftText,
            auto_sent: autoSent,
            coach_push_enabled: PB_COACH_PUSH_ENABLED,
        }),
    };
};
