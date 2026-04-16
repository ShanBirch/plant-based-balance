/**
 * Weekly Check-In Scan — Ongoing Post-Onboarding Client Touchpoints
 *
 * Once a client clears the 30-day onboarding sequence, they transition to a
 * weekly cadence: every 7 days past day 30, Shannon gets a drafted check-in
 * message to review-and-send. Keeps every client warm forever without
 * Shannon having to remember.
 *
 * Reuses the onboarding pipeline shape verbatim: scan `coach_clients` for
 * actives, compute days since `assigned_at`, fire for clients where
 * `(days_since_assigned - 30) >= 0 && (days_since_assigned - 30) % 7 == 0`
 * AND who haven't gotten a weekly_checkin in the last 6 days.
 *
 * Schedule: weekly Monday 21:23 UTC (≈ Tue 07:23 AEST).
 *
 * Dedup:
 *   - skip if any weekly_checkin fired for this client in last 6 days
 *   - skip if any other pending coach_alert exists for this client (don't
 *     pile on top of a mid-month onboarding milestone or existing DM draft)
 *
 * Cap: none for now — expected to be small (one per active client per week).
 * Revisit if roster grows past 50.
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
const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================
// Activity summary — mirrors onboarding-scheduled-scan's but 7-day window
// ============================================================

async function buildWeekSummary(clientId) {
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const lines = [];
    try {
        const [workouts, pbs, weighIns, mood] = await Promise.all([
            loadRecentWorkouts(clientId, since, 20),
            supabaseQuery(`pb_history?select=exercise_name,pb_type,new_value,improvement,achieved_at&user_id=eq.${clientId}&achieved_at=gte.${since}&order=achieved_at.desc&limit=10`).catch(() => []),
            supabaseQuery(`daily_weigh_ins?select=weight,created_at&user_id=eq.${clientId}&created_at=gte.${since}&order=created_at.asc&limit=30`).catch(() => []),
            supabaseQuery(`mood_logs?select=mood_score,energy_score,created_at&user_id=eq.${clientId}&created_at=gte.${since}&order=created_at.desc&limit=10`).catch(() => []),
        ]);

        if (workouts.length) {
            const names = [...new Set(workouts.map(w => w.templateName).filter(Boolean))].slice(0, 5);
            lines.push(`${workouts.length} workouts logged${names.length ? ` (${names.join(', ')})` : ''}`);
        } else {
            lines.push('0 workouts logged');
        }

        if (pbs.length) {
            lines.push(`${pbs.length} PB(s): ${pbs.slice(0, 3).map(p => `${p.exercise_name} ${p.new_value}${p.pb_type === 'weight' ? 'kg' : ''}`).join(', ')}`);
        }

        if (weighIns.length >= 2) {
            const first = weighIns[0].weight;
            const last = weighIns[weighIns.length - 1].weight;
            const diff = Math.round((last - first) * 10) / 10;
            if (Math.abs(diff) > 0) {
                lines.push(`Weight: ${first}kg → ${last}kg (${diff > 0 ? '+' : ''}${diff}kg)`);
            }
        }

        if (mood.length) {
            const avgMood = Math.round((mood.reduce((s, m) => s + (m.mood_score || 0), 0) / mood.length) * 10) / 10;
            lines.push(`Mood avg ${avgMood}/10 (${mood.length} logs)`);
        }
    } catch (e) { /* non-critical */ }
    return lines.join('\n');
}

// ============================================================
// Draft
// ============================================================

