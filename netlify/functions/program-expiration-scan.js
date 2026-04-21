/**
 * Program Expiration Scan — Daily Scheduled Function
 *
 * Finds clients whose active custom workout program is about to run out, so
 * the coach gets a heads-up to plan the next block before it lapses.
 *
 * Detection:
 *   - custom_workout_programs WHERE is_active = TRUE AND start_date IS NOT NULL
 *   - end_date = start_date + duration_weeks * 7 days
 *   - Fire when days_remaining is between -1 and 7 inclusive (captures the
 *     final week + the day it actually runs out).
 *
 * Per program, dedup on (client_id, program_id) in coach_alerts.data: skip
 * if a program_expiring alert has fired for this specific program in the
 * last 14 days. That way the coach gets one push per program, not one per
 * day of the final week.
 *
 * Schedule: daily 20:05 UTC (≈ Tue 06:05 AEST / 07:05 AEDT). Lands in the
 * morning — coach sees it with coffee, not at midnight.
 */

const { supabaseQuery, truncate } = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_WINDOW_DAYS = 7;   // fire this many days before end_date
const GRACE_DAYS = 1;         // also fire on the day after it runs out
const DEDUP_DAYS = 14;        // don't re-fire for the same program within 14d

function computeEndDate(startDate, durationWeeks) {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(start.getTime() + durationWeeks * 7 * DAY_MS);
    return end;
}

function daysBetween(fromMs, toMs) {
    return Math.floor((toMs - fromMs) / DAY_MS);
}

function formatDate(d) {
    return d.toISOString().slice(0, 10);
}

function buildAlertCopy({ clientName, programName, durationWeeks, daysRemaining, endDate }) {
    let headline;
    let description;
    if (daysRemaining < 0) {
        headline = `⏰ ${clientName} — program finished`;
        description = `${programName} (${durationWeeks}wk) ran out ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago. Plan the next block.`;
    } else if (daysRemaining === 0) {
        headline = `⏰ ${clientName} — program ends today`;
        description = `${programName} (${durationWeeks}wk) finishes today (${formatDate(endDate)}). Queue up what's next.`;
    } else if (daysRemaining === 1) {
        headline = `⏳ ${clientName} — program ends tomorrow`;
        description = `${programName} (${durationWeeks}wk) finishes tomorrow (${formatDate(endDate)}). Queue up what's next.`;
    } else {
        headline = `⏳ ${clientName} — program ending in ${daysRemaining} days`;
        description = `${programName} (${durationWeeks}wk) ends ${formatDate(endDate)}. Start planning the next block.`;
    }
    return { headline, description };
}

function pickPriority(daysRemaining) {
    if (daysRemaining <= 1) return 'high';
    if (daysRemaining <= 3) return 'medium';
    return 'low';
}

async function alreadyFiredForProgram({ coachId, clientId, programId }) {
    const since = new Date(Date.now() - DEDUP_DAYS * DAY_MS).toISOString();
    try {
        const rows = await supabaseQuery(
            `coach_alerts?select=id,data&coach_id=eq.${coachId}&client_id=eq.${clientId}&alert_type=eq.program_expiring&created_at=gte.${since}&limit=20`
        );
        return rows.some(r => (r?.data?.program_id || null) === programId);
    } catch (e) {
        console.warn(`[program-expiration] dedup lookup failed: ${e.message}`);
        return false;
    }
}

async function insertAlert({ coachId, clientId, clientName, program, daysRemaining, endDate }) {
    const { headline, description } = buildAlertCopy({
        clientName,
        programName: program.program_name,
        durationWeeks: program.duration_weeks,
        daysRemaining,
        endDate,
    });

    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'program_expiring',
        priority: pickPriority(daysRemaining),
        title: headline,
        description: truncate(description, 240),
        suggested_message: null, // coach-facing planning nudge, not a client DM
        status: 'pending',
        data: {
            program_id: program.id,
            program_name: program.program_name,
            duration_weeks: program.duration_weeks,
            start_date: program.start_date,
            end_date: formatDate(endDate),
            days_remaining: daysRemaining,
            is_coach_note: true,
            detected_at: new Date().toISOString(),
        },
    };

    try {
        const inserted = await supabaseQuery('coach_alerts', {
            method: 'POST',
            body: [alertRow],
            prefer: 'return=representation',
        });
        return inserted?.[0]?.id || null;
    } catch (err) {
        console.error(`[program-expiration] alert insert failed for ${clientId}: ${err.message}`);
        return null;
    }
}

