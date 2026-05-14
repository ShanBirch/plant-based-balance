/**
 * Plateau Detection — Weekly Scheduled Scan
 *
 * Finds clients who've stalled — not lost interest, but stalled. The weekly
 * check-in + morning pulse catch engagement issues. This catches the
 * "grinding but not progressing" case, which is a different conversation:
 * time to reassess the program, not nudge compliance.
 *
 * Detection (any one signal = plateau, first match wins):
 *
 *   SIGNAL A — WEIGHT PLATEAU (goal-relevant)
 *     - Client has a goal_weight ≠ current weight (from user_facts)
 *     - ≥3 weigh-ins in last 14 days
 *     - Range of (max - min) across those weigh-ins ≤ 0.5kg
 *     - Net movement toward goal ≤ 0.3kg
 *     - 0 PBs in last 14 days
 *
 *   SIGNAL B — STRENGTH PLATEAU (grinding, no PB)
 *     - ≥8 workouts in last 21 days (consistent effort)
 *     - 0 PBs in last 21 days
 *
 *   SIGNAL C — WEIGHT + STRENGTH DOUBLE PLATEAU
 *     - Both A and B match — escalate priority to high
 *
 * Only fires for clients past day 30 (onboarding sequence covers the early
 * stall phase). Dedup: skip if plateau_reassess fired for this client in
 * last 14 days (don't nag twice in a fortnight).
 *
 * Schedule: Wednesday 22:47 UTC (≈ Thu 08:47 AEST). Mid-week, clear of
 * Sunday digest and Tuesday weekly check-in.
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
    fireDraftReasoning,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    recentlyMessaged,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================
// Signal detection per client
// ============================================================

async function detectPlateau({ clientId, personalDetails }) {
    const since14d = new Date(Date.now() - 14 * DAY_MS).toISOString();
    const since21d = new Date(Date.now() - 21 * DAY_MS).toISOString();

    const [weighIns14d, pbs21d, workouts21d] = await Promise.all([
        supabaseQuery(`daily_weigh_ins?select=weight,created_at&user_id=eq.${clientId}&created_at=gte.${since14d}&order=created_at.asc&limit=30`).catch(() => []),
        supabaseQuery(`pb_history?select=id,achieved_at&user_id=eq.${clientId}&achieved_at=gte.${since21d}&limit=5`).catch(() => []),
        loadRecentWorkouts(clientId, since21d, 30),
    ]);

    const pbsLast14d = pbs21d.filter(p => (p.achieved_at || '') >= since14d);
    const pbsLast21d = pbs21d;
    const workoutsLast21d = workouts21d.length;

    // Signal A — weight plateau
    let signalA = null;
    try {
        const goalWeight = personalDetails?.goal_weight;
        if (weighIns14d.length >= 3 && goalWeight != null) {
            const weights = weighIns14d.map(w => Number(w.weight)).filter(n => !isNaN(n));
            if (weights.length >= 3) {
                const min = Math.min(...weights);
                const max = Math.max(...weights);
                const range = Math.round((max - min) * 10) / 10;
                const first = weights[0];
                const last = weights[weights.length - 1];
                const startDistance = Math.abs(first - goalWeight);
                const endDistance = Math.abs(last - goalWeight);
                const movedTowardGoal = startDistance - endDistance; // positive = progress
                if (range <= 0.5 && Math.abs(movedTowardGoal) <= 0.3 && pbsLast14d.length === 0) {
                    signalA = {
                        label: 'weight_plateau',
                        detail: `${weighIns14d.length} weigh-ins over 14d, range ${range}kg, net ${movedTowardGoal > 0 ? '+' : ''}${Math.round(movedTowardGoal * 10) / 10}kg toward ${goalWeight}kg goal, 0 PBs`,
                        context: `Current: ${last}kg; goal: ${goalWeight}kg; ${Math.abs(Math.round((last - goalWeight) * 10) / 10)}kg to goal.`,
                    };
                }
            }
        }
    } catch (e) { /* ignore */ }

    // Signal B — strength plateau
    let signalB = null;
    if (workoutsLast21d >= 8 && pbsLast21d.length === 0) {
        signalB = {
            label: 'strength_plateau',
            detail: `${workoutsLast21d} workouts in last 21d, 0 PBs`,
            context: `Consistent effort but no measurable strength progress. Likely stale program or undertraining on the lifts that should be progressing.`,
        };
    }

    if (!signalA && !signalB) return null;

    // Both = escalate to high
    const both = signalA && signalB;
    return {
        priority: both ? 'high' : 'medium',
        type: both ? 'double_plateau' : (signalA ? 'weight_plateau' : 'strength_plateau'),
        reason: [signalA?.detail, signalB?.detail].filter(Boolean).join(' + '),
        context: [signalA?.context, signalB?.context].filter(Boolean).join(' '),
    };
}

// ============================================================
// Dedup
// ============================================================

