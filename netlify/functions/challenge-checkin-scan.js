/**
 * Challenge Check-In Scan
 *
 * Queues Monday / Wednesday / Friday challenge check-ins for active cohorts.
 * Drafts land in coach_alerts for Shannon to approve, edit, send, or copy
 * manually when no linked IG thread exists.
 *
 * Schedule:
 * - Sun 19:30 UTC -> Mon 05:30 Brisbane: encouragement only.
 * - Wed 08:00 UTC -> Wed 18:00 Brisbane: midweek review after Wednesday activity.
 * - Thu 19:30 UTC -> Fri 05:30 Brisbane: full weekly review.
 */

const {
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    buildMemoryBlock,
    loadClientProfileFacts,
    buildClientProfileBlock,
    buildNameUsePolicyBlock,
    buildRelationshipDiscoveryBlock,
    buildHeardFirstConversationBlock,
    loadEditExamples,
    loadRecentWorkouts,
    formatRecentWorkoutEvidence,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    truncate,
    truncateTail,
    formatTimedConversationLine,
} = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const BRISBANE_TZ = 'Australia/Brisbane';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PARTICIPANTS_PER_RUN = 24;
const PARTICIPANT_DRAFT_BATCH_SIZE = 5;
const CHECKINS_URL = `${SITE_URL}/admin-dashboard.html?tab=checkins`;
const SHANNON_EMAILS = new Set([
    'shannonbirch@cocospersonaltraining.com',
    'shannon@plantbased-balance.org',
]);

function brisbaneParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: BRISBANE_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    }).formatToParts(date).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});
    return {
        dateKey: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: parts.weekday,
    };
}

function parseLocalDate(dateKey) {
    if (!dateKey) return null;
    const d = new Date(`${dateKey}T00:00:00+10:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetweenLocal(startDateKey, endDateKey) {
    const start = parseLocalDate(startDateKey);
    const end = parseLocalDate(endDateKey);
    if (!start || !end) return 0;
    return Math.floor((end.getTime() - start.getTime()) / DAY_MS);
}

function cadenceForWeekday(weekday) {
    const key = String(weekday || '').slice(0, 3).toLowerCase();
    if (key === 'mon') {
        return {
            key: 'monday',
            label: 'Monday morning encouragement',
            lookbackDays: 0,
            depth: 'encouragement',
            priority: 'medium',
            lengthRule: '1 upbeat sentence, max 2 if needed.',
            prompt: 'Encouragement only. No review, no data analysis. Think: "woohoo monday morning, ready for a big week?" Keep it light and energising.',
        };
    }
    if (key === 'wed') {
        return {
            key: 'wednesday',
            label: 'Wednesday night halfway check',
            lookbackDays: 3,
            depth: 'quick',
            priority: 'medium',
            lengthRule: '2 to 3 short sentences.',
            prompt: 'Middle-of-the-week check-in. Keep it light and simple: mention how many sessions they have logged, pick one specific exercise/set that looked good if available, mention meal logging only if they have logged meals for 2-3 days, then say keep it up and that Shannon will check back in Friday. End with a soft "need anything from me?" style question only if it fits.',
        };
    }
    if (key === 'fri') {
        return {
            key: 'friday',
            label: 'Friday full check-in',
            lookbackDays: 5,
            depth: 'full',
            priority: 'high',
            lengthRule: '4 to 7 short sentences, still DM-friendly.',
            prompt: 'Full Friday check-in. Review the week using every useful signal available: food, workouts, sleep, steps, weight, mood, PBs and challenge position. Be specific, encouraging, and give one practical adjustment for the weekend or next week.',
        };
    }
    return null;
}

function cadenceForKey(cadenceKey) {
    const key = String(cadenceKey || '').slice(0, 3).toLowerCase();
    if (key === 'mon') return cadenceForWeekday('Mon');
    if (key === 'wed') return cadenceForWeekday('Wed');
    if (key === 'fri') return cadenceForWeekday('Fri');
    return null;
}

function isLikelyManualRequest(event, body) {
    const method = event?.httpMethod || 'GET';
    return method === 'POST' && body && (body.force === true || body.force === 'true');
}

async function verifyAdminToken(event) {
    const auth = event?.headers?.authorization || event?.headers?.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, error: 'missing_admin_token' };
    try {
        const userRes = await fetch(`${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/auth/v1/user`, {
            headers: {
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${token}`,
            },
        });
        if (!userRes.ok) return { ok: false, error: 'invalid_admin_token' };
        const user = await userRes.json();
        if (!user?.id) return { ok: false, error: 'invalid_admin_user' };
        const rows = await supabaseQuery(`admin_users?select=user_id&user_id=eq.${user.id}&limit=1`);
        if (!rows.length) return { ok: false, error: 'not_admin' };
        return { ok: true, userId: user.id };
    } catch (err) {
        return { ok: false, error: err.message || 'admin_check_failed' };
    }
}

function isThirtyDayChallenge(challenge) {
    const duration = Number(challenge?.duration_days || 0);
    const type = String(challenge?.cohort_type || '').toLowerCase();
    const name = String(challenge?.name || '').toLowerCase();
    const namedThirtyDayChallenge = /\b30\b/.test(name) && /\bchallenge\b/.test(name);
    return type.endsWith('_30') || namedThirtyDayChallenge || (challenge?.is_system_cohort === true && duration === 30);
}

async function getActiveChallenges(todayKey) {
    const columns = 'id,name,start_date,end_date,duration_days,status,creator_id,cohort_type,is_system_cohort';
    try {
        const activeRows = await supabaseQuery(
            `challenges?select=${columns}&status=eq.active&start_date=lte.${todayKey}&end_date=gte.${todayKey}&order=start_date.desc&limit=10`
        );
        return activeRows.filter(isThirtyDayChallenge);
    } catch (err) {
        console.warn('[challenge-checkin] active challenge lookup failed, retrying with base columns:', err.message);
    }
    const fallbackColumns = 'id,name,start_date,end_date,duration_days,status,creator_id';
    const fallbackRows = await supabaseQuery(
        `challenges?select=${fallbackColumns}&status=eq.active&start_date=lte.${todayKey}&end_date=gte.${todayKey}&order=start_date.desc&limit=10`
    );
    return fallbackRows.filter(isThirtyDayChallenge);
}