async function sendPush({ coachId, clientId, clientName, alertId, headline, description }) {
    try {
        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: coachId,
                senderId: clientId,
                senderName: headline,
                messageText: description,
                type: 'program_expiring',
                alertId,
                clientId,
                clientName,
                // Collapse repeated notifications about the same client's program
                // into one banner instead of stacking day after day.
                collapseKey: `program_expiring:${clientId}`,
            }),
        });
    } catch (err) {
        console.warn(`[program-expiration] push dispatch failed: ${err.message}`);
    }
}

exports.handler = async () => {
    const started = Date.now();
    console.log(`[program-expiration] starting at ${new Date().toISOString()}`);

    // 1. Pull active programs that have actually started.
    let programs = [];
    try {
        programs = await supabaseQuery(
            `custom_workout_programs?select=id,user_id,program_name,duration_weeks,start_date,is_active&is_active=eq.true&start_date=not.is.null`
        );
    } catch (err) {
        console.error(`[program-expiration] programs query failed: ${err.message}`);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    const summary = {
        active_programs: programs.length,
        candidates: 0,
        fired: 0,
        skipped_dedup: 0,
        skipped_no_coach: 0,
        skipped_out_of_window: 0,
        failed: 0,
    };

    if (programs.length === 0) {
        console.log('[program-expiration] no active programs, nothing to do');
        return {
            statusCode: 200,
            body: JSON.stringify({ ...summary, elapsed_ms: Date.now() - started }),
        };
    }

    // 2. Load coach assignments for the clients in scope.
    const clientIds = [...new Set(programs.map(p => p.user_id))];
    const inList = clientIds.map(id => `"${id}"`).join(',');

    let assignments = [];
    try {
        assignments = await supabaseQuery(
            `coach_clients?select=coach_id,client_id,client:users!coach_clients_client_id_fkey(id,name,email,is_test_account)&status=eq.active&client_id=in.(${inList})`
        );
    } catch (err) {
        console.error(`[program-expiration] coach_clients query failed: ${err.message}`);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }

    // Filter test accounts + build clientId -> [{coachId, client}] index.
    // A client can (theoretically) have multiple coaches; alert each one.
    const coachesByClient = new Map();
    for (const a of assignments) {
        if (a.client?.is_test_account) continue;
        if (!coachesByClient.has(a.client_id)) coachesByClient.set(a.client_id, []);
        coachesByClient.get(a.client_id).push({ coachId: a.coach_id, client: a.client });
    }

    // 3. Evaluate each program.
    const now = Date.now();
    for (const program of programs) {
        try {
            if (!program.start_date || !program.duration_weeks) continue;

            const endDate = computeEndDate(program.start_date, program.duration_weeks);
            const daysRemaining = daysBetween(now, endDate.getTime());

            if (daysRemaining > WARN_WINDOW_DAYS || daysRemaining < -GRACE_DAYS) {
                summary.skipped_out_of_window++;
                continue;
            }
            summary.candidates++;

            const coaches = coachesByClient.get(program.user_id) || [];
            if (coaches.length === 0) {
                summary.skipped_no_coach++;
                continue;
            }

            for (const { coachId, client } of coaches) {
                const clientName = client?.name || client?.email?.split('@')[0] || 'Client';

                if (await alreadyFiredForProgram({ coachId, clientId: program.user_id, programId: program.id })) {
                    summary.skipped_dedup++;
                    continue;
                }

                const alertId = await insertAlert({
                    coachId,
                    clientId: program.user_id,
                    clientName,
                    program,
                    daysRemaining,
                    endDate,
                });

                if (!alertId) {
                    summary.failed++;
                    continue;
                }

                const { headline, description } = buildAlertCopy({
                    clientName,
                    programName: program.program_name,
                    durationWeeks: program.duration_weeks,
                    daysRemaining,
                    endDate,
                });

                await sendPush({
                    coachId,
                    clientId: program.user_id,
                    clientName,
                    alertId,
                    headline,
                    description,
                });

                summary.fired++;
            }
        } catch (err) {
            console.error(`[program-expiration] error on program ${program.id}: ${err.message}`);
            summary.failed++;
        }
    }

    const elapsed = Date.now() - started;
    console.log(`[program-expiration] done in ${elapsed}ms — ${JSON.stringify(summary)}`);
    return {
        statusCode: 200,
        body: JSON.stringify({ ...summary, elapsed_ms: elapsed, started_at: new Date(started).toISOString() }),
    };
};
