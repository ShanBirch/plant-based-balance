/**
 * Morning Pulse — Scheduled Daily Scan
 *
 * Once per day in the clients' morning, scan every active coach_clients row
 * for "worth reaching out about" signals and generate up to MAX_PULSES_PER_DAY
 * drafted check-ins. Each draft lands as a coach_draft_ready push so Shannon
 * can tap-and-send from the lockscreen with his morning coffee.
 *
 * Signals considered (in priority order):
 *   1. HIGH    — missed scheduled workout yesterday (training_calendar vs log)
 *   2. HIGH    — streak at risk (5+ day streak broken yesterday)
 *   3. MEDIUM  — low mood trend (avg mood_score < 5 over last 3 days)
 *   4. MEDIUM  — quiet client (no DM 5+ days AND no workout 3+ days)
 *   5. LOW     — cycle check-in (within 24h of period start, if cycle_sync=yes)
 *   6. LOW     — momentum reinforcement (2+ PBs or 5+ workouts in last 7 days)
 *
 * Caps at 10 pulses per day to avoid lockscreen fatigue. Dedups against:
 *   - any pending coach_alert for the same client (don't pile on)
 *   - any morning_pulse fired for the same client in the last 20 hours
 *
 * Schedule: daily at 19:17 UTC ≈ 5:17 AEST (April AEST; ~6:17 AEDT during DST).
 * Wired in netlify.toml.
 */

