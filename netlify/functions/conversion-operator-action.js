/**
 * conversion-operator-action
 *
 * Protected, supervised state updates for the conversion operator board.
 * These actions never send DMs or change billing. They write an audit event
 * and, where appropriate, update the IG funnel stage used by existing admin
 * surfaces.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACTIONS = {
    mark_link_sent: {
        label: 'Link sent',
        status: 'link_sent',
        defaultSnoozeDays: 2,
        note: 'Onboarding/challenge link sent. Watch for app signup.',
    },
    mark_pitch_ready: {
        label: 'Pitch ready',
        status: 'pitch_ready',
        defaultSnoozeDays: null,
        note: 'Flagged as ready for a coaching pitch.',
    },
    pitch_coaching: {
        label: 'Coaching pitched',
        status: 'coaching_pitched',
        defaultSnoozeDays: 3,
        note: 'Coaching offer pitched. Wait for reply before follow-up.',
    },
    move_fallback: {
        label: 'Fallback app/group',
        status: 'fallback_app_group',
        defaultSnoozeDays: null,
        note: 'Moved to app/group fallback path.',
    },
    mark_paid: {
        label: 'Paid',
        status: 'paid',
        defaultSnoozeDays: null,
        note: 'Manually marked as paid in the operator funnel.',
    },
    snooze: {
        label: 'Snoozed',
        status: 'snoozed',
        defaultSnoozeDays: 3,
        note: 'Snoozed from the conversion operator board.',
    },
};

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function getHeader(headers, name) {
    const lower = name.toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

function isUuid(value) {
    return UUID_RE.test(String(value || ''));
}

function cleanString(value, max = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function plainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function addDaysIso(days) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
}

function resolveSnoozeUntil(action, body) {
    const requested = Number(body.snoozeDays);
    const config = ACTIONS[action];
    const days = Number.isFinite(requested) && requested > 0
        ? Math.min(30, Math.round(requested))
        : config.defaultSnoozeDays;
    return days ? addDaysIso(days) : null;
}

async function supabase(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status} ${text.slice(0, 500)}`);
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

async function requireShannonAdmin(event) {
    const authHeader = getHeader(event.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: json(401, { error: 'Unauthorized' }) };

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) return { response: json(401, { error: 'Unauthorized' }) };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (email !== BALANCE_ADMIN_EMAIL) return { response: json(403, { error: 'Forbidden' }) };
    return { user };
}

async function loadThread(threadId) {
    if (!threadId) return null;
    const rows = await supabase(
        `ig_threads?select=id,coach_id,linked_user_id,lead_stage,qualifier,custom_data,ig_username,profile_name&id=eq.${encodeURIComponent(threadId)}&limit=1`
    );
    return rows[0] || null;
}

async function loadClient(clientId) {
    if (!clientId) return null;
    const rows = await supabase(
        `users?select=id,name,email,subscription_status,is_test_account&id=eq.${encodeURIComponent(clientId)}&limit=1`
    );
    return rows[0] || null;
}

function buildThreadPatch({ thread, action, actorId, previousLane, note, snoozedUntil, now }) {
    const actionConfig = ACTIONS[action];
    const customData = plainObject(thread.custom_data);
    const previousOperator = plainObject(customData.conversion_operator);
    const operatorState = {
        ...previousOperator,
        status: actionConfig.status,
        last_action: action,
        last_action_label: actionConfig.label,
        last_action_at: now,
        last_actor_id: actorId,
        previous_lane: previousLane || null,
        note: note || actionConfig.note,
        snoozed_until: snoozedUntil,
    };
    const patch = {
        custom_data: {
            ...customData,
            conversion_operator: operatorState,
        },
        updated_at: now,
    };

    const qualifier = plainObject(thread.qualifier);
    const qualifierOperator = plainObject(qualifier.operator_conversion);
    patch.qualifier = {
        ...qualifier,
        operator_conversion: {
            ...qualifierOperator,
            status: actionConfig.status,
            last_action: action,
            last_action_at: now,
            snoozed_until: snoozedUntil,
        },
    };

    if (action === 'mark_link_sent') {
        patch.lead_stage = 'invited';
        patch.qualifier.stage = 'won';
        patch.qualifier.stage_label = 'Ready for link';
        patch.qualifier.challenge_route = 'link_sent';
    }

    if (action === 'pitch_coaching') {
        patch.qualifier.stage = 'pitched';
        patch.qualifier.stage_label = 'Coaching pitched';
    }

    if (action === 'mark_paid') {
        patch.lead_stage = 'paying';
        patch.qualifier.stage = 'paid';
        patch.qualifier.stage_label = 'Paid';
    }

    if (action === 'move_fallback') {
        patch.qualifier.challenge_route = 'fallback_app_group';
    }

    return patch;
}

async function patchPendingAlert({ alertId, coachId, action, snoozedUntil, now, note }) {
    if (!alertId) return null;
    const rows = await supabase(
        `coach_alerts?select=id,coach_id,status,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
    );
    const alert = rows[0] || null;
    if (!alert || alert.coach_id !== coachId) return null;

    const data = {
        ...plainObject(alert.data),
        conversion_operator_last_action: action,
        conversion_operator_actioned_at: now,
        conversion_operator_note: note || ACTIONS[action].note,
    };

    const body = { data };
    if (snoozedUntil && alert.status === 'pending') body.snoozed_until = snoozedUntil;

    await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
        method: 'PATCH',
        body,
        prefer: 'return=minimal',
    });

    return alert.id;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Server misconfigured' });

    const admin = await requireShannonAdmin(event);
    if (admin.response) return admin.response;

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }

    const coachId = String(body.coachId || admin.user?.id || '').trim();
    if (!isUuid(coachId)) return json(400, { error: 'Missing coachId' });
    if (coachId !== admin.user?.id) return json(403, { error: 'Forbidden' });

    const action = String(body.action || '').trim();
    if (!ACTIONS[action]) return json(400, { error: 'Invalid action' });

    const threadId = isUuid(body.threadId) ? String(body.threadId) : null;
    const requestedClientId = isUuid(body.clientId) ? String(body.clientId) : null;
    const pendingAlertId = isUuid(body.pendingAlertId) ? String(body.pendingAlertId) : null;
    const previousLane = cleanString(body.lane || body.previousLane || '', 80) || null;
    const now = new Date().toISOString();
    const note = cleanString(body.note || '', 500) || ACTIONS[action].note;
    const snoozedUntil = resolveSnoozeUntil(action, body);

    if (!threadId && !requestedClientId) return json(400, { error: 'Missing target' });

    try {
        const thread = await loadThread(threadId);
        if (threadId && !thread) return json(404, { error: 'Thread not found' });
        if (thread && thread.coach_id !== coachId) return json(403, { error: 'Forbidden' });

        const clientId = requestedClientId || thread?.linked_user_id || null;
        const client = await loadClient(clientId);
        if (clientId && !client) return json(404, { error: 'Client not found' });
        if (client?.is_test_account) return json(400, { error: 'Cannot action test account' });

        if (thread) {
            const patch = buildThreadPatch({ thread, action, actorId: admin.user.id, previousLane, note, snoozedUntil, now });
            await supabase(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
                method: 'PATCH',
                body: patch,
                prefer: 'return=minimal',
            });
        }

        const alertPatched = await patchPendingAlert({
            alertId: pendingAlertId,
            coachId,
            action,
            snoozedUntil,
            now,
            note,
        });

        const entityKind = clientId ? 'client' : 'lead';
        const displayName = cleanString(body.displayName || thread?.profile_name || thread?.ig_username || client?.name || client?.email || '', 120);
        const inserted = await supabase('conversion_operator_events', {
            method: 'POST',
            body: [{
                coach_id: coachId,
                actor_id: admin.user.id,
                entity_kind: entityKind,
                thread_id: thread?.id || null,
                client_id: clientId,
                action,
                previous_lane: previousLane,
                note,
                snoozed_until: snoozedUntil,
                metadata: {
                    display_name: displayName || null,
                    label: ACTIONS[action].label,
                    status: ACTIONS[action].status,
                    pending_alert_id: pendingAlertId,
                    pending_alert_patched: alertPatched,
                    previous_lead_stage: thread?.lead_stage || null,
                    requested_from: 'conversion_operator',
                },
            }],
        });

        return json(200, {
            ok: true,
            action,
            label: ACTIONS[action].label,
            eventId: inserted?.[0]?.id || null,
            snoozedUntil,
            threadId: thread?.id || null,
            clientId,
        });
    } catch (error) {
        console.error('[conversion-operator-action] failed:', error);
        return json(500, { error: error.message || 'Action failed' });
    }
};