async function loadAdminUserIds() {
    try {
        const rows = await supabaseQuery('admin_users?select=user_id&limit=100');
        return new Set(rows.map(r => r.user_id).filter(Boolean));
    } catch (err) {
        console.warn('[challenge-checkin] admin user lookup failed:', err.message);
        return new Set();
    }
}

async function loadChallengeParticipants(challengeId) {
    const participantRows = await supabaseQuery(
        `challenge_participants?select=user_id,accepted_at,current_points,challenge_points,starting_points,status&challenge_id=eq.${challengeId}&status=eq.accepted&limit=100`
    );
    const ids = participantRows.map(p => p.user_id).filter(Boolean);
    if (!ids.length) return [];
    const users = await supabaseQuery(
        `users?select=id,name,email,is_test_account,ig_handle&id=in.(${ids.join(',')})&limit=100`
    );
    const usersById = new Map(users.map(u => [u.id, u]));
    return participantRows.map(p => ({
        ...p,
        user: usersById.get(p.user_id) || null,
    }));
}

async function loadLinkedIgThreads(userIds) {
    if (!userIds.length) return new Map();
    try {
        const rows = await supabaseQuery(
            `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,linked_user_id,last_inbound_at,last_outbound_at,lead_stage&linked_user_id=in.(${userIds.join(',')})&order=last_inbound_at.desc&limit=200`
        );
        const byUser = new Map();
        for (const row of rows) {
            if (!row.linked_user_id || byUser.has(row.linked_user_id)) continue;
            byUser.set(row.linked_user_id, row);
        }
        return byUser;
    } catch (err) {
        console.warn('[challenge-checkin] ig thread lookup failed:', err.message);
        return new Map();
    }
}

function isSelfOrAdmin({ participant, challenge, adminUserIds }) {
    const user = participant.user || {};
    const email = String(user.email || '').toLowerCase();
    return !!user.is_test_account
        || participant.user_id === challenge.creator_id
        || adminUserIds.has(participant.user_id)
        || SHANNON_EMAILS.has(email);
}

function rankParticipants(participants) {
    const sorted = participants
        .slice()
        .sort((a, b) => (Number(b.challenge_points || 0) - Number(a.challenge_points || 0)));
    return new Map(sorted.map((p, idx) => {
        const above = idx > 0 ? sorted[idx - 1] : null;
        const behind = above
            ? Math.max(0, Number(above.challenge_points || 0) - Number(p.challenge_points || 0))
            : 0;
        return [p.user_id, {
            rank: idx + 1,
            total: sorted.length,
            gapToNext: behind,
            leaderPoints: Number(sorted[0]?.challenge_points || 0),
        }];
    }));
}

function cleanConversationText(text) {
    return String(text || '')
        .replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '[photo]')
        .replace(/\[AUDIO:https?:\/\/[^\s\]]+\]/gi, '[voice note]')
        .replace(/\[(?:VIDEO|video):\s*https?:\/\/[^\]]+\]/gi, '[video]')
        .replace(/\s+/g, ' ')
        .trim();
}

async function loadRecentConversationBlock({ coachId, clientId, igThread, sinceIso }) {
    const events = [];
    const since = encodeURIComponent(sinceIso);
    try {
        const nudges = await supabaseQuery(
            `nudges?select=sender_id,message,created_at&or=(and(sender_id.eq.${coachId},receiver_id.eq.${clientId}),and(sender_id.eq.${clientId},receiver_id.eq.${coachId}))&created_at=gte.${since}&order=created_at.asc&limit=120`
        );
        nudges.forEach(row => {
            const text = cleanConversationText(row.message);
            if (!text) return;
            events.push({
                speaker: row.sender_id === clientId ? 'Client (app)' : 'Shannon (app)',
                text,
                created_at: row.created_at,
            });
        });
    } catch (err) {
        console.warn('[challenge-checkin] app conversation lookup failed:', err.message);
    }

    if (igThread?.id) {
        try {
            const messages = await supabaseQuery(
                `ig_messages?select=direction,text,created_at&thread_id=eq.${encodeURIComponent(igThread.id)}&created_at=gte.${since}&order=created_at.asc&limit=120`
            );
            messages.forEach(row => {
                const text = cleanConversationText(row.text);
                if (!text) return;
                const channel = igThread.channel === 'messenger' ? 'FB' : 'IG';
                events.push({
                    speaker: row.direction === 'in' ? `Client (${channel})` : `Shannon (${channel})`,
                    text,
                    created_at: row.created_at,
                });
            });
        } catch (err) {
            console.warn('[challenge-checkin] IG conversation lookup failed:', err.message);
        }
    }

    if (!events.length) return '';
    events.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const now = new Date();
    const recentEvents = events.slice(-120);
    const text = recentEvents.map((event, i) => formatTimedConversationLine({
        speaker: event.speaker,
        text: event.text,
        createdAt: event.created_at,
        previousCreatedAt: recentEvents[i - 1]?.created_at,
        now,
    })).join('\n');
    return truncateTail(text, 12000);
}

function average(values) {
    const clean = values.map(Number).filter(n => Number.isFinite(n) && n > 0);
    if (!clean.length) return 0;
    return clean.reduce((s, n) => s + n, 0) / clean.length;
}