async function generateWeeklyCheckinDraft({ clientName, memoryBlock, activitySummary, weeksInWithCoach }) {
    const editExamples = await loadEditExamples({ lookback: 15, max: 4 });

    const prompt = `Draft a SHORT weekly check-in from Shannon to a coaching client. This is the ongoing rhythm — week ${weeksInWithCoach} with him — not onboarding, not celebration.

CRITICAL — DO NOT GREET with "hey [name]" / "hi" / "yo". Jump straight in. Aussie casual, 2-3 sentences max.

Reference the SPECIFIC activity below — workouts actually done, PBs hit, gaps. Show you've been paying attention. End with ONE open question that invites a real reply (not "how's everything going?" — something grounded in the week).

CLIENT: ${clientName}${memoryBlock || ''}

THIS WEEK'S ACTIVITY:
${activitySummary || '(no logged activity this week)'}${editExamples}

Reply with just the message text — no quotes, no commentary, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 320, temperature: 0.85 };

    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[weekly-checkin] Vertex failed, falling back: ${err.message}`);
    }
    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        return { text: stripLeadingGreeting(reply), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error(`[weekly-checkin] Gemini fallback failed: ${err.message}`);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Per-client build
// ============================================================

async function buildAndQueue({ coachId, clientId, clientName, daysSinceAssigned }) {
    // Dedup — skip if weekly_checkin fired in last 6 days
    const sixDaysAgo = new Date(Date.now() - 6 * DAY_MS).toISOString();
    try {
        const recent = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&alert_type=eq.weekly_checkin&created_at=gte.${sixDaysAgo}&limit=1`
        );
        if (recent.length > 0) return { skipped: 'dedup' };
    } catch (e) { /* continue */ }

    // Skip if ANY other pending alert exists (don't pile on top)
    try {
        const pending = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&status=eq.pending&limit=1`
        );
        if (pending.length > 0) return { skipped: 'pending_exists' };
    } catch (e) { /* continue */ }

    const [memory, activitySummary] = await Promise.all([
        loadClientMemory(coachId, clientId),
        buildWeekSummary(clientId),
    ]);
    const memoryBlock = buildMemoryBlock(memory);
    const weeksInWithCoach = Math.floor(daysSinceAssigned / 7);

    let draftText = '';
    let draftModel = 'none';
    try {
        const draft = await generateWeeklyCheckinDraft({
            clientName, memoryBlock, activitySummary, weeksInWithCoach,
        });
        draftText = draft.text;
        draftModel = draft.model;
    } catch (err) {
        console.error(`[weekly-checkin] draft failed for ${clientId}: ${err.message}`);
    }

    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'weekly_checkin',
        priority: 'medium',
        title: `📬 ${clientName} — week ${weeksInWithCoach} check-in`,
        description: activitySummary ? truncate(activitySummary, 240) : `Week ${weeksInWithCoach} check-in.`,
        suggested_message: draftText || null,
        status: 'pending',
        data: {
            weeks_in_with_coach: weeksInWithCoach,
            days_since_assigned: daysSinceAssigned,
            draft_model: draftModel,
            activity_snapshot: activitySummary,
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
    } catch (err) {
        console.error(`[weekly-checkin] insert failed for ${clientId}: ${err.message}`);
        return { error: err.message };
    }

    if (draftText && alertId) {
        try {
            const title = `📬 ${clientName} — week ${weeksInWithCoach}`;
            const body = `${truncate(activitySummary || `week ${weeksInWithCoach} check-in`, 80)}\n→ ${truncate(draftText, 140)}`;
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
            }).catch(e => console.warn(`[weekly-checkin] push dispatch failed: ${e.message}`));
        } catch (err) {
            console.warn('[weekly-checkin] push failed:', err.message);
        }
    }

    return { alertId };
}

// ============================================================
// Main handler
// ============================================================

exports.handler = async () => {
    const started = Date.now();
    console.log(`[weekly-checkin] starting at ${new Date().toISOString()}`);

    let assignments = [];
    try {
        assignments = await supabaseQuery(
            `coach_clients?select=coach_id,client_id,assigned_at,client:users!coach_clients_client_id_fkey(id,name,email)&status=eq.active`
        );
    } catch (err) {
        console.error(`[weekly-checkin] coach_clients query failed: ${err.message}`);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    const now = Date.now();
    const summary = {
        active_clients: assignments.length,
        eligible: 0,
        fired: 0,
        skipped_dedup: 0,
        skipped_pending: 0,
        skipped_onboarding: 0,
        failed: 0,
    };

    for (const a of assignments) {
        try {
            const assignedAt = new Date(a.assigned_at).getTime();
            const daysSinceAssigned = Math.floor((now - assignedAt) / DAY_MS);

            // Must be past day 30 (onboarding sequence covers days 0-30)
            if (daysSinceAssigned < 31) {
                summary.skipped_onboarding++;
                continue;
            }

            // Weekly cadence — fire when we're 1/8/15/22 days past the 30-day
            // threshold, ± 2 days tolerance (in case a run is missed).
            const daysPast30 = daysSinceAssigned - 30;
            const cadenceDay = daysPast30 % 7;
            if (!(cadenceDay === 1 || cadenceDay === 0)) {
                // Not this week's fire day. Still eligible if past 30 — but
                // just don't fire today.
                continue;
            }

            summary.eligible++;

            const clientName = a.client?.name || a.client?.email?.split('@')[0] || 'Client';
            const result = await buildAndQueue({
                coachId: a.coach_id,
                clientId: a.client_id,
                clientName,
                daysSinceAssigned,
            });
            if (result.skipped === 'dedup') summary.skipped_dedup++;
            else if (result.skipped === 'pending_exists') summary.skipped_pending++;
            else if (result.alertId) summary.fired++;
            else summary.failed++;
        } catch (err) {
            console.error(`[weekly-checkin] error for ${a.client_id}: ${err.message}`);
            summary.failed++;
        }
    }

    const elapsed = Date.now() - started;
    console.log(`[weekly-checkin] done in ${elapsed}ms — ${JSON.stringify(summary)}`);
    return {
        statusCode: 200,
        body: JSON.stringify({ ...summary, elapsed_ms: elapsed, started_at: new Date(started).toISOString() }),
    };
};