async function shouldSkip(coachId, clientId) {
    // Skip if plateau_reassess fired in last 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * DAY_MS).toISOString();
    try {
        const recent = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&alert_type=eq.plateau_reassess&created_at=gte.${fourteenDaysAgo}&limit=1`
        );
        if (recent.length > 0) return 'dedup';
    } catch (e) { /* continue */ }

    // Skip if any OTHER pending alert exists (plateau reassess is a big
    // message — don't pile on top of a weekly check-in or DM draft)
    try {
        const pending = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&status=eq.pending&limit=1`
        );
        if (pending.length > 0) return 'pending_exists';
    } catch (e) { /* continue */ }

    // Skip if coach already messaged in the last 24h — plateau reassess is a
    // proactive "let's reconsider" message; if they just talked, let the
    // conversation breathe before piling on.
    if (await recentlyMessaged({ coachId, clientId, hours: 24 })) {
        return 'recently_messaged';
    }

    return null;
}

// ============================================================
// Draft
// ============================================================

async function generatePlateauDraft({ clientName, profileBlock, memoryBlock, signal }) {
    const editExamples = await loadEditExamples({ lookback: 15, max: 4 });
    const nameUsePolicy = buildNameUsePolicyBlock();
    const relationshipDiscovery = buildRelationshipDiscoveryBlock();
    const heardFirstConversation = buildHeardFirstConversationBlock();

    const typeBrief = {
        weight_plateau:  `Weight is stuck. The scale hasn't moved meaningfully toward their goal in 2 weeks. This is a reassess moment — maybe calories need adjusting, maybe they need a diet break, maybe training volume. Don't diagnose yet; open the conversation.`,
        strength_plateau: `They're training hard but not getting stronger — 0 PBs in 3 weeks despite consistent sessions. Program probably needs a change (progressive overload drift, accessory swap, deload). Honest, not alarming.`,
        double_plateau: `Both scale AND strength are stuck. Consistency is there, but the system isn't producing results. This is a real reassess moment — worth a serious conversation about program + nutrition.`,
    }[signal.type] || 'General plateau — worth a reassessment.';

    const prompt = `Draft a SHORT "let's reassess" message from Shannon to a client who's plateaued. This is NOT a nudge about effort — their effort is fine. This is about the PROGRAM not producing results.

CRITICAL — DO NOT GREET with "hey [name]" / "hi" / "yo". Jump straight in. Aussie casual, honest, 2-3 sentences max.

Tone target: honest observation + invitation to reassess, NOT blame. They've been grinding. The system isn't rewarding them. That's on the program, not them. Suggest having a convo about adjustments without prescribing the fix yet — the fix is Shannon's call after the reply.

Avoid: "don't worry", "just keep pushing", generic motivation. Avoid prescribing a specific fix (diet, deload, etc.) — the purpose of this message is to OPEN the reassess conversation.

WHAT SHANNON IS REACHING OUT ABOUT:
${typeBrief}

THE DATA:
${signal.reason}
${signal.context}

${nameUsePolicy}
${relationshipDiscovery}
${heardFirstConversation}

CLIENT: ${clientName}${profileBlock || ''}${memoryBlock || ''}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 1024, temperature: 0.75 };

    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[plateau] Vertex failed, falling back: ${err.message}`);
    }
    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error(`[plateau] Gemini fallback failed: ${err.message}`);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Per-client queue + push
// ============================================================