function summarizeSteps({ fitbit = [], oura = [] } = {}) {
    const byDate = new Map();
    [...fitbit, ...oura].forEach(row => {
        const day = row.date || '';
        const steps = Number(row.steps || 0);
        if (!day || steps <= 0) return;
        byDate.set(day, Math.max(byDate.get(day) || 0, steps));
    });
    const values = Array.from(byDate.values());
    if (!values.length) return 'Steps: no synced step data';
    const total = values.reduce((s, n) => s + n, 0);
    const avg = Math.round(total / values.length);
    const best = Math.max(...values);
    return `Steps: ${total.toLocaleString('en-AU')} total, ${avg.toLocaleString('en-AU')}/day avg, best ${best.toLocaleString('en-AU')}`;
}

function summarizeSleep({ fitbit = [], whoop = [], oura = [] } = {}) {
    const byDate = new Map();
    fitbit.forEach(row => {
        const minutes = Number(row.duration_minutes || 0);
        if (row.date && minutes > 0) byDate.set(row.date, Math.max(byDate.get(row.date) || 0, minutes));
    });
    whoop.forEach(row => {
        const minutes = Number(row.duration_minutes || 0);
        if (row.date && minutes > 0) byDate.set(row.date, Math.max(byDate.get(row.date) || 0, minutes));
    });
    oura.forEach(row => {
        const minutes = Number(row.total_sleep_minutes || 0);
        if (row.date && minutes > 0) byDate.set(row.date, Math.max(byDate.get(row.date) || 0, minutes));
    });
    const values = Array.from(byDate.values());
    if (!values.length) return 'Sleep: no synced sleep data';
    const avgHours = Math.round((average(values) / 60) * 10) / 10;
    const bestHours = Math.round((Math.max(...values) / 60) * 10) / 10;
    return `Sleep: ${avgHours}h avg over ${values.length} night(s), best ${bestHours}h`;
}

