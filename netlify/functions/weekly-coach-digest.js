/**
 * Weekly Coach Digest — Sunday Evening Scheduled Function
 *
 * Once per week, generate a per-client planning report for Shannon covering
 * the last 7 days. Each active client gets one `weekly_digest` coach_alert
 * containing a structured summary and an AI-suggested focus for the
 * upcoming week. Shannon reviews them Sunday evening when planning, not as
 * individual pushes — one summary push at the end of the run says
 * "N digests ready", linking to the admin Alerts feed.
 *
 * This is COACH-FACING. The alert's `suggested_message` is not meant to
 * be sent to the client — it's planning ammo: bullet-point observations
 * + a "focus for next week" recommendation. Shannon can still send it as
 * a DM if he wants, but usually he'll skim and dismiss.
 *
 * Schedule: weekly Sunday 20:37 UTC ≈ Monday 06:37 AEST / 07:37 AEDT. That
 * lands Monday morning for Shannon, one day after the Sunday-evening
 * planning window. Wired in netlify.toml.
 *
 * Dedup: skips a client if a weekly_digest has fired in the last 5 days.
 * Cap: no cap — one per client. (With ~20 active clients this is 20 alerts
 * on the admin dashboard once a week; fine. If roster grows past 100 we'll
 * paginate or batch multiple clients into one alert.)
 */

