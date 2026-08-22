const crypto = require('crypto');

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    insertCoachAlert,
    loadClientMemory,
    buildMemoryBlock,
    buildNameUsePolicyBlock,
    callVertexAIModel,
    callGeminiFallback,
    stripLeadingGreeting,
    normalizeGeneratedCoachDraftText,
    truncate,
} = require('./_lib/client-context');

const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const OVERALL_VALUES = new Set(['strong', 'mostly_on_track', 'mixed', 'tough']);
const SUPPORT_VALUES = new Set(['accountability', 'training', 'nutrition', 'routine', 'talk', 'nothing_specific']);

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function cleanString(value, max = 600) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim()
        .slice(0, max);
}

function bearerToken(headers = {}) {
    const raw = headers.authorization || headers.Authorization || '';
    const match = String(raw).match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : '';
}

async function getAuthedUser(accessToken) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !accessToken) return null;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) return null;
    return await response.json().catch(() => null);
}

function parseDateKey(value) {
    const key = cleanString(value, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const date = new Date(`${key}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return { key, date };
}

function addDays(date, days) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

function brisbaneWeekday(now = new Date()) {
    return new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane',
        weekday: 'long',
    }).format(now).toLowerCase();
}

async function loadInAppCheckinSchedule(clientId) {
    const rows = await supabaseQuery(
        `client_memory?select=preferences&client_id=eq.${encodeURIComponent(clientId)}&order=updated_at.desc&limit=5`
    ).catch(() => []);
    for (const row of rows) {
        const preferences = asObject(row?.preferences);
        const schedule = asObject(preferences.in_app_checkins);
        const weekly = asObject(schedule.weekly_reflection);
        if (weekly.enabled !== true) continue;
        const days = Array.isArray(weekly.additional_days)
            ? weekly.additional_days.map((day) => cleanString(day, 20).toLowerCase()).filter(Boolean)
            : [];
        return {
            enabled: true,
            additional_days: [...new Set(days)],
            timezone: cleanString(weekly.timezone, 80) || 'Australia/Brisbane',
            presentation: cleanString(weekly.presentation, 80) || 'local_calendar_day',
            form_type: 'weekly_reflection',
        };
    }
    return {
        enabled: false,
        additional_days: [],
        timezone: 'Australia/Brisbane',
        presentation: 'local_calendar_day',
        form_type: 'weekly_reflection',
    };
}

function occurrenceForRequest(body = {}) {
    const occurrence = cleanString(body.occurrence, 40).toLowerCase();
    return occurrence || 'weekly';
}

function occurrenceAllowed(occurrence, schedule, now = new Date()) {
    const weekday = brisbaneWeekday(now);
    if (occurrence === 'weekly') return ['friday', 'saturday', 'sunday'].includes(weekday);
    if (occurrence === 'midweek_wednesday') {
        return weekday === 'wednesday' && schedule?.enabled === true && schedule.additional_days.includes('wednesday');
    }
    return false;
}

function dateKey(date) {
    return date.toISOString().slice(0, 10);
}

function cleanGoals(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 3).map((goal) => ({
        id: cleanString(goal?.id, 80),
        label: cleanString(goal?.label, 120) || 'Goal',
        current: Number.isFinite(Number(goal?.current)) ? Number(goal.current) : 0,
        target: Number.isFinite(Number(goal?.target)) ? Number(goal.target) : 0,
        value: cleanString(goal?.value, 120),
        complete: goal?.complete === true,
    }));
}

function validatePayload(body = {}, now = new Date()) {
    const week = parseDateKey(body.week_start);
    if (!week || week.date.getUTCDay() !== 1) {
        return { error: 'A valid Monday week start is required.' };
    }
    const daysFromNow = Math.abs(now.getTime() - week.date.getTime()) / 86400000;
    if (daysFromNow > 10) return { error: 'That weekly check-in is no longer available.' };

    const overall = cleanString(body.overall, 40);
    const support = cleanString(body.support, 40);
    const win = cleanString(body.win, 600);
    const blocker = cleanString(body.blocker, 600);
    const note = cleanString(body.note, 900);
    const confidence = Math.round(Number(body.confidence || 0));

    if (!OVERALL_VALUES.has(overall)) return { error: 'Choose how the week felt overall.' };
    if (win.length < 2) return { error: 'Add your biggest win for the week.' };
    if (!Number.isFinite(confidence) || confidence < 1 || confidence > 5) {
        return { error: 'Choose a confidence score from 1 to 5.' };
    }
    if (!SUPPORT_VALUES.has(support)) return { error: 'Choose what support would help next week.' };

    return {
        value: {
            version: 1,
            week_start: week.key,
            week_end: dateKey(addDays(week.date, 6)),
            overall,
            win,
            blocker,
            confidence,
            support,
            note,
            goals: cleanGoals(body.goals),
        },
    };
}

async function loadClientProfile(userId, authUser) {
    const rows = await supabaseQuery(
        `users?select=id,name,email&id=eq.${encodeURIComponent(userId)}&limit=1`
    ).catch(() => []);
    const row = rows[0] || {};
    return {
        id: userId,
        name: row.name || authUser?.user_metadata?.name || authUser?.email?.split('@')[0] || 'Client',
        email: row.email || authUser?.email || '',
    };
}

async function resolveCoach(clientId) {
    const links = await supabaseQuery(
        `coach_clients?select=coach_id&client_id=eq.${encodeURIComponent(clientId)}&status=eq.active&order=assigned_at.asc&limit=1`
    ).catch(() => []);
    if (links[0]?.coach_id) return links[0].coach_id;
    const admins = await supabaseQuery(
        `users?select=id&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`
    ).catch(() => []);
    return admins[0]?.id || null;
}

function asObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (_) {
            return {};
        }
    }
    return {};
}

async function saveResponse(clientId, response) {
    const rows = await supabaseQuery(
        `daily_checkins?select=id,additional_data&user_id=eq.${encodeURIComponent(clientId)}&checkin_date=eq.${response.week_start}&limit=1`
    ).catch(() => []);
    const existing = rows[0] || null;
    const existingAdditionalData = asObject(existing?.additional_data);
    const priorResponses = Array.isArray(existingAdditionalData.weekly_checkins)
        ? existingAdditionalData.weekly_checkins.filter((item) => item && typeof item === 'object')
        : [];
    if (existingAdditionalData.weekly_checkin && typeof existingAdditionalData.weekly_checkin === 'object') {
        const legacy = { occurrence: 'weekly', ...existingAdditionalData.weekly_checkin };
        if (!priorResponses.some((item) => item.occurrence === 'weekly' && item.week_start === legacy.week_start)) {
            priorResponses.push(legacy);
        }
    }
    const weeklyCheckins = priorResponses
        .filter((item) => !(item.occurrence === response.occurrence && item.week_start === response.week_start))
        .concat(response);
    const additionalData = {
        ...existingAdditionalData,
        weekly_checkins: weeklyCheckins,
        ...(response.occurrence === 'weekly' ? { weekly_checkin: response } : {}),
    };

    if (existing?.id) {
        await supabaseQuery(`daily_checkins?id=eq.${encodeURIComponent(existing.id)}`, {
            method: 'PATCH',
            body: { additional_data: additionalData },
            prefer: 'return=minimal',
        });
        return;
    }

    await supabaseQuery('daily_checkins?on_conflict=user_id,checkin_date', {
        method: 'POST',
        body: [{
            user_id: clientId,
            checkin_date: response.week_start,
            additional_data: additionalData,
        }],
        prefer: 'resolution=merge-duplicates,return=minimal',
    });
}

const OVERALL_LABELS = {
    strong: 'Strong week',
    mostly_on_track: 'Mostly on track',
    mixed: 'Mixed week',
    tough: 'Tough week',
};

const SUPPORT_LABELS = {
    accountability: 'Keep me accountable',
    training: 'Adjust or explain my training',
    nutrition: 'Help with food or meal planning',
    routine: 'Help the plan fit my routine',
    talk: 'Talk something through with me',
    nothing_specific: 'Nothing specific right now',
};

function goalSummary(goals) {
    if (!goals.length) return 'No weekly goals were available in the form.';
    return goals.map((goal) => `${goal.label}: ${goal.value || `${goal.current}/${goal.target}`}${goal.complete ? ' (hit)' : ''}`).join('; ');
}

function responseSummary(response) {
    return [
        `Overall: ${OVERALL_LABELS[response.overall]}.`,
        `Confidence next week: ${response.confidence}/5.`,
        `Biggest win: ${response.win}`,
        response.blocker ? `What got in the way: ${response.blocker}` : 'What got in the way: nothing added.',
        `Support requested: ${SUPPORT_LABELS[response.support]}.`,
        response.note ? `Anything else: ${response.note}` : '',
        `Weekly goals: ${goalSummary(response.goals)}`,
    ].filter(Boolean).join('\n');
}

function fallbackDraft(response) {
    const win = response.win.replace(/[.!?]+$/g, '');
    if (response.support === 'nothing_specific') {
        return normalizeGeneratedCoachDraftText(`good work on ${win}. what do you want to carry into next week?`);
    }
    const support = SUPPORT_LABELS[response.support].toLowerCase();
    return normalizeGeneratedCoachDraftText(`good work on ${win}. ill help you with ${support}, what would make the biggest difference first?`);
}

async function generateReplyDraft({ clientName, coachId, clientId, response }) {
    const memory = await loadClientMemory(coachId, clientId).catch(() => null);
    const prompt = `Draft a short reply from Shannon to a coaching client who just completed their weekly check-in.

Rules:
- No greeting. Jump straight in.
- Aussie casual, warm, and specific. 2 or 3 short sentences maximum.
- Acknowledge their real win or blocker, then respond to the support they asked for.
- Use their goal progress only when it helps. Do not recite every stat.
- End with one useful open question. Do not ask a generic question.
- Never mention AI, automation, a form, or generated data.
- Use normal phone punctuation. Do not use em dashes.

${buildNameUsePolicyBlock()}

CLIENT: ${clientName}
${buildMemoryBlock(memory)}

THEIR WEEKLY CHECK-IN:
${responseSummary(response)}

Reply with only the message text.`;
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const config = { maxOutputTokens: 500, temperature: 0.78 };
    try {
        return normalizeGeneratedCoachDraftText(stripLeadingGreeting(await callVertexAIModel(contents, config)));
    } catch (vertexError) {
        console.warn('[submit-weekly-checkin] Vertex draft failed:', vertexError.message);
        try {
            return normalizeGeneratedCoachDraftText(stripLeadingGreeting(await callGeminiFallback(contents, config)));
        } catch (fallbackError) {
            console.warn('[submit-weekly-checkin] fallback draft failed:', fallbackError.message);
            return fallbackDraft(response);
        }
    }
}

function idempotencyKey(clientId, weekStart, occurrence = 'weekly') {
    const digest = crypto.createHash('sha256').update(`${clientId}:${weekStart}:${occurrence}`).digest('hex').slice(0, 24);
    return `client_weekly_checkin:${digest}`;
}

exports.handler = async (event) => {
    if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Server misconfigured' });

    const authUser = await getAuthedUser(bearerToken(event.headers || {}));
    if (!authUser?.id) return json(401, { error: 'Login required' });

    const schedule = await loadInAppCheckinSchedule(authUser.id);
    if (event.httpMethod === 'GET') return json(200, { ok: true, schedule });

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (_) {
        return json(400, { error: 'Invalid JSON' });
    }

    const occurrence = occurrenceForRequest(body);
    if (!occurrenceAllowed(occurrence, schedule)) {
        return json(403, { error: 'That check-in is not scheduled for today.' });
    }

    const checked = validatePayload(body);
    if (checked.error) return json(400, { error: checked.error });
    const response = { ...checked.value, occurrence, submitted_at: new Date().toISOString() };

    const [profile, coachId] = await Promise.all([
        loadClientProfile(authUser.id, authUser),
        resolveCoach(authUser.id),
    ]);
    if (!coachId) return json(500, { error: 'No coach found' });

    try {
        await saveResponse(authUser.id, response);
        const suggestedMessage = await generateReplyDraft({
            clientName: profile.name,
            coachId,
            clientId: authUser.id,
            response,
        });
        const summary = responseSummary(response);
        const alert = await insertCoachAlert({
            client_id: authUser.id,
            client_name: profile.name,
            coach_id: coachId,
            alert_type: 'weekly_checkin',
            priority: response.confidence <= 2 || response.overall === 'tough' ? 'high' : 'medium',
            title: `${profile.name} completed their weekly check-in`,
            description: truncate(summary.replace(/\n/g, ' | '), 900),
            suggested_message: suggestedMessage || null,
            status: 'pending',
            data: {
                subtype: 'client_weekly_checkin_response',
                operator_queue: 'needs_you',
                needs_you_required: true,
                needs_you_reason: 'client_weekly_checkin_response',
                response,
                activity_snapshot: summary,
                submitted_from: occurrence === 'midweek_wednesday' ? 'wednesday_accountability_card' : 'to_do_next',
                drafted_at: new Date().toISOString(),
                draft_model: suggestedMessage ? 'shannon_voice_chain' : null,
            },
        }, idempotencyKey(authUser.id, response.week_start, occurrence));

        return json(200, {
            ok: true,
            alert_id: alert.alertId,
            deduped: alert.deduped,
            week_start: response.week_start,
        });
    } catch (error) {
        console.error('[submit-weekly-checkin] failed:', error.message);
        return json(500, { error: 'Your check-in could not be saved. Please try again.' });
    }
};

exports._test = {
    cleanGoals,
    validatePayload,
    responseSummary,
    fallbackDraft,
    brisbaneWeekday,
    occurrenceAllowed,
};
