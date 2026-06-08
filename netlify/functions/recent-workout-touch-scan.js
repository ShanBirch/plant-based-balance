/**
 * Recent Workout Touch Scan
 *
 * Looks for freshly completed workouts and creates a short Needs You approval
 * card so Shannon can keep the client conversation warm. This is intentionally
 * conservative: max once per client per 7 days, skips first workouts, skips
 * quiet hours, skips clients with pending Needs You work, and avoids exact
 * load/reps callouts unless a future PR-specific system owns that context.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    truncate,
} = require('./_lib/client-context');

const SOURCE = 'recent-workout-touch-scan';
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_WORKOUT_AGE_MINUTES = Number(process.env.RECENT_WORKOUT_TOUCH_MIN_AGE_MINUTES || 8);
const MAX_WORKOUT_AGE_MINUTES = Number(process.env.RECENT_WORKOUT_TOUCH_MAX_AGE_MINUTES || 40);
const COOLDOWN_DAYS = Number(process.env.RECENT_WORKOUT_TOUCH_COOLDOWN_DAYS || 7);
const MAX_ALERTS_PER_RUN = Number(process.env.RECENT_WORKOUT_TOUCH_MAX_ALERTS || 2);
const RECENT_OUTBOUND_COOLDOWN_HOURS = Number(process.env.RECENT_WORKOUT_TOUCH_OUTBOUND_COOLDOWN_HOURS || 3);
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 7;

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clean(value = '', max = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function displayName(assignment = {}) {
    return assignment.client?.name
        || assignment.client?.email?.split('@')[0]
        || assignment.client_name
        || 'Client';
}

function hoursBetween(laterMs, earlierIso) {
    const earlierMs = Date.parse(earlierIso || '');
    if (!Number.isFinite(earlierMs)) return null;
    return (laterMs - earlierMs) / (60 * 60 * 1000);
}

function minutesBetween(laterMs, earlierIso) {
    const hours = hoursBetween(laterMs, earlierIso);
    return hours === null ? null : hours * 60;
}

function brisbaneHour(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane',
        hour: '2-digit',
        hour12: false,
    }).formatToParts(now);
    return Number(parts.find(part => part.type === 'hour')?.value || 0);
}

function isQuietTime(now = new Date()) {
    const hour = brisbaneHour(now);
    return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

function graphRecipientId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    return clean(graph.ig_graph_user_id || graph.recipient_id || customData.ig_graph_user_id || '', 160);
}

function threadDeliveryData(thread = null, nowMs = Date.now()) {
    if (!thread?.id) {
        return { channel: 'in_app', delivery_channel: 'in_app' };
    }
    const recipientId = graphRecipientId(thread);
    const lastInboundAt = thread.last_inbound_at || null;
    const hoursSinceInbound = lastInboundAt ? hoursBetween(nowMs, lastInboundAt) : null;
    const graphCanSend = !!recipientId && hoursSinceInbound !== null && hoursSinceInbound <= 24;
    const graph = safeObject(safeObject(thread.custom_data).instagram_graph);
    return {
        channel: graphCanSend ? 'instagram' : 'manual_ig',
        delivery_channel: graphCanSend ? 'instagram_graph' : 'manual_ig',
        manual_ig_required: !graphCanSend,
        manual_reason: graphCanSend ? undefined : 'Recent Workout Touch found this, but Instagram Graph is outside the safe send window. Approve the idea, then copy/send manually in Instagram.',
        ig_thread_id: thread.id,
        ig_username: thread.ig_username || thread.profile_name || null,
        profile_name: thread.profile_name || thread.ig_username || null,
        subscriber_id: thread.subscriber_id || null,
        ig_graph_recipient_id: recipientId || undefined,
        ig_graph_account_id: graph.ig_account_id || graph.account_id || undefined,
        instagram_graph: recipientId ? {
            ...graph,
            ig_graph_user_id: recipientId,
            send_ready: graphCanSend,
            last_inbound_at: lastInboundAt,
        } : graph,
    };
}

function normalizeExerciseName(name = '') {
    return clean(name, 120)
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function exerciseCategory(name = '') {
    const value = normalizeExerciseName(name).toLowerCase();
    if (/\bfront\s+squat\b/.test(value)) return { key: 'front_squat', label: 'front squats', priority: 100 };
    if (/\bsquat\b/.test(value)) return { key: 'squat', label: 'squats', priority: 92 };
    if (/\b(deadlift|rdl|romanian|hinge)\b/.test(value)) return { key: 'hinge', label: 'hinge work', priority: 88 };
    if (/\b(hip\s+thrust|glute|split\s+squat|bulgarian|leg\s+press|lunge)\b/.test(value)) return { key: 'lower', label: 'lower-body work', priority: 82 };
    if (/\b(bench|press|push[-\s]?up|pushup|chest)\b/.test(value)) return { key: 'push', label: 'pressing', priority: 72 };
    if (/\b(row|pulldown|pull[-\s]?up|pullup|lat)\b/.test(value)) return { key: 'pull', label: 'pulling', priority: 70 };
    if (/\b(core|plank|dead\s+bug|ab|hollow|brace)\b/.test(value)) return { key: 'core', label: 'core work', priority: 76 };
    return { key: 'general', label: '', priority: 50 };
}

function summarizeWorkoutSession(rows = []) {
    const sorted = [...rows].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const newest = sorted.reduce((latest, row) => {
        if (!latest) return row;
        return String(row.created_at || '') > String(latest.created_at || '') ? row : latest;
    }, null);
    const exerciseMap = new Map();
    for (const row of rows) {
        const name = normalizeExerciseName(row.exercise_name);
        if (!name) continue;
        const key = name.toLowerCase();
        if (!exerciseMap.has(key)) {
            exerciseMap.set(key, {
                name,
                rows: 0,
                category: exerciseCategory(name),
            });
        }
        exerciseMap.get(key).rows += 1;
    }
    const exercises = [...exerciseMap.values()];
    const bestCategory = exercises
        .map(ex => ex.category)
        .sort((a, b) => b.priority - a.priority)[0] || exerciseCategory('');
    const templateName = clean(newest?.template_name || rows[0]?.template_name || 'Workout', 120);
    return {
        userId: newest?.user_id || rows[0]?.user_id || '',
        templateName,
        workoutDate: newest?.workout_date || rows[0]?.workout_date || '',
        completedAt: newest?.created_at || rows[0]?.created_at || '',
        exerciseCount: exercises.length,
        setRows: rows.length,
        exercises,
        highlight: bestCategory,
    };
}

function buildWorkoutTouchMessage(session = {}) {
    const highlight = session.highlight || {};
    if (highlight.key === 'front_squat') return 'yo, those front squats looked solid. how was the session?';
    if (highlight.key === 'squat') return 'yo, those squats looked solid. how was the session?';
    if (highlight.key === 'hinge') return 'yo, that hinge work looked solid. how did it feel?';
    if (highlight.key === 'lower') return 'yo, lower-body session looked sweet. how was it?';
    if (highlight.key === 'core') return 'yo, core work looked solid. how did it feel?';
    if (highlight.key === 'push') return 'yo, pressing looked solid. how was the session?';
    if (highlight.key === 'pull') return 'yo, pulling looked solid. how was it?';
    return 'yo, workout looked sweet. how was it?';
}

function workoutEvidence(session = {}) {
    const exerciseNames = (session.exercises || [])
        .map(ex => ex.name)
        .filter(Boolean)
        .slice(0, 6);
    return {
        template_name: session.templateName || null,
        workout_date: session.workoutDate || null,
        completed_at: session.completedAt || null,
        exercise_count: session.exerciseCount || 0,
        set_rows: session.setRows || 0,
        exercise_names: exerciseNames,
        highlight: session.highlight || null,
    };
}

function buildNeedsYouAlert({ assignment, thread = null, session, now = new Date() }) {
    const clientName = displayName(assignment);
    const message = buildWorkoutTouchMessage(session);
    const delivery = threadDeliveryData(thread, now.getTime());
    const data = {
        subtype: 'recent_workout_touch',
        recent_workout_touch: true,
        recent_workout_touch_source: SOURCE,
        recent_workout_touch_evidence: workoutEvidence(session),
        drafted_at: now.toISOString(),
        draft_text: message,
        draft_messages: [message],
        operator_queue: 'needs_you',
        needs_you_required: true,
        needs_you_reason: 'recent_workout_touch',
        needs_you_reasons: ['recent_workout_touch'],
        client_manager_review_required: true,
        needs_shannon_approval: true,
        non_challenge_checkin: true,
        manual_checkin_roster: true,
        linked_client_name: clientName,
        ...delivery,
        codex_review: {
            source: SOURCE,
            decision: 'needs_you_recent_workout_touch',
            queue: 'needs_you',
            reason: 'fresh_workout_logged',
            needs_shannon_approval: true,
            reviewed_at: now.toISOString(),
            automation_id: SOURCE,
            evidence_ids: [
                assignment.client_id ? `users:${assignment.client_id}` : '',
                thread?.id ? `ig_threads:${thread.id}` : '',
                session.completedAt ? `workouts:${assignment.client_id}:${session.completedAt}` : '',
            ].filter(Boolean),
        },
    };

    return {
        coach_id: assignment.coach_id,
        client_id: assignment.client_id,
        client_name: clientName,
        alert_type: 'weekly_checkin',
        priority: 'medium',
        title: `Workout touch for ${clientName}`,
        description: `${clientName} just finished ${session.templateName || 'a workout'}. Keep it casual and ask how it felt.`,
        suggested_message: message,
        status: 'pending',
        data,
    };
}

function workoutTouchIdempotencyKey({ assignment, session }) {
    const completedKey = clean(session.completedAt || session.workoutDate || new Date().toISOString(), 80);
    return `recent_workout_touch:${assignment.coach_id}:${assignment.client_id}:${completedKey}`;
}

async function loadShannonCoachId() {
    const rows = await supabaseQuery(`users?select=id,email&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
    return rows[0]?.id || null;
}

async function loadActiveAssignments(coachId) {
    return supabaseQuery(
        `coach_clients?select=coach_id,client_id,assigned_at,client:users!coach_clients_client_id_fkey(id,name,email,is_test_account)&coach_id=eq.${coachId}&status=eq.active&limit=500`
    );
}

async function loadLatestThreads(clientIds = []) {
    if (!clientIds.length) return new Map();
    const out = new Map();
    const chunks = [];
    for (let i = 0; i < clientIds.length; i += 80) chunks.push(clientIds.slice(i, i + 80));
    for (const chunk of chunks) {
        const inList = chunk.map(id => `"${id}"`).join(',');
        const rows = await supabaseQuery(
            `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,linked_user_id,last_inbound_at,last_outbound_at,custom_data&linked_user_id=in.(${inList})&order=last_inbound_at.desc.nullslast&limit=300`
        ).catch(() => []);
        for (const row of rows) {
            if (!out.has(row.linked_user_id)) out.set(row.linked_user_id, row);
        }
    }
    return out;
}

async function loadRecentWorkoutRows(clientIds = [], now = new Date()) {
    if (!clientIds.length) return [];
    const minIso = new Date(now.getTime() - MAX_WORKOUT_AGE_MINUTES * 60 * 1000).toISOString();
    const maxIso = new Date(now.getTime() - MIN_WORKOUT_AGE_MINUTES * 60 * 1000).toISOString();
    const rows = [];
    for (let i = 0; i < clientIds.length; i += 80) {
        const chunk = clientIds.slice(i, i + 80);
        const inList = chunk.map(id => `"${id}"`).join(',');
        const batch = await supabaseQuery(
            `workouts?select=user_id,template_name,exercise_name,set_number,reps,weight_kg,time_duration,created_at,workout_date&user_id=in.(${inList})&workout_type=eq.history&is_current_workout=eq.false&created_at=gte.${encodeURIComponent(minIso)}&created_at=lte.${encodeURIComponent(maxIso)}&order=created_at.desc&limit=700`
        ).catch(() => []);
        rows.push(...batch);
    }
    return rows;
}

function groupWorkoutSessions(rows = []) {
    const buckets = new Map();
    for (const row of rows) {
        const userId = row.user_id;
        if (!userId) continue;
        const templateName = clean(row.template_name || 'Workout', 120) || 'Workout';
        const dateKey = row.workout_date || String(row.created_at || '').slice(0, 10);
        const key = `${userId}:${dateKey}:${templateName}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(row);
    }
    return [...buckets.values()]
        .map(summarizeWorkoutSession)
        .sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
}

async function hasAtLeastTwoWorkoutSessions(clientId) {
    const rows = await supabaseQuery(
        `workouts?select=workout_date,template_name,created_at&user_id=eq.${encodeURIComponent(clientId)}&workout_type=eq.history&is_current_workout=eq.false&order=created_at.desc&limit=120`
    ).catch(() => []);
    const keys = new Set();
    for (const row of rows) {
        keys.add(`${row.workout_date || String(row.created_at || '').slice(0, 10)}:${clean(row.template_name || 'Workout', 120)}`);
        if (keys.size >= 2) return true;
    }
    return false;
}

async function hasPendingNeedsYou({ coachId, clientId }) {
    const rows = await supabaseQuery(
        `coach_alerts?select=id,data&coach_id=eq.${encodeURIComponent(coachId)}&client_id=eq.${encodeURIComponent(clientId)}&status=eq.pending&limit=25`
    ).catch(() => []);
    return rows.some(row => {
        const data = safeObject(row.data);
        return data.needs_you_required === true
            || String(data.needs_you_required || '').toLowerCase() === 'true'
            || data.recent_workout_touch === true;
    });
}

async function hasRecentWorkoutTouch({ coachId, clientId, now = new Date() }) {
    const cutoff = new Date(now.getTime() - COOLDOWN_DAYS * DAY_MS).toISOString();
    const rows = await supabaseQuery(
        `coach_alerts?select=id&coach_id=eq.${encodeURIComponent(coachId)}&client_id=eq.${encodeURIComponent(clientId)}&created_at=gte.${encodeURIComponent(cutoff)}&data->>recent_workout_touch=eq.true&limit=1`
    ).catch(() => []);
    return rows.length > 0;
}

async function hasRecentOutbound({ assignment, thread, now = new Date(), hours = RECENT_OUTBOUND_COOLDOWN_HOURS }) {
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
    const checks = [];
    checks.push(supabaseQuery(
        `nudges?select=id&sender_id=eq.${encodeURIComponent(assignment.coach_id)}&receiver_id=eq.${encodeURIComponent(assignment.client_id)}&created_at=gte.${encodeURIComponent(cutoff)}&limit=1`
    ).catch(() => []));
    if (thread?.id) {
        checks.push(supabaseQuery(
            `ig_messages?select=id&thread_id=eq.${encodeURIComponent(thread.id)}&direction=eq.out&created_at=gte.${encodeURIComponent(cutoff)}&limit=1`
        ).catch(() => []));
    }
    const results = await Promise.all(checks);
    return results.some(rows => rows.length > 0);
}

async function sendApprovalPush({ alertId, assignment, session, message }) {
    const clientName = displayName(assignment);
    const title = `Workout touch for ${clientName}`;
    const body = `${truncate(session.templateName || 'Workout', 60)}\n${truncate(message, 140)}`;
    await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipientId: assignment.coach_id,
            senderId: assignment.client_id,
            senderName: title,
            messageText: body,
            type: 'coach_draft_ready',
            alertId,
            clientId: assignment.client_id,
            clientName,
            draftText: message,
            isSimpleReply: false,
        }),
    }).catch(error => console.warn(`[recent-workout-touch] push dispatch failed: ${error.message}`));
}

async function runRecentWorkoutTouchScan({ maxAlerts = MAX_ALERTS_PER_RUN, now = new Date() } = {}) {
    if (isQuietTime(now)) return { scanned: 0, inserted: 0, skipped: { quiet_time: 1 } };
    const coachId = await loadShannonCoachId();
    if (!coachId) return { scanned: 0, inserted: 0, skipped: { no_coach: 1 } };

    const assignmentsRaw = await loadActiveAssignments(coachId);
    const assignments = assignmentsRaw.filter(a => !a.client?.is_test_account);
    const byClient = new Map(assignments.map(a => [a.client_id, a]));
    const threadsByClient = await loadLatestThreads(assignments.map(a => a.client_id));
    const workoutRows = await loadRecentWorkoutRows(assignments.map(a => a.client_id), now);
    const sessions = groupWorkoutSessions(workoutRows).filter(session => byClient.has(session.userId));
    const skipped = {
        pending_exists: 0,
        cooldown: 0,
        first_workout: 0,
        recent_outbound: 0,
        cap: 0,
    };
    const selected = [];

    for (const session of sessions) {
        if (selected.length >= Math.max(0, maxAlerts)) break;
        const assignment = byClient.get(session.userId);
        const thread = threadsByClient.get(session.userId) || null;
        if (await hasPendingNeedsYou({ coachId: assignment.coach_id, clientId: assignment.client_id })) {
            skipped.pending_exists++;
            continue;
        }
        if (await hasRecentWorkoutTouch({ coachId: assignment.coach_id, clientId: assignment.client_id, now })) {
            skipped.cooldown++;
            continue;
        }
        if (!(await hasAtLeastTwoWorkoutSessions(assignment.client_id))) {
            skipped.first_workout++;
            continue;
        }
        if (await hasRecentOutbound({ assignment, thread, now })) {
            skipped.recent_outbound++;
            continue;
        }
        selected.push({ assignment, thread, session });
    }
    skipped.cap = Math.max(0, sessions.length - selected.length);

    const inserted = [];
    for (const item of selected) {
        const alertRow = buildNeedsYouAlert({ ...item, now });
        const key = workoutTouchIdempotencyKey({ assignment: item.assignment, session: item.session });
        const result = await insertCoachAlert(alertRow, key);
        if (result.alertId && !result.deduped) {
            inserted.push({
                alertId: result.alertId,
                clientId: item.assignment.client_id,
                clientName: displayName(item.assignment),
                completedAt: item.session.completedAt,
            });
            await sendApprovalPush({
                alertId: result.alertId,
                assignment: item.assignment,
                session: item.session,
                message: alertRow.suggested_message,
            });
        }
    }

    return {
        scanned: assignments.length,
        sessions: sessions.length,
        inserted: inserted.length,
        inserted_alerts: inserted,
        skipped,
    };
}

exports.handler = async () => {
    try {
        const result = await runRecentWorkoutTouchScan();
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, ...result }),
        };
    } catch (error) {
        console.error('[recent-workout-touch] failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ ok: false, error: error.message || String(error) }),
        };
    }
};

exports._test = {
    buildNeedsYouAlert,
    buildWorkoutTouchMessage,
    exerciseCategory,
    groupWorkoutSessions,
    isQuietTime,
    summarizeWorkoutSession,
    threadDeliveryData,
    workoutTouchIdempotencyKey,
};