const {
    supabaseQuery,
    loadClientMemory,
    buildMemoryBlock,
    loadEditExamples,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

const MAX_PULSES_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================
// Signal detection
// ============================================================

const DAY_NAMES = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function yesterdayDayName() {
    const d = new Date(Date.now() - DAY_MS);
    return DAY_NAMES[d.getDay()];
}

/**
 * Compute the signal (if any) that should trigger a morning pulse for this
 * client, and return { priority, reason, context } — or null if nothing.
 * priority: 'high' | 'medium' | 'low'.
 */
async function detectSignals({ clientId, personalDetails }) {
    const since7d  = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const since3d  = new Date(Date.now() - 3 * DAY_MS).toISOString();
    const since24h = new Date(Date.now() - DAY_MS).toISOString();
    const since5d  = new Date(Date.now() - 5 * DAY_MS).toISOString();

    // Pull everything in parallel
    const [workouts7d, moodLogs3d, lastDmFromClient, pbs7d] = await Promise.all([
        loadRecentWorkouts(clientId, since7d, 30),
        supabaseQuery(`mood_logs?select=mood_score,created_at&user_id=eq.${clientId}&created_at=gte.${since3d}&order=created_at.desc&limit=15`).catch(() => []),
        supabaseQuery(`nudges?select=created_at&sender_id=eq.${clientId}&order=created_at.desc&limit=1`).catch(() => []),
        supabaseQuery(`pb_history?select=id&user_id=eq.${clientId}&achieved_at=gte.${since7d}&limit=10`).catch(() => []),
    ]);

    // Normalise — loadRecentWorkouts returns { templateName, completedAt, ... }
    // with one entry per (template, date) so the set is already day-unique.
    const workoutDaysSet = new Set(
        workouts7d.map(w => (w.completedAt || '').slice(0, 10))
    );
    const yest = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
    const workedOutYesterday = workoutDaysSet.has(yest);

    // Signal 1 — missed scheduled workout yesterday
    try {
        const calRaw = personalDetails?.workout_calendar;
        if (calRaw) {
            const cal = typeof calRaw === 'string' ? JSON.parse(calRaw) : calRaw;
            const scheduled = cal[yesterdayDayName()];
            // Treat "rest", "off", "yoga-rest*" etc. as not-a-workout — anything
            // starting with "yoga-rest" or named "rest"/"off"
            const isRestDay = !scheduled || /^(rest|off)$/i.test(scheduled) || /^yoga-rest/i.test(scheduled);
            if (!isRestDay && !workedOutYesterday) {
                return {
                    priority: 'high',
                    reason: `Skipped yesterday's scheduled ${scheduled} workout.`,
                    context: `Scheduled ${scheduled}, nothing logged for ${yest}.`,
                };
            }
        }
    } catch (e) { /* fall through */ }

    // Signal 2 — streak break (had 5+ consecutive days of workouts, then missed yesterday)
    if (!workedOutYesterday && workouts7d.length >= 5) {
        // Compute streak ending before yesterday
        let streak = 0;
        for (let i = 2; i <= 10; i++) { // check 2 days ago back through 10 days ago
            const d = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
            if (workoutDaysSet.has(d)) streak++;
            else break;
        }
        if (streak >= 5) {
            return {
                priority: 'high',
                reason: `Had a ${streak}-day workout streak going — skipped yesterday.`,
                context: `${streak} consecutive days of workouts, broken ${yest}.`,
            };
        }
    }

    // Signal 3 — low mood trend (avg < 5 over last 3 days, need at least 2 logs)
    if (moodLogs3d.length >= 2) {
        const avg = moodLogs3d.reduce((s, m) => s + (m.mood_score || 0), 0) / moodLogs3d.length;
        if (avg > 0 && avg < 5) {
            return {
                priority: 'medium',
                reason: `Mood has been low (avg ${Math.round(avg * 10) / 10}/10 over last 3 days).`,
                context: `${moodLogs3d.length} mood logs in last 3d, average ${Math.round(avg * 10) / 10}/10.`,
            };
        }
    }

    // Signal 4 — quiet client (no DM from them 5+ days AND no workout 3+ days)
    const lastDmAt = lastDmFromClient[0]?.created_at;
    const noDm5d = !lastDmAt || new Date(lastDmAt) < new Date(since5d);
    const hasWorkoutLast3d = workouts7d.some(w => (w.completedAt || '') >= since3d);
    if (noDm5d && !hasWorkoutLast3d) {
        const daysSinceDm = lastDmAt
            ? Math.floor((Date.now() - new Date(lastDmAt).getTime()) / DAY_MS)
            : null;
        return {
            priority: 'medium',
            reason: `Quiet — ${daysSinceDm !== null ? `${daysSinceDm} days since last message, ` : ''}no workout logged in 3+ days.`,
            context: `Last DM: ${daysSinceDm !== null ? daysSinceDm + ' days ago' : 'never'}. Workouts last 3d: 0.`,
        };
    }

    // Signal 5 — cycle check-in (period starting within 24h, cycle sync enabled)
    try {
        if (personalDetails?.cycle_sync_preference === 'yes' && personalDetails?.last_period_start) {
            const cycleLen = personalDetails.cycle_length || 28;
            const lastStart = new Date(personalDetails.last_period_start);
            // Find the next predicted period date
            let next = new Date(lastStart);
            while (next.getTime() < Date.now() - DAY_MS) {
                next = new Date(next.getTime() + cycleLen * DAY_MS);
            }
            const hoursUntil = (next.getTime() - Date.now()) / (60 * 60 * 1000);
            if (hoursUntil >= -24 && hoursUntil <= 24) {
                return {
                    priority: 'low',
                    reason: `Period is due around now (cycle-sync enabled${personalDetails.period_energy_response === 'low' ? ', she tends to have low energy' : ''}).`,
                    context: `Predicted period start within 24h. Cycle length ${cycleLen}d.`,
                };
            }
        }
    } catch (e) { /* ignore cycle parse errors */ }

    // Signal 6 — momentum reinforcement (2+ PBs OR 5+ workouts last 7 days)
    if (pbs7d.length >= 2) {
        return {
            priority: 'low',
            reason: `Momentum — ${pbs7d.length} PBs in the last 7 days.`,
            context: `${pbs7d.length} PBs logged in last 7d, ${workouts7d.length} workouts.`,
        };
    }
    if (workouts7d.length >= 5) {
        return {
            priority: 'low',
            reason: `Consistency — ${workouts7d.length} workouts this week.`,
            context: `${workouts7d.length} workouts logged in last 7d.`,
        };
    }

    return null;
}

// ============================================================
// Dedup
// ============================================================

async function shouldSkipDueToDedup(coachId, clientId) {
    // Skip if client has ANY pending coach_alert (don't pile morning push on top of an existing one)
    try {
        const pending = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&status=eq.pending&limit=1`
        );
        if (pending.length > 0) return 'pending_alert_exists';
    } catch (e) { /* continue */ }

    // Skip if a morning_pulse already fired for this client in the last 20h
    try {
        const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
        const recent = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&alert_type=eq.morning_pulse&created_at=gte.${twentyHoursAgo}&limit=1`
        );
        if (recent.length > 0) return 'pulse_today';
    } catch (e) { /* continue */ }

    return null;
}

// ============================================================
// Draft + alert + push for one candidate
// ============================================================