function formatActivityType(value) {
    return String(value || 'activity')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function summarizeActivityLogs(rows = []) {
    if (!rows.length) return '';
    const totalMinutes = rows.reduce((sum, row) => sum + Number(row.duration_minutes || 0), 0);
    const typeCounts = new Map();
    rows.forEach(row => {
        const label = cleanConversationText(row.activity_label) || formatActivityType(row.activity_type);
        if (!label) return;
        typeCounts.set(label, (typeCounts.get(label) || 0) + 1);
    });
    const topTypes = [...typeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([label, count]) => `${count} ${label}`);
    const hillLogs = rows.filter(row => /hill/i.test(`${row.activity_label || ''} ${row.notes || ''}`)).length;
    const parts = [`${rows.length} logged activit${rows.length === 1 ? 'y' : 'ies'}`];
    if (totalMinutes > 0) parts.push(`${totalMinutes} min total`);
    if (topTypes.length) parts.push(topTypes.join(', '));
    if (hillLogs) parts.push(`${hillLogs} mention${hillLogs === 1 ? 's' : ''} hills`);
    return `Activity logs: ${parts.join(', ')}`;
}

function summarizeChallengeXpWins(rows = []) {
    const useful = rows
        .filter(row => Number(row.points_amount || 0) > 0)
        .filter(row => {
            const desc = String(row.description || '').toLowerCase();
            const type = String(row.transaction_type || '').toLowerCase();
            return /milestone|bonus|weigh|workout|activity|post|story/.test(`${type} ${desc}`)
                && !/^earned 1 point for meal$/.test(desc);
        })
        .slice(0, 5);
    if (!useful.length) return '';
    const labels = useful.map(row => {
        const desc = cleanConversationText(row.description);
        const points = Number(row.points_amount || 0);
        return `${desc || row.transaction_type} (+${points})`;
    });
    return `Challenge XP/wins: ${labels.join(', ')}`;
}

async function buildActivitySummary(clientId, sinceIso, sinceDateKey, depth = 'quick') {
    if (depth === 'encouragement') {
        return 'Encouragement-only check-in. Do not review data today.';
    }
    const lines = [];
    const isFull = depth === 'full';
    const [workouts, pbs, meals, weighIns, mood, activityLogs, pointWins, fitbitSteps, ouraSteps, fitbitSleep, whoopSleep, ouraSleep] = await Promise.all([
        loadRecentWorkouts(clientId, sinceIso, 10),
        supabaseQuery(`pb_history?select=exercise_name,pb_type,new_value,improvement,achieved_at&user_id=eq.${clientId}&achieved_at=gte.${sinceIso}&order=achieved_at.desc&limit=8`).catch(() => []),
        supabaseQuery(`meal_logs?select=meal_type,meal_date,calories,protein_g,created_at&user_id=eq.${clientId}&meal_date=gte.${sinceDateKey}&order=meal_date.desc&limit=30`).catch(() => []),
        supabaseQuery(`daily_weigh_ins?select=weight,created_at&user_id=eq.${clientId}&created_at=gte.${sinceIso}&order=created_at.asc&limit=20`).catch(() => []),
        supabaseQuery(`mood_logs?select=mood_score,energy_score,created_at&user_id=eq.${clientId}&created_at=gte.${sinceIso}&order=created_at.desc&limit=10`).catch(() => []),
        supabaseQuery(`activity_logs?select=activity_type,activity_label,duration_minutes,intensity,notes,activity_date,created_at&user_id=eq.${clientId}&activity_date=gte.${sinceDateKey}&order=created_at.desc&limit=30`).catch(() => []),
        supabaseQuery(`point_transactions?select=transaction_type,points_amount,description,reference_type,created_at&user_id=eq.${clientId}&created_at=gte.${sinceIso}&points_amount=gt.0&order=created_at.desc&limit=30`).catch(() => []),
        isFull ? supabaseQuery(`fitbit_daily_activity?select=date,steps,active_minutes,calories_burned&user_id=eq.${clientId}&date=gte.${sinceDateKey}&order=date.asc&limit=14`).catch(() => []) : Promise.resolve([]),
        isFull ? supabaseQuery(`oura_daily_activity?select=date,steps,active_minutes,total_calories,active_calories&user_id=eq.${clientId}&date=gte.${sinceDateKey}&order=date.asc&limit=14`).catch(() => []) : Promise.resolve([]),
        isFull ? supabaseQuery(`fitbit_sleep?select=date,duration_minutes,efficiency&user_id=eq.${clientId}&date=gte.${sinceDateKey}&order=date.asc&limit=14`).catch(() => []) : Promise.resolve([]),
        isFull ? supabaseQuery(`whoop_sleep?select=date,duration_minutes,sleep_efficiency&user_id=eq.${clientId}&date=gte.${sinceDateKey}&order=date.asc&limit=14`).catch(() => []) : Promise.resolve([]),
        isFull ? supabaseQuery(`oura_sleep?select=date,total_sleep_minutes,efficiency,sleep_score&user_id=eq.${clientId}&date=gte.${sinceDateKey}&order=date.asc&limit=14`).catch(() => []) : Promise.resolve([]),
    ]);

    if (workouts.length) {
        const names = [...new Set(workouts.map(w => w.templateName).filter(Boolean))].slice(0, 4);
        const workoutEvidence = formatRecentWorkoutEvidence(workouts, isFull ? 3 : 2);
        lines.push(`${workouts.length} workout(s) logged${names.length ? `: ${names.join(', ')}` : ''}${workoutEvidence ? `\nWorkout detail:\n${workoutEvidence}` : ''}`);
    } else {
        lines.push('0 workouts logged');
    }

    if (meals.length) {
        const mealDays = new Set(meals.map(m => m.meal_date || (m.created_at || '').slice(0, 10)).filter(Boolean));
        const proteinMeals = meals.filter(m => Number(m.protein_g || 0) > 0).length;
        const totalCalories = meals.reduce((sum, m) => sum + Number(m.calories || 0), 0);
        const totalProtein = meals.reduce((sum, m) => sum + Number(m.protein_g || 0), 0);
        const dailyParts = [];
        if (totalCalories > 0 && mealDays.size > 0) dailyParts.push(`${Math.round(totalCalories / mealDays.size)} cals/day avg`);
        if (totalProtein > 0 && mealDays.size > 0) dailyParts.push(`${Math.round(totalProtein / mealDays.size)}g protein/day avg`);
        const dailySummary = dailyParts.length ? `, ${dailyParts.join(', ')}` : '';
        lines.push(`${mealDays.size} day(s) with meals logged (${meals.length} meals)${dailySummary}, ${proteinMeals}/${meals.length} meals include protein`);
    } else {
        lines.push('0 meals logged');
    }

    const activityLogSummary = summarizeActivityLogs(activityLogs);
    if (activityLogSummary) lines.push(activityLogSummary);

    const xpSummary = summarizeChallengeXpWins(pointWins);
    if (xpSummary) lines.push(xpSummary);

    if (pbs.length) {
        lines.push(`${pbs.length} PB(s): ${pbs.slice(0, 3).map(p => `${p.exercise_name} ${p.new_value}${p.pb_type === 'weight' ? 'kg' : ''}`).join(', ')}`);
    }

    if (weighIns.length >= 2) {
        const first = Number(weighIns[0].weight);
        const last = Number(weighIns[weighIns.length - 1].weight);
        const diff = Math.round((last - first) * 10) / 10;
        lines.push(`Weight: ${first}kg to ${last}kg (${diff > 0 ? '+' : ''}${diff}kg)`);
    } else if (weighIns.length === 1) {
        lines.push(`Latest weight: ${weighIns[0].weight}kg`);
    }

    if (mood.length) {
        const avgMood = Math.round((mood.reduce((s, m) => s + Number(m.mood_score || 0), 0) / mood.length) * 10) / 10;
        const avgEnergy = Math.round((mood.reduce((s, m) => s + Number(m.energy_score || 0), 0) / mood.length) * 10) / 10;
        lines.push(`Mood avg ${avgMood}/10, energy ${avgEnergy}/10`);
    }

    if (isFull) {
        lines.push(summarizeSteps({ fitbit: fitbitSteps, oura: ouraSteps }));
        lines.push(summarizeSleep({ fitbit: fitbitSleep, whoop: whoopSleep, oura: ouraSleep }));
    }

    return lines.join('\n');
}

function igWindowStatus(thread) {
    if (!thread?.last_inbound_at) {
        return { status: 'unknown', label: 'no inbound timestamp' };
    }
    const hours = (Date.now() - new Date(thread.last_inbound_at).getTime()) / (60 * 60 * 1000);
    if (!Number.isFinite(hours)) return { status: 'unknown', label: 'unknown window' };
    if (hours <= 24) return { status: 'open_24h', label: 'inside 24h IG window' };
    if (hours <= 24 * 7) return { status: 'maybe_7d', label: 'outside 24h, may need human-agent window' };
    return { status: 'closed', label: 'older than 7 days, manual backup likely' };
}

function cleanDraftOutput(text, clientName, options = {}) {
    const allowHeyaWeekOpening = options.allowHeyaWeekOpening
        && /^\s*heya!\s+week\s+\d+\b/i.test(text || '');
    const cleaned = allowHeyaWeekOpening ? text : stripLeadingGreeting(text, clientName);
    return cleaned
        .replace(/^\s*(?:friday\s+)?check[- ]?in[.:]\s*/i, '')
        .replace(/[\u2014\u2013]/g, ',')
        .replace(/\s+,/g, ',')
        .replace(/\s+/g, ' ')
        .trim();
}

function challengeWeekLabel(challengeDay) {
    const day = Math.max(1, Number(challengeDay || 1));
    const week = Math.max(1, Math.ceil(day / 7));
    return `week ${week}`;
}

function challengeArcLabel(challengeDay, daysLeft) {
    const day = Math.max(1, Number(challengeDay || 1));
    const remaining = Math.max(0, Number(daysLeft || 0));
    if (remaining <= 7) return 'final stretch';
    if (day <= 7) return 'foundation week';
    if (day <= 21) return 'middle build';
    return 'late challenge build';
}

function titleCaseWeekLabel(label) {
    return String(label || '').replace(/^week\b/i, 'Week');
}

function challengeReviewOpening({ challengeDay, daysLeft }) {
    const weekLabel = titleCaseWeekLabel(challengeWeekLabel(challengeDay));
    const weekNumber = Math.max(1, Math.ceil(Math.max(1, Number(challengeDay || 1)) / 7));
    if (weekNumber === 1) {
        return `Heya! ${weekLabel} is complete, which means the foundation week of our 30 day challenge is done. Let's wind back and have a look at your bigger goal, so you said...`;
    }
    if (weekNumber === 2) {
        return `Heya! ${weekLabel} is complete, which means we are halfway through our 30 day challenge. Let's wind back and have a look at your bigger goal, so you said...`;
    }
    if (Math.max(0, Number(daysLeft || 0)) <= 7) {
        return `Heya! ${weekLabel} is complete, and we are into the final stretch of our 30 day challenge. Let's wind back and have a look at your bigger goal, so you said...`;
    }
    return `Heya! ${weekLabel} is complete, so let's wind back and have a look at your bigger goal. You said...`;
}

function normalizeGoalText(text) {
    return cleanConversationText(text)
        .replace(/\bPRIMARY:\s*/gi, '')
        .replace(/\bNUTRITION BLOCK:\s*/gi, '')
        .replace(/\bLONG-TERM SEED:\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function fallbackGoalFromParticipant(participant) {
    const weightGoal = String(participant?.weight_goal || '').trim().toLowerCase();
    if (weightGoal === 'lose') return 'lose weight / body fat through the challenge';
    if (weightGoal === 'gain') return 'build weight or muscle through the challenge';
    if (weightGoal === 'maintain') return 'maintain and build consistency through the challenge';
    return '';
}

function buildGoalProgressFrame({ memory, participant, challengeDay, daysLeft }) {
    const weekLabel = challengeWeekLabel(challengeDay);
    const arcLabel = challengeArcLabel(challengeDay, daysLeft);
    const reviewOpening = challengeReviewOpening({ challengeDay, daysLeft });
    const memoryGoal = normalizeGoalText(memory?.goals || '');
    const fallbackGoal = fallbackGoalFromParticipant(participant);
    const goalText = memoryGoal || fallbackGoal;
    const goalSource = memoryGoal ? 'client-stated goal from conversation/memory' : fallbackGoal ? 'basic challenge goal from app setup' : 'no explicit goal captured';
    return `GOAL PROGRESS FRAME:
- Challenge progress label: ${weekLabel}.
- Challenge arc label: ${arcLabel}.
- Bigger 30-day / north-star goal source: ${goalSource}.
- Bigger 30-day / north-star goal to reference: ${goalText ? truncate(goalText, 520) : 'No clear bigger goal captured yet.'}
- Treat the week goal as the next checkpoint toward the bigger goal, not as the whole goal.
- For Friday/full-review check-ins, start with this warm rewind shape before the goal: "${reviewOpening}"
- For Wednesday/Friday/full-review style check-ins, make the two layers obvious in Shannon's natural voice:
  1. "you said..." or "you told me..." plus the bigger 30-day goal
  2. "so for ${weekLabel}, this is the bit we are building..."
  3. compare the current week's evidence against that bigger goal and this week's focus.
- Weekly focus should come from the recent conversation and activity evidence: workouts, meal logging, weight trend, PBs, mood/energy, soreness, consistency, food setup, stress, schedule, or the current blocker.
- If the client mentioned a specific this-week goal, use it under the bigger goal. If they did not, infer a tiny weekly focus from evidence without pretending they said it.
- If no clear bigger goal is captured, do not invent one. Ask them to set the bigger 30-day goal and give one simple 7-day starting point.
- Keep it human, not report-card-ish.`;
}

async function generateDraft({
    clientName,
    profileBlock,
    memoryBlock,
    goalProgressFrame,
    editExamples,
    activitySummary,
    conversationBlock,
    challenge,
    challengeDay,
    daysLeft,
    ranking,
    cadence,
}) {
    const nameUsePolicy = buildNameUsePolicyBlock();
    const relationshipDiscovery = buildRelationshipDiscoveryBlock();
    const heardFirstConversation = buildHeardFirstConversationBlock();
    const rankLine = ranking
        ? `Rank: ${ranking.rank}/${ranking.total}, ${ranking.gapToNext ? `${ranking.gapToNext} points behind the next spot` : 'currently leading or tied at the top'}`
        : 'Rank: unknown';
    const cadenceRules = cadence.depth === 'encouragement'
        ? '\nMONDAY RULE: do not mention food, workouts, sleep, steps, rank, gaps, or compliance. Just encouragement for the week.'
        : cadence.depth === 'quick'
            ? '\nWEDNESDAY RULE: this is not a review. Structure it like Shannon checking in quickly mid-week: "good to see you have already got X sessions done", then one exercise highlight, then meals if they logged them for 2-3 days, then "keep it up, we will check back in Friday". Use at most one question, ideally "need anything from me?" Do not mention rank, points, weight, mood, energy, sleep, steps, gaps, or overall challenge position unless there are no workout or meal signals at all.'
            : '\nFRIDAY RULE: this is the full weekly review. Use food, workouts, sleep, steps and any other available data, but only mention what is actually present.';
    const prompt = `Draft a SHORT private challenge check-in from Shannon to ${clientName}.

This is part of Shannon's Monday / Wednesday / Friday challenge rhythm. Write as Shannon, not as an assistant. Do not mention AI, automation, systems, dashboards, or models.

CRITICAL:
- No greeting like "hey" or "hi" for normal quick replies. For Friday/full-review challenge goal reviews only, use the "Heya! Week..." opener from the goal frame.
- Keep it casual Australian, direct, warm, and specific.
- Length: ${cadence.lengthRule}
- Follow the check-in moment exactly. Monday is encouragement only, Wednesday is a quick halfway touch, Friday is the full data review.
- Reference the actual challenge/activity details below only when that fits the moment.
- For Wednesday and Friday, frame the message around both the bigger 30-day goal and the current challenge week. Friday/full-review should sound like: "Heya! Week 2 is complete, which means we are halfway through our 30 day challenge. Let's wind back and have a look at your bigger goal, so you said X. For week 2, Y is what we are building..."
- For Friday, recap the week as evidence toward the bigger goal first, then use the recent conversation to make the next weekly focus or final question relevant instead of generic.
- End with one useful question or one clear next move.
- Do not claim Shannon has updated, tweaked, fixed, checked, sent, created, or changed anything unless the conversation below shows that action already happened.
- Mention rank positively or neutrally. Never shame someone for being lower on the board.
- Do not use an em dash.

CHECK-IN MOMENT:
${cadence.label}: ${cadence.prompt}${cadenceRules}

${nameUsePolicy}
${relationshipDiscovery}
${heardFirstConversation}

CLIENT: ${clientName}${profileBlock || ''}${memoryBlock || ''}

${goalProgressFrame || ''}

RECENT CONVERSATION THIS WEEK (oldest -> newest):
${conversationBlock || 'No tracked app/IG conversation in this activity window.'}

CONVERSATION USE:
- If they talked about a specific issue, win, schedule problem, app problem, food setup, injury, or life context this week, check in on that naturally.
- Do not repeat the transcript back to them.
- Do not mention that a system or prompt reviewed the conversation.
- If the conversation has no useful hook, ask a simple "how are you feeling after week one?" style question.

CHALLENGE:
${challenge.name || '30-day challenge'}
Day ${challengeDay}, ${daysLeft} day(s) left
${rankLine}

RECENT ACTIVITY WINDOW:
${activitySummary || 'No tracked activity in this window.'}${editExamples}

Reply with just the message text, no quotes, no labels.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 1024, temperature: 0.86 };

    try {
        const reply = await callVertexAIModel(contents, generationConfig);
        const text = cleanDraftOutput(reply, clientName, { allowHeyaWeekOpening: cadence.depth === 'full' });
        if (text && text.trim()) return { text, model: 'vertex-v7' };
        throw new Error('empty_draft');
    } catch (err) {
        console.warn(`[challenge-checkin] Vertex failed for ${clientName}: ${err.message}`);
    }
    try {
        const reply = await callGeminiFallback(contents, generationConfig);
        const text = cleanDraftOutput(reply, clientName, { allowHeyaWeekOpening: cadence.depth === 'full' });
        if (text && text.trim()) return { text, model: 'gemini-2.5-flash-fallback' };
        throw new Error('empty_draft');
    } catch (err) {
        console.error(`[challenge-checkin] Gemini fallback failed for ${clientName}: ${err.message}`);
    }

    const fallback = cadence.key === 'friday'
        ? `solid week to look back on here. what felt like the biggest win, and what do we need to tighten up over the weekend?`
        : `quick challenge check-in, what is the main thing that would make the next couple of days easier to nail?`;
    return { text: fallback, model: 'deterministic-fallback' };
}

async function hasPendingChallengeCheckin({ coachId, clientId }) {
    return !!(await loadPendingChallengeCheckin({ coachId, clientId }));
}

async function loadPendingChallengeCheckin({ coachId, clientId }) {
    try {
        const rows = await supabaseQuery(
            `coach_alerts?select=id,data&coach_id=eq.${coachId}&client_id=eq.${clientId}&alert_type=eq.weekly_checkin&status=eq.pending&data->>subtype=eq.challenge_checkin&order=created_at.desc&limit=1`
        );
        return rows[0] || null;
    } catch (err) {
        return null;
    }
}

function buildChallengeCheckinIdempotencyKey({ challengeId, clientId, dateKey, cadenceKey, manualRunId }) {
    const base = `challenge_checkin:${challengeId}:${clientId}:${dateKey}:${cadenceKey || 'checkin'}`;
    return manualRunId ? `${base}:manual:${manualRunId}` : base;
}

async function queueForParticipant({ challenge, participant, ranking, igThread, cadence, dateKey, manualRunId, regeneratePending = false }) {
    const coachId = challenge.creator_id;
    const clientId = participant.user_id;
    const user = participant.user || {};
    const clientName = user.name || (user.email || '').split('@')[0] || 'Client';

    const pendingAlert = await loadPendingChallengeCheckin({ coachId, clientId });
    if (pendingAlert && !regeneratePending) {
        return { skipped: 'pending_exists' };
    }

    const sinceLocal = parseLocalDate(dateKey);
    sinceLocal.setDate(sinceLocal.getDate() - cadence.lookbackDays);
    const sinceIso = sinceLocal.toISOString();
    const sinceDateKey = brisbaneParts(sinceLocal).dateKey;

    const [memory, profile, activitySummary, conversationBlock, editExamples] = await Promise.all([
        loadClientMemory(coachId, clientId),
        loadClientProfileFacts(clientId),
        buildActivitySummary(clientId, sinceIso, sinceDateKey, cadence.depth),
        loadRecentConversationBlock({ coachId, clientId, igThread, sinceIso }),
        loadEditExamples({
            clientId,
            igThreadId: igThread?.id || null,
            lookback: 40,
            max: 8,
            generalCap: 2,
        }),
    ]);

    const profileBlock = buildClientProfileBlock({ clientName, profile });
    const memoryBlock = buildMemoryBlock(memory);
    const challengeDay = Math.max(1, daysBetweenLocal(challenge.start_date, dateKey) + 1);
    const daysLeft = Math.max(0, daysBetweenLocal(dateKey, challenge.end_date));
    const challengeWeek = challengeWeekLabel(challengeDay);
    const goalProgressFrame = buildGoalProgressFrame({ memory, participant, challengeDay, daysLeft });
    const draft = await generateDraft({
        clientName,
        profileBlock,
        memoryBlock,
        goalProgressFrame,
        editExamples,
        activitySummary,
        conversationBlock,
        challenge,
        challengeDay,
        daysLeft,
        ranking,
        cadence,
    });

    const hasManyChatThread = !!(igThread?.id && igThread?.subscriber_id && (igThread.channel === 'instagram' || igThread.channel === 'messenger'));
    const windowStatus = hasManyChatThread ? igWindowStatus(igThread) : null;
    const sendableIg = hasManyChatThread && windowStatus?.status === 'open_24h';
    const manualReason = !hasManyChatThread
        ? 'No linked IG or ManyChat thread for this app user.'
        : windowStatus?.status === 'maybe_7d'
            ? 'Outside the 24h Instagram window, copy this into Instagram manually.'
            : 'Linked IG thread is older than 7 days, send this one manually in Instagram.';
    const deliveryData = sendableIg
        ? {
            delivery_channel: igThread.channel,
            channel: igThread.channel,
            ig_thread_id: igThread.id,
            subscriber_id: igThread.subscriber_id,
            ig_username: igThread.ig_username || null,
            ig_profile_name: igThread.profile_name || null,
            ig_last_inbound_at: igThread.last_inbound_at || null,
            ig_last_outbound_at: igThread.last_outbound_at || null,
            ig_window_status: windowStatus,
            manual_ig_required: false,
        }
        : {
            delivery_channel: 'manual_ig',
            channel: 'manual_ig',
            ig_thread_id: igThread?.id || null,
            ig_username: igThread?.ig_username || null,
            ig_profile_name: igThread?.profile_name || null,
            ig_window_status: windowStatus,
            manual_ig_required: true,
            manual_ig_handle: igThread?.ig_username || user.ig_handle || null,
            manual_reason: manualReason,
        };

    const alertRow = {
        client_id: clientId,
        client_name: clientName,
        coach_id: coachId,
        alert_type: 'weekly_checkin',
        priority: cadence.priority || (cadence.key === 'friday' ? 'high' : 'medium'),
        title: `${clientName}: ${cadence.label} challenge check-in`,
        description: truncate(`${challenge.name || 'Challenge'} day ${challengeDay}. ${activitySummary || 'No recent app activity.'}`, 240),
        suggested_message: draft.text || null,
        status: 'pending',
        data: {
            subtype: 'challenge_checkin',
            challenge_checkin: true,
            challenge_id: challenge.id,
            challenge_name: challenge.name,
            cohort_type: challenge.cohort_type || null,
            date_key: dateKey,
            cadence: cadence.key,
            cadence_label: cadence.label,
            challenge_day: challengeDay,
            challenge_week: challengeWeek,
            days_left: daysLeft,
            participant_count: ranking?.total || null,
            rank: ranking?.rank || null,
            gap_to_next: ranking?.gapToNext || null,
            challenge_points: Number(participant.challenge_points || 0),
            activity_snapshot: activitySummary,
            conversation_snapshot: conversationBlock ? truncate(conversationBlock, 4000) : null,
            draft_model: draft.model,
            drafted_at: new Date().toISOString(),
            ...deliveryData,
        },
    };

    if (pendingAlert?.id && regeneratePending) {
        const existingData = pendingAlert.data && typeof pendingAlert.data === 'object' ? pendingAlert.data : {};
        const updated = await supabaseQuery(`coach_alerts?id=eq.${pendingAlert.id}`, {
            method: 'PATCH',
            body: {
                client_name: alertRow.client_name,
                priority: alertRow.priority,
                title: alertRow.title,
                description: alertRow.description,
                suggested_message: alertRow.suggested_message,
                status: 'pending',
                data: {
                    ...existingData,
                    ...alertRow.data,
                    regenerated_at: new Date().toISOString(),
                    regenerated_from_pending: true,
                },
            },
            prefer: 'return=representation',
        });
        return {
            alertId: updated?.[0]?.id || pendingAlert.id,
            regenerated: true,
            coachId,
            manual: !sendableIg,
            channel: sendableIg ? igThread.channel : 'manual_ig',
        };
    }

    const idempotencyKey = buildChallengeCheckinIdempotencyKey({
        challengeId: challenge.id,
        clientId,
        dateKey,
        cadenceKey: cadence.key,
        manualRunId,
    });
    const result = await insertCoachAlert(alertRow, idempotencyKey);
    if (result.deduped) return { alertId: result.alertId, deduped: true };

    return {
        alertId: result.alertId,
        coachId,
        manual: !sendableIg,
        channel: sendableIg ? igThread.channel : 'manual_ig',
    };
}

async function processParticipantsInBatches(participants, batchSize, worker) {
    const results = [];
    for (let i = 0; i < participants.length; i += batchSize) {
        const batch = participants.slice(i, i + batchSize);
        const settled = await Promise.allSettled(batch.map(worker));
        results.push(...settled);
    }
    return results;
}

async function loadReadyNotificationRecipients(primaryCoachId) {
    const fallback = primaryCoachId ? [primaryCoachId] : [];
    try {
        const admins = await supabaseQuery('admin_users?select=user_id&limit=100');
        const adminIds = admins.map(a => a.user_id).filter(Boolean);
        if (!adminIds.length) return fallback;
        const subscriptions = await supabaseQuery(
            `push_subscriptions?select=user_id,updated_at&user_id=in.(${adminIds.join(',')})&order=updated_at.desc&limit=100`
        );
        const subscribedAdmins = [...new Set(subscriptions.map(s => s.user_id).filter(Boolean))];
        return subscribedAdmins.length ? subscribedAdmins : fallback;
    } catch (err) {
        console.warn('[challenge-checkin] notification recipient lookup failed:', err.message);
        return fallback;
    }
}

async function notifyCoachCheckinsReady({ coachId, cadence, summary }) {
    const readyCount = Number(summary?.queued || 0) + Number(summary?.regenerated || 0);
    if (!coachId || !readyCount) return 0;
    const bodyParts = [
        `${readyCount} check-in${readyCount === 1 ? '' : 's'} ready`,
        `${summary.ig_ready || 0} IG ready`,
        `${summary.manual || 0} manual IG`,
    ];
    const recipients = await loadReadyNotificationRecipients(coachId);
    let sentCount = 0;
    try {
        for (const recipientId of recipients) {
            const res = await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientId,
                    senderId: 'challenge_checkins',
                    senderName: 'Check-ins are ready',
                    messageText: `${cadence.label}: ${bodyParts.join(' | ')}`,
                    type: 'coach_checkins_ready',
                    url: CHECKINS_URL,
                    openUrl: CHECKINS_URL,
                    isSimpleReply: false,
                }),
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok && Number(json.sent || 0) > 0) sentCount++;
            else console.warn(`[challenge-checkin] ready notification skipped for ${recipientId}: ${json.message || json.error || res.status}`);
        }
        return sentCount;
    } catch (err) {
        console.warn('[challenge-checkin] ready notification failed:', err.message);
        return sentCount;
    }
}

async function runScan({ force = false, cadenceKey = null, regeneratePending = force } = {}) {
    const started = Date.now();
    const { dateKey, weekday } = brisbaneParts(new Date());
    const requestedCadence = cadenceForKey(cadenceKey);
    const cadence = requestedCadence || cadenceForWeekday(weekday);
    const summary = {
        date_key: dateKey,
        weekday,
        force,
        regenerate_pending: !!regeneratePending,
        requested_cadence: requestedCadence?.key || null,
        active_challenges: 0,
        participants_seen: 0,
        eligible: 0,
        queued: 0,
        manual: 0,
        ig_ready: 0,
        skipped_not_checkin_day: 0,
        skipped_self_admin_test: 0,
        skipped_pending_exists: 0,
        deduped: 0,
        regenerated: 0,
        failed: 0,
        ready_notifications: 0,
    };

    if (!cadence && !force) {
        summary.skipped_not_checkin_day = 1;
        return summary;
    }
    const effectiveCadence = cadence || cadenceForWeekday('Fri');
    summary.cadence = effectiveCadence?.key || null;
    summary.cadence_label = effectiveCadence?.label || null;
    const adminUserIds = await loadAdminUserIds();
    const challenges = await getActiveChallenges(dateKey);
    summary.active_challenges = challenges.length;
    const coachesWithQueuedDrafts = new Set();
    const manualRunId = force ? new Date(started).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) : null;

    for (const challenge of challenges) {
        const participants = await loadChallengeParticipants(challenge.id);
        summary.participants_seen += participants.length;
        const rankingMap = rankParticipants(participants);
        const eligible = participants
            .filter(p => !isSelfOrAdmin({ participant: p, challenge, adminUserIds }))
            .slice(0, MAX_PARTICIPANTS_PER_RUN);
        summary.skipped_self_admin_test += participants.length - eligible.length;
        summary.eligible += eligible.length;

        const igThreads = await loadLinkedIgThreads(eligible.map(p => p.user_id));
        const participantResults = await processParticipantsInBatches(
            eligible,
            PARTICIPANT_DRAFT_BATCH_SIZE,
            (participant) => queueForParticipant({
                challenge,
                participant,
                ranking: rankingMap.get(participant.user_id),
                igThread: igThreads.get(participant.user_id) || null,
                cadence: effectiveCadence,
                dateKey,
                manualRunId,
                regeneratePending,
            })
        );
        for (const settled of participantResults) {
            if (settled.status === 'rejected') {
                console.error(`[challenge-checkin] failed: ${settled.reason?.message || settled.reason}`);
                summary.failed++;
                continue;
            }
            const result = settled.value || {};
            if (result.skipped === 'pending_exists') summary.skipped_pending_exists++;
            else if (result.deduped) summary.deduped++;
            else if (result.regenerated) {
                summary.regenerated++;
                if (result.coachId) coachesWithQueuedDrafts.add(result.coachId);
                if (result.manual) summary.manual++;
                else summary.ig_ready++;
            }
            else if (result.alertId) {
                summary.queued++;
                if (result.coachId) coachesWithQueuedDrafts.add(result.coachId);
                if (result.manual) summary.manual++;
                else summary.ig_ready++;
            } else {
                summary.failed++;
            }
        }
    }

    for (const coachId of coachesWithQueuedDrafts) {
        summary.ready_notifications += await notifyCoachCheckinsReady({ coachId, cadence: effectiveCadence, summary });
    }

    summary.elapsed_ms = Date.now() - started;
    return summary;
}

exports.handler = async (event = {}) => {
    let body = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch { body = {}; }

    const manualForce = isLikelyManualRequest(event, body);
    if (manualForce) {
        const admin = await verifyAdminToken(event);
        if (!admin.ok) {
            return { statusCode: 403, body: JSON.stringify({ error: admin.error }) };
        }
    }

    try {
        const summary = await runScan({ force: manualForce, cadenceKey: body.cadence || body.cadenceKey || body.forceCadence });
        return { statusCode: 200, body: JSON.stringify(summary) };
    } catch (err) {
        console.error('[challenge-checkin] fatal:', err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message || 'scan_failed' }) };
    }
};

exports.runScan = runScan;