const {
    supabaseQuery,
    loadClientMemory,
    buildMemoryBlock,
    loadEditExamples,
    loadRecentWorkouts,
    callVertexAIModel,
    callGeminiFallback,
    truncate,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================
// Per-client weekly snapshot
// ============================================================

async function buildClientSnapshot(clientId) {
    const since7d = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const since14d = new Date(Date.now() - 14 * DAY_MS).toISOString();

    const [
        workouts7d, workoutsPrev7d,
        pbs7d,
        weighIns14d,
        mood7d,
        dmsFromClient7d,
    ] = await Promise.all([
        loadRecentWorkouts(clientId, since7d, 30),
        (async () => {
            const all = await loadRecentWorkouts(clientId, since14d, 60);
            return all.filter(w => (w.completedAt || '') < since7d);
        })(),
        supabaseQuery(`pb_history?select=exercise_name,pb_type,new_value,improvement,achieved_at&user_id=eq.${clientId}&achieved_at=gte.${since7d}&order=achieved_at.desc&limit=20`).catch(() => []),
        supabaseQuery(`daily_weigh_ins?select=weight,created_at&user_id=eq.${clientId}&created_at=gte.${since14d}&order=created_at.asc&limit=30`).catch(() => []),
        supabaseQuery(`mood_logs?select=mood_score,energy_score,stress_score,created_at&user_id=eq.${clientId}&created_at=gte.${since7d}&order=created_at.desc&limit=30`).catch(() => []),
        supabaseQuery(`nudges?select=id,created_at&sender_id=eq.${clientId}&created_at=gte.${since7d}&limit=50`).catch(() => []),
    ]);

    // Weight delta (earliest weighin in 14d vs most recent)
    let weightDeltaStr = null;
    if (weighIns14d.length >= 2) {
        const first = weighIns14d[0].weight;
        const last = weighIns14d[weighIns14d.length - 1].weight;
        const diff = Math.round((last - first) * 10) / 10;
        weightDeltaStr = `${first}kg → ${last}kg (${diff > 0 ? '+' : ''}${diff}kg over ${weighIns14d.length} weigh-ins in last 14d)`;
    } else if (weighIns14d.length === 1) {
        weightDeltaStr = `latest: ${weighIns14d[0].weight}kg (single data point in last 14d)`;
    }

    // Mood averages
    let moodStr = null;
    if (mood7d.length > 0) {
        const avgMood = Math.round((mood7d.reduce((s, m) => s + (m.mood_score || 0), 0) / mood7d.length) * 10) / 10;
        const avgEnergy = Math.round((mood7d.reduce((s, m) => s + (m.energy_score || 0), 0) / mood7d.length) * 10) / 10;
        const avgStress = Math.round((mood7d.reduce((s, m) => s + (m.stress_score || 0), 0) / mood7d.length) * 10) / 10;
        moodStr = `mood ${avgMood}/10, energy ${avgEnergy}/10, stress ${avgStress}/10 (${mood7d.length} logs)`;
    }

    return {
        workoutCount: workouts7d.length,
        workoutCountPrev: workoutsPrev7d.length,
        workoutNames: [...new Set(workouts7d.map(w => w.templateName).filter(Boolean))].slice(0, 8),
        pbCount: pbs7d.length,
        pbs: pbs7d.slice(0, 5).map(p => `${p.exercise_name} ${p.new_value}${p.pb_type === 'weight' ? 'kg' : ' reps'}${p.improvement ? ` (+${p.improvement})` : ''}`),
        weightDelta: weightDeltaStr,
        moodSummary: moodStr,
        moodTrend: mood7d,
        dmCount: dmsFromClient7d.length,
    };
}

function buildSnapshotText(snapshot) {
    const lines = [];
    const deltaSign = snapshot.workoutCount - snapshot.workoutCountPrev;
    const deltaStr = deltaSign === 0 ? '(same as week prior)' : `(${deltaSign > 0 ? '+' : ''}${deltaSign} vs prior week)`;
    lines.push(`Workouts: ${snapshot.workoutCount} ${deltaStr}${snapshot.workoutNames.length ? ` — ${snapshot.workoutNames.join(', ')}` : ''}`);
    if (snapshot.pbCount > 0) {
        lines.push(`PBs: ${snapshot.pbCount} — ${snapshot.pbs.join('; ')}`);
    } else {
        lines.push('PBs: 0');
    }
    if (snapshot.weightDelta) lines.push(`Weight: ${snapshot.weightDelta}`);
    if (snapshot.moodSummary) lines.push(`Mood: ${snapshot.moodSummary}`);
    lines.push(`DMs from client: ${snapshot.dmCount}`);
    return lines.join('\n');
}

// ============================================================
// Draft the coach's planning note (not a client message)
// ============================================================

async function generateDigestNote({ clientName, memoryBlock, snapshotText }) {
    // Don't use learn-from-edits here — those are client-facing draft examples,
    // wrong register for a coach-facing planning note.
    const prompt = `You're writing Shannon's weekly planning note about a coaching client — this goes in HIS Monday prep, NOT to the client.

Voice: Shannon's internal thinking-out-loud. Terse, observational, honest. Australian casual. Bullet points.

Based on the memory + last week's data below, produce:
  1. A 2-3 bullet ASSESSMENT of the week (what stood out — positive or negative)
  2. ONE specific "FOCUS NEXT WEEK" recommendation (what to nudge, message, or tweak)
  3. Flag any ACTION for Shannon (e.g. "check in DM", "adjust program", "skip — they're cruising")

Keep the whole thing under 120 words. No fluff, no "great job" corporate language.

CLIENT: ${clientName}${memoryBlock || ''}

LAST 7 DAYS:
${snapshotText}

Return the note as plain text — no code fences, no preamble. Use markdown bullets (- …) for readability.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 400, temperature: 0.55 };

    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        return { text: (reply || '').trim(), model: 'vertex-v7' };
    } catch (err) {
        console.warn(`[weekly-digest] Vertex failed, falling back: ${err.message}`);
    }
    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        return { text: (reply || '').trim(), model: 'gemini-2.0-fallback' };
    } catch (err) {
        console.error(`[weekly-digest] Gemini fallback failed: ${err.message}`);
        return { text: '', model: 'none' };
    }
}

// ============================================================
// Per-client digest build + insert
// ============================================================

async function buildAndQueueDigest({ coachId, clientId, clientName }) {
    // Dedup — skip if a weekly_digest fired for this client in last 5 days
    try {
        const fiveDaysAgo = new Date(Date.now() - 5 * DAY_MS).toISOString();
        const existing = await supabaseQuery(
            `coach_alerts?select=id&coach_id=eq.${coachId}&client_id=eq.${clientId}&alert_type=eq.weekly_digest&created_at=gte.${fiveDaysAgo}&limit=1`
        );
        if (existing.length > 0) return { skipped: 'dedup' };
    } catch (e) { /* continue */ }

    const [snapshot, memory] = await Promise.all([
        buildClientSnapshot(clientId),
        loadClientMemory(coachId, clientId),
    ]);
    const memoryBlock = buildMemoryBlock(memory);
    const snapshotText = buildSnapshotText(snapshot);

    let noteText = '';
    let noteModel = 'none';
    try {
        const note = await generateDigestNote({ clientName, memoryBlock, snapshotText });
        noteText = note.text;
        noteModel = note.model;
    } catch (err) {
        console.error(`[weekly-digest] note gen failed for ${clientId}: ${err.message}`);
    }

    // Build a compact title showing at-a-glance engagement.
    // 🔥 = active week, ❄️ = cold week, 🎯 = big PB week
    let titleEmoji = '📰';
    if (snapshot.workoutCount >= 4) titleEmoji = '🔥';
    else if (snapshot.workoutCount === 0) titleEmoji = '❄️';
    if (snapshot.pbCount >= 2) titleEmoji = '🎯';

    const priority = (snapshot.workoutCount === 0 && snapshot.dmCount === 0) ? 'high' : 'low';

    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'weekly_digest',
        priority,
        title: `${titleEmoji} ${clientName} — weekly digest`,
        description: truncate(snapshotText, 240),
        suggested_message: noteText || null, // This is Shannon's note, not a client message
        status: 'pending',
        data: {
            week_snapshot: {
                workouts_this_week: snapshot.workoutCount,
                workouts_prev_week: snapshot.workoutCountPrev,
                pb_count: snapshot.pbCount,
                pbs: snapshot.pbs,
                weight_delta: snapshot.weightDelta,
                mood_summary: snapshot.moodSummary,
                dm_count: snapshot.dmCount,
                workout_names: snapshot.workoutNames,
            },
            note_model: noteModel,
            drafted_at: new Date().toISOString(),
            is_coach_note: true, // flag so admin UI can render differently if needed
        },
    };

    try {
        const inserted = await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: [alertRow],
            prefer: 'return=representation',
        });
        const alertId = inserted?.[0]?.id || null;
        return { alertId, priority, titleEmoji };
    } catch (err) {
        console.error(`[weekly-digest] alert insert failed for ${clientId}: ${err.message}`);
        return { error: err.message };
    }
}

// ============================================================
// End-of-run summary push (one push total, not per client)
// ============================================================

async function sendSummaryPush({ coachId, summary }) {
    if (summary.fired === 0) return;
    try {
        const title = `📰 Weekly digests ready`;
        const body = `${summary.fired} client digest${summary.fired === 1 ? '' : 's'} — check the Alerts feed.`
            + (summary.cold_clients > 0 ? ` ${summary.cold_clients} cold this week.` : '')
            + (summary.hot_clients > 0 ? ` ${summary.hot_clients} had 🎯 PB weeks.` : '');
        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: coachId,
                senderId: coachId, // self; this is a coach-only push
                senderName: title,
                messageText: body,
                // Plain notification type — not a coach_draft_ready, because there's
                // no specific alertId/draft to inline-reply to. Just a shade ping.
                type: 'weekly_digest_ready',
            }),
        }).catch(e => console.warn(`[weekly-digest] summary push failed: ${e.message}`));
    } catch (err) {
        console.warn('[weekly-digest] summary push error:', err.message);
    }
}

// ============================================================
// Main handler
// ============================================================

exports.handler = async () => {
    const started = Date.now();
    console.log(`[weekly-digest] starting at ${new Date().toISOString()}`);

    // 1. Pull all active coach_clients
    let assignments = [];
    try {
        assignments = await supabaseQuery(
            `coach_clients?select=coach_id,client_id,client:users!coach_clients_client_id_fkey(id,name,email,is_test_account)&status=eq.active`
        );
    } catch (err) {
        console.error(`[weekly-digest] coach_clients query failed: ${err.message}`);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    const beforeFilter = assignments.length;
    assignments = assignments.filter(a => !a.client?.is_test_account);
    if (assignments.length !== beforeFilter) {
        console.log(`[weekly-digest] filtered ${beforeFilter - assignments.length} test account(s)`);
    }

    // 2. Group by coach so we can send one summary push per coach at the end
    const byCoach = new Map();
    for (const a of assignments) {
        if (!byCoach.has(a.coach_id)) byCoach.set(a.coach_id, []);
        byCoach.get(a.coach_id).push(a);
    }

    const overall = {
        active_clients: assignments.length,
        coaches: byCoach.size,
        fired: 0,
        skipped_dedup: 0,
        failed: 0,
    };

    for (const [coachId, coachAssignments] of byCoach) {
        const perCoach = { fired: 0, cold_clients: 0, hot_clients: 0 };

        for (const a of coachAssignments) {
            try {
                const clientName = a.client?.name || a.client?.email?.split('@')[0] || 'Client';
                const result = await buildAndQueueDigest({
                    coachId,
                    clientId: a.client_id,
                    clientName,
                });
                if (result.skipped) {
                    overall.skipped_dedup++;
                } else if (result.alertId) {
                    overall.fired++;
                    perCoach.fired++;
                    if (result.titleEmoji === '🎯') perCoach.hot_clients++;
                    if (result.titleEmoji === '❄️') perCoach.cold_clients++;
                } else {
                    overall.failed++;
                }
            } catch (err) {
                console.error(`[weekly-digest] error for ${a.client_id}: ${err.message}`);
                overall.failed++;
            }
        }

        await sendSummaryPush({ coachId, summary: perCoach });
    }

    const elapsed = Date.now() - started;
    console.log(`[weekly-digest] done in ${elapsed}ms — ${JSON.stringify(overall)}`);
    return {
        statusCode: 200,
        body: JSON.stringify({ ...overall, elapsed_ms: elapsed, started_at: new Date(started).toISOString() }),
    };
};
