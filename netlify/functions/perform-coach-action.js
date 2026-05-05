/**
 * perform-coach-action
 *
 * Executes allowlisted backend actions proposed from a DM. First supported
 * action: move workouts inside the client's active custom workout program.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

const {
    applyMoveWorkoutDaysToSchedule,
} = require('./_lib/coach-actions');

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
    if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status} ${text}`);
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

function json(statusCode, body) {
    return { statusCode, body: JSON.stringify(body) };
}

function findAction(data, actionId) {
    const actions = Array.isArray(data?.proposed_actions) ? data.proposed_actions : [];
    return actions.find(action => action?.id === actionId) || null;
}

function updateAction(data, actionId, patch) {
    const actions = Array.isArray(data?.proposed_actions) ? data.proposed_actions : [];
    return actions.map(action => action?.id === actionId ? { ...action, ...patch } : action);
}

async function resolveClientId(alert) {
    if (alert.client_id) return alert.client_id;
    const threadId = alert.data?.ig_thread_id;
    if (!threadId) return null;
    const rows = await supabase(`ig_threads?select=linked_user_id&id=eq.${encodeURIComponent(threadId)}&limit=1`);
    return rows[0]?.linked_user_id || null;
}

async function performMoveWorkoutDays({ alert, action }) {
    const clientId = await resolveClientId(alert);
    if (!clientId) throw new Error('No linked client account for this action');

    const programs = await supabase(
        `custom_workout_programs?select=id,program_name,weekly_schedule,updated_at&user_id=eq.${encodeURIComponent(clientId)}&is_active=eq.true&order=updated_at.desc&limit=1`
    );
    const program = programs[0];
    if (!program) throw new Error('No active custom workout program found');

    const result = applyMoveWorkoutDaysToSchedule(program.weekly_schedule || [], action.payload || {});
    const updatedAt = new Date().toISOString();
    await supabase(`custom_workout_programs?id=eq.${encodeURIComponent(program.id)}`, {
        method: 'PATCH',
        body: {
            weekly_schedule: result.schedule,
            updated_at: updatedAt,
        },
        prefer: 'return=minimal',
    });

    return {
        ...result,
        program_id: program.id,
        program_name: program.program_name,
        updated_at: updatedAt,
    };
}

async function sendDonePush({ alert, result }) {
    if (!alert.coach_id) return;
    try {
        await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: alert.coach_id,
                senderId: alert.client_id || alert.data?.ig_thread_id || 'coach_action',
                senderName: `Action done: ${alert.client_name || 'client'}`,
                messageText: result.summary || 'Coach action completed.',
                type: 'coach_action_done',
                alertId: alert.id,
                clientId: alert.client_id || '',
                clientName: alert.client_name || '',
            }),
        });
    } catch (e) {
        console.warn('[perform-coach-action] done push failed:', e.message);
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Server misconfigured' });

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }

    const alertId = String(body.alertId || '').trim();
    const actionId = String(body.actionId || '').trim();
    if (!alertId || !actionId) return json(400, { error: 'Missing alertId or actionId' });

    let alert;
    try {
        const rows = await supabase(
            `coach_alerts?select=id,client_id,client_name,coach_id,status,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
        );
        alert = rows[0] || null;
    } catch (e) {
        console.error('[perform-coach-action] alert lookup failed:', e.message);
        return json(500, { error: 'Alert lookup failed' });
    }
    if (!alert) return json(404, { error: 'Alert not found' });

    const data = alert.data || {};
    const action = findAction(data, actionId);
    if (!action) return json(404, { error: 'Action not found' });
    if (action.status === 'completed') return json(409, { error: 'Action already completed', action });
    if (action.status && action.status !== 'pending') return json(409, { error: `Action is ${action.status}`, action });

    let result;
    try {
        if (action.type === 'move_workout_days') {
            result = await performMoveWorkoutDays({ alert, action });
        } else {
            return json(400, { error: `Unsupported action type: ${action.type}` });
        }
    } catch (e) {
        const failedAt = new Date().toISOString();
        const nextData = {
            ...data,
            proposed_actions: updateAction(data, actionId, {
                status: 'failed',
                failed_at: failedAt,
                error: e.message,
            }),
            last_coach_action_error: {
                action_id: actionId,
                error: e.message,
                failed_at: failedAt,
            },
        };
        await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
            method: 'PATCH',
            body: { data: nextData },
            prefer: 'return=minimal',
        }).catch(() => {});
        return json(500, { error: e.message });
    }

    const completedAt = new Date().toISOString();
    const nextData = {
        ...data,
        proposed_actions: updateAction(data, actionId, {
            status: 'completed',
            completed_at: completedAt,
            result: {
                summary: result.summary,
                program_id: result.program_id,
                program_name: result.program_name,
                before: result.before,
                after: result.after,
            },
        }),
        last_coach_action_result: {
            action_id: actionId,
            type: action.type,
            completed_at: completedAt,
            summary: result.summary,
        },
    };

    try {
        await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
            method: 'PATCH',
            body: { data: nextData },
            prefer: 'return=minimal',
        });
    } catch (e) {
        return json(500, { error: 'Action completed but alert update failed', details: e.message, result });
    }

    await sendDonePush({ alert: { ...alert, data: nextData }, result });
    return json(200, { ok: true, action: findAction(nextData, actionId), data: nextData, result });
};