async function draftAndQueue({ coachId, clientId, clientName, signal }) {
    const [memory, editExamples] = await Promise.all([
        loadClientMemory(coachId, clientId),
        loadEditExamples({ lookback: 15, max: 4 }),
    ]);
    const memoryBlock = buildMemoryBlock(memory);

    const prompt = `Draft a SHORT morning check-in from Shannon to a client. This is a proactive good-morning ping — not a reply.

CRITICAL — DO NOT GREET with "hey [name]", "morning [name]", "hi". Jump straight into content with warm morning energy. Aussie casual, 1-2 sentences max, lowercase-friendly, no corporate fluff.

Reference the SPECIFIC signal below so the message feels tailored to today — not a generic "morning, hope you're well". If relevant, suggest one small action or invite a reply.

CLIENT: ${clientName}${memoryBlock || ''}

WHY SHANNON IS REACHING OUT THIS MORNING:
${signal.reason}

SUPPORTING CONTEXT:
${signal.context}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 256, temperature: 0.85 };

    let draftText = '';
    let draftModel = 'none';
    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        draftText = stripLeadingGreeting(reply);
        draftModel = 'vertex-v7';
    } catch (err) {
        console.warn(`[morning-pulse] Vertex failed for ${clientId}: ${err.message}`);
        try {
            const reply = await callGeminiFallback(contents, generationConfig);
            draftText = stripLeadingGreeting(reply);
            draftModel = 'gemini-2.0-fallback';
        } catch (err2) {
            console.error(`[morning-pulse] Gemini fallback failed for ${clientId}: ${err2.message}`);
        }
    }

    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'morning_pulse',
        priority: signal.priority,
        title: `🌅 ${clientName} — morning pulse`,
        description: truncate(signal.reason, 240),
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            signal_reason: signal.reason,
            signal_context: signal.context,
            signal_priority: signal.priority,
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
        console.log(`[morning-pulse] alert ${alertId} created for ${clientId} (${signal.priority})`);
    } catch (err) {
        console.error(`[morning-pulse] alert insert failed for ${clientId}: ${err.message}`);
        return null;
    }

    if (draftText && alertId) {
        try {
            const title = `🌅 ${clientName} — morning pulse`;
            const body = `${truncate(signal.reason, 80)}\n→ ${truncate(draftText, 140)}`;
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
                    draftText,
                    isSimpleReply: false,
                }),
            }).catch(e => console.warn(`[morning-pulse] push dispatch failed: ${e.message}`));
        } catch (err) {
            console.warn(`[morning-pulse] push failed: ${err.message}`);
        }
    }

    return alertId;
}

// ============================================================
// Main handler
// ============================================================

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

exports.handler = async () => {
    const started = Date.now();
    console.log(`[morning-pulse] starting at ${new Date().toISOString()}`);

    // 1. Pull all active coach_clients with their client info + onboarding details
    let assignments = [];
    try {
        assignments = await supabaseQuery(
            `coach_clients?select=coach_id,client_id,client:users!coach_clients_client_id_fkey(id,name,email)&status=eq.active`
        );
    } catch (err) {
        console.error(`[morning-pulse] coach_clients query failed: ${err.message}`);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    // Bulk-load user_facts.personal_details for all candidates in one query
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

    // 2. For each assignment, compute signal (if any)
    const candidates = [];
    for (const a of assignments) {
        try {
            const signal = await detectSignals({
                clientId: a.client_id,
                personalDetails: factsByClient[a.client_id] || {},
            });
            if (signal) {
                candidates.push({
                    coachId: a.coach_id,
                    clientId: a.client_id,
                    clientName: a.client?.name || a.client?.email?.split('@')[0] || 'Client',
                    signal,
                });
            }
        } catch (err) {
            console.warn(`[morning-pulse] signal detection failed for ${a.client_id}: ${err.message}`);
        }
    }

    console.log(`[morning-pulse] ${assignments.length} active clients, ${candidates.length} signals detected`);

    // 3. Sort by priority desc (high → low) and cap
    candidates.sort((a, b) => PRIORITY_WEIGHT[b.signal.priority] - PRIORITY_WEIGHT[a.signal.priority]);
    const selected = candidates.slice(0, MAX_PULSES_PER_DAY);

    // 4. Dedup + draft + queue
    const summary = {
        active_clients: assignments.length,
        signals_detected: candidates.length,
        cap: MAX_PULSES_PER_DAY,
        fired: 0,
        skipped_dedup: 0,
        failed: 0,
        by_priority: { high: 0, medium: 0, low: 0 },
    };

    for (const c of selected) {
        try {
            const skipReason = await shouldSkipDueToDedup(c.coachId, c.clientId);
            if (skipReason) {
                summary.skipped_dedup++;
                continue;
            }
            const alertId = await draftAndQueue(c);
            if (alertId) {
                summary.fired++;
                summary.by_priority[c.signal.priority]++;
            } else {
                summary.failed++;
            }
        } catch (err) {
            console.error(`[morning-pulse] error processing ${c.clientId}: ${err.message}`);
            summary.failed++;
        }
    }

    const elapsed = Date.now() - started;
    console.log(`[morning-pulse] done in ${elapsed}ms — ${JSON.stringify(summary)}`);
    return {
        statusCode: 200,
        body: JSON.stringify({ ...summary, elapsed_ms: elapsed, started_at: new Date(started).toISOString() }),
    };
};