async function buildAndQueue({ coachId, clientId, clientName, signal }) {
    const [memory, profile] = await Promise.all([
        loadClientMemory(coachId, clientId),
        loadClientProfileFacts(clientId),
    ]);
    const memoryBlock = buildMemoryBlock(memory);
    const profileBlock = buildClientProfileBlock({ clientName, profile });

    let draftText = '';
    let draftModel = 'none';
    try {
        const draft = await generatePlateauDraft({ clientName, profileBlock, memoryBlock, signal });
        draftText = draft.text;
        draftModel = draft.model;
    } catch (err) {
        console.error(`[plateau] draft failed for ${clientId}: ${err.message}`);
    }

    const titleEmoji = signal.type === 'double_plateau' ? '🚧' : (signal.type === 'weight_plateau' ? '⚖️' : '💪');
    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'plateau_reassess',
        priority: signal.priority,
        title: `${titleEmoji} ${clientName} — plateau, let's reassess`,
        description: truncate(signal.reason, 240),
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            plateau_type: signal.type,
            signal_reason: signal.reason,
            signal_context: signal.context,
            draft_model: draftModel,
            drafted_at: new Date().toISOString(),
        },
    };

    let alertId = null;
    try {
        // Plateau detection runs weekly — one alert per (coach, client, week)
        // protects against scheduler retries. The 14-day pre-check above stops
        // back-to-back weekly fires; this seals the within-week race.
        const dayKey = new Date().toISOString().slice(0, 10);
        const idempotencyKey = `plateau_reassess:${coachId}:${clientId}:${dayKey}`;
        const result = await insertCoachAlert(alertRow, idempotencyKey);
        alertId = result.alertId;
        if (result.deduped) {
            console.log(`[plateau] dedup race for ${clientId} — alert ${alertId} already exists today`);
            return { alertId, deduped: true };
        }
    } catch (err) {
        console.error(`[plateau] insert failed for ${clientId}: ${err.message}`);
        return { error: err.message };
    }

    // Auto-send for trusted clients, otherwise push the approve-gate
    // notification.
    let autoSent = false;
    if (draftText && alertId) {
        autoSent = await maybeAutoSendDraft({
            coachId,
            clientId,
            clientName,
            alertId,
            alertType: 'plateau_reassess',
            draftText,
            siteUrl: SITE_URL,
            pushTitlePrefix: `${titleEmoji} Auto-sent plateau`,
        });
    }

    if (!autoSent && draftText && alertId) {
        try {
            const title = `${titleEmoji} ${clientName} — plateau`;
            const body = `${truncate(signal.reason, 80)}\n→ ${truncate(draftText, 140)}`;
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
            }).catch(e => console.warn(`[plateau] push dispatch failed: ${e.message}`));
        } catch (err) {
            console.warn('[plateau] push failed:', err.message);
        }
    }

    if (alertId && draftText) {
        const contextBlocks = `Plateau detected for ${clientName} (type: ${signal.type}).\nSignal reason: ${signal.reason}${signal.context ? `\nContext: ${typeof signal.context === 'string' ? signal.context : JSON.stringify(signal.context)}` : ''}`;
        fireDraftReasoning({
            alertId,
            draftText,
            alertType: 'plateau_reassess',
            contextBlocks,
            clientName,
        });
    }

    return { alertId, autoSent };
}

// ============================================================
// Main handler
// ============================================================

exports.handler = async () => {
    const started = Date.now();
    console.log(`[plateau] starting at ${new Date().toISOString()}`);

    let assignments = [];
    try {
        assignments = await supabaseQuery(
            `coach_clients?select=coach_id,client_id,assigned_at,client:users!coach_clients_client_id_fkey(id,name,email,is_test_account)&status=eq.active`
        );
    } catch (err) {
        console.error(`[plateau] coach_clients query failed: ${err.message}`);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    const beforeFilter = assignments.length;
    assignments = assignments.filter(a => !a.client?.is_test_account);
    if (assignments.length !== beforeFilter) {
        console.log(`[plateau] filtered ${beforeFilter - assignments.length} test account(s)`);
    }

    const clientIds = assignments.map(a => a.client_id);
    let factsByClient = {};
    if (clientIds.length > 0) {
        try {
            const inList = clientIds.map(id => `"${id}"`).join(',');
            const facts = await supabaseQuery(
                `user_facts?select=user_id,personal_details&user_id=in.(${inList})`
            );
            factsByClient = Object.fromEntries(facts.map(f => [f.user_id, f.personal_details || {}]));
        } catch (e) { /* continue without facts */ }
    }

    const now = Date.now();
    const summary = {
        active_clients: assignments.length,
        eligible_past_day_30: 0,
        plateau_detected: 0,
        fired: 0,
        skipped_dedup: 0,
        skipped_pending: 0,
        skipped_recently_messaged: 0,
        failed: 0,
        by_type: { weight_plateau: 0, strength_plateau: 0, double_plateau: 0 },
    };

    for (const a of assignments) {
        try {
            const daysSinceAssigned = Math.floor((now - new Date(a.assigned_at).getTime()) / DAY_MS);
            if (daysSinceAssigned < 31) continue;
            summary.eligible_past_day_30++;

            const signal = await detectPlateau({
                clientId: a.client_id,
                personalDetails: factsByClient[a.client_id] || {},
            });
            if (!signal) continue;
            summary.plateau_detected++;

            const skipReason = await shouldSkip(a.coach_id, a.client_id);
            if (skipReason === 'dedup') { summary.skipped_dedup++; continue; }
            if (skipReason === 'pending_exists') { summary.skipped_pending++; continue; }
            if (skipReason === 'recently_messaged') { summary.skipped_recently_messaged++; continue; }

            const clientName = a.client?.name || a.client?.email?.split('@')[0] || 'Client';
            const result = await buildAndQueue({
                coachId: a.coach_id,
                clientId: a.client_id,
                clientName,
                signal,
            });
            if (result.alertId) {
                summary.fired++;
                summary.by_type[signal.type]++;
            } else {
                summary.failed++;
            }
        } catch (err) {
            console.error(`[plateau] error for ${a.client_id}: ${err.message}`);
            summary.failed++;
        }
    }

    const elapsed = Date.now() - started;
    console.log(`[plateau] done in ${elapsed}ms — ${JSON.stringify(summary)}`);
    return {
        statusCode: 200,
        body: JSON.stringify({ ...summary, elapsed_ms: elapsed, started_at: new Date(started).toISOString() }),
    };
};
