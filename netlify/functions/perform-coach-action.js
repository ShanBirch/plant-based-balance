/**
 * perform-coach-action
 *
 * Executes allowlisted backend actions proposed from a DM. First supported
 * action family: safe coach-approved workout/program changes.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { callGeminiFallback } = require('./_lib/client-context');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

const {
    applyMoveWorkoutDaysToSchedule,
    applyExerciseEditToSchedule,
    normalizeGeneratedProgramSchedule,
    summarizeSchedule,
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

async function loadActiveProgram(clientId, { required = true } = {}) {
    const programs = await supabase(
        `custom_workout_programs?select=id,program_name,duration_weeks,weekly_schedule,is_active,start_date,updated_at&user_id=eq.${encodeURIComponent(clientId)}&is_active=eq.true&order=updated_at.desc&limit=1`
    );
    const program = programs[0] || null;
    if (!program && required) throw new Error('No active custom workout program found');
    return program;
}

function currentProgramWeek(program) {
    if (!program?.start_date) return 1;
    const start = new Date(`${String(program.start_date).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(start.getTime())) return 1;
    const now = new Date();
    const weeks = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, weeks);
}

let workoutLibraryCache = null;
function loadWorkoutLibraries() {
    if (workoutLibraryCache) return workoutLibraryCache;
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    const files = [
        { file: 'workout_library.js', globalName: 'WORKOUT_LIBRARY' },
        { file: 'workout_library_extended.js', globalName: 'WORKOUT_LIBRARY_EXTENDED' },
    ];
    files.forEach(({ file, globalName }) => {
        const fullPath = path.join(__dirname, '..', '..', file);
        if (!fs.existsSync(fullPath)) return;
        const code = `${fs.readFileSync(fullPath, 'utf8')}\n;window.${globalName} = typeof ${globalName} !== 'undefined' ? ${globalName} : window.${globalName};`;
        vm.runInContext(code, sandbox, { filename: file });
    });
    workoutLibraryCache = {
        ...(sandbox.window.WORKOUT_LIBRARY || {}),
        ...(sandbox.window.WORKOUT_LIBRARY_EXTENDED || {}),
    };
    return workoutLibraryCache;
}

function findLibraryWorkoutForScheduleItem(item, program) {
    const workout = item?.workout || {};
    const categoryKey = workout.category || (workout.type && workout.type !== 'library' ? workout.type : '');
    const subcategoryKey = workout.subcategory || workout.muscleGroup || '';
    if (!categoryKey || !subcategoryKey) return null;
    const library = loadWorkoutLibraries();
    const workouts = library?.[categoryKey]?.subcategories?.[subcategoryKey]?.workouts || [];
    if (!workouts.length) return null;
    const byName = workout.name
        ? workouts.find(w => String(w.name || '').toLowerCase() === String(workout.name || '').toLowerCase())
        : null;
    const selected = byName || workouts[(currentProgramWeek(program) - 1) % workouts.length];
    if (!selected) return null;
    return {
        ...selected,
        type: 'inline',
        category: categoryKey,
        source_workout: {
            type: 'library',
            category: categoryKey,
            subcategory: subcategoryKey,
            id: selected.id,
            name: selected.name,
        },
        exercises: Array.isArray(selected.exercises) ? selected.exercises.map(ex => ({ ...ex })) : [],
    };
}

async function loadCustomWorkoutTemplates(clientId, schedule = []) {
    const ids = [...new Set((schedule || [])
        .map(item => item?.workout?.customWorkoutId)
        .filter(Boolean))];
    if (!ids.length) return new Map();
    const filter = ids.map(id => encodeURIComponent(String(id))).join(',');
    const rows = await supabase(
        `workouts?select=id,template_name,template_data&user_id=eq.${encodeURIComponent(clientId)}&id=in.(${filter})&workout_type=eq.custom_template`
    ).catch(() => []);
    return new Map((rows || []).map(row => [row.id, row]));
}

function materializeWorkoutForEdit({ item, program, customTemplateMap }) {
    const workout = item?.workout || {};
    if (Array.isArray(workout.exercises) && workout.exercises.length) {
        return { ...workout, type: 'inline', exercises: workout.exercises.map(ex => ({ ...ex })) };
    }
    if (workout.customWorkoutId && customTemplateMap?.has(workout.customWorkoutId)) {
        const template = customTemplateMap.get(workout.customWorkoutId);
        const exercises = template?.template_data?.exercises || [];
        return {
            type: 'inline',
            name: template.template_name || workout.name || `${item.day} Workout`,
            duration: workout.duration || template.template_data?.duration || '40 min',
            difficulty: workout.difficulty || template.template_data?.difficulty || 'Intermediate',
            category: 'custom',
            source_workout: {
                type: 'custom_template',
                id: template.id,
                name: template.template_name,
            },
            exercises: Array.isArray(exercises) ? exercises.map(ex => ({ ...ex })) : [],
        };
    }
    const libraryWorkout = findLibraryWorkoutForScheduleItem(item, program);
    if (libraryWorkout) return libraryWorkout;
    return { ...workout, type: 'inline', exercises: [] };
}

async function performMoveWorkoutDays({ alert, action }) {
    const clientId = await resolveClientId(alert);
    if (!clientId) throw new Error('No linked client account for this action');

    const program = await loadActiveProgram(clientId);

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

async function performEditWorkoutExercises({ alert, action }) {
    const clientId = await resolveClientId(alert);
    if (!clientId) throw new Error('No linked client account for this action');

    const program = await loadActiveProgram(clientId);
    const customTemplateMap = await loadCustomWorkoutTemplates(clientId, program.weekly_schedule || []);
    const result = applyExerciseEditToSchedule(program.weekly_schedule || [], action.payload || {}, {
        materializeWorkout: item => materializeWorkoutForEdit({ item, program, customTemplateMap }),
    });
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

function stripMarkdownFence(text) {
    return String(text || '')
        .trim()
        .replace(/^```(?:json|javascript|js|txt|text)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function parseJsonObject(text) {
    const cleaned = stripMarkdownFence(text);
    try {
        return JSON.parse(cleaned);
    } catch (_) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Generated program JSON missing');
        return JSON.parse(match[0]);
    }
}

async function loadClientProgramContext(clientId) {
    const [users, quizzes, facts, workouts] = await Promise.all([
        supabase(`users?select=id,name,email,sex,location,subscription_status&id=eq.${encodeURIComponent(clientId)}&limit=1`).catch(() => []),
        supabase(`quiz_results?select=age,height,weight,goal_weight,sex,activity_level,goal_body_type,hormone_profile,sleep_hours,sleep_quality,energy_level,menopause_status,cycle_description,cycle_sync_preference&taken_at=not.is.null&user_id=eq.${encodeURIComponent(clientId)}&order=taken_at.desc&limit=1`).catch(() => []),
        supabase(`user_facts?select=struggles,preferences,health_notes,personal_details,goals,sleep_quality,energy_level&user_id=eq.${encodeURIComponent(clientId)}&limit=1`).catch(() => []),
        supabase(`workouts?select=workout_date,template_name,exercise_name,set_number,reps,weight_kg,created_at&user_id=eq.${encodeURIComponent(clientId)}&workout_type=eq.history&is_current_workout=eq.false&order=created_at.desc&limit=80`).catch(() => []),
    ]);
    return {
        user: users[0] || null,
        quiz: quizzes[0] || null,
        facts: facts[0] || null,
        recent_workouts: workouts || [],
    };
}

function summarizeRecentWorkoutRows(rows = []) {
    const grouped = new Map();
    rows.forEach(row => {
        const key = `${row.workout_date || ''}|${row.template_name || ''}|${row.created_at || ''}`;
        if (!grouped.has(key)) grouped.set(key, { date: row.workout_date, name: row.template_name || 'Workout', exercises: new Map() });
        const session = grouped.get(key);
        const ex = row.exercise_name || 'Exercise';
        if (!session.exercises.has(ex)) session.exercises.set(ex, []);
        session.exercises.get(ex).push(`${row.weight_kg || ''}${row.weight_kg ? 'kg ' : ''}x ${row.reps || ''}`.trim());
    });
    return [...grouped.values()].slice(0, 6).map(session => {
        const exercises = [...session.exercises.entries()].slice(0, 6).map(([name, sets]) => `${name}${sets.length ? ` (${sets.slice(0, 2).join(', ')})` : ''}`);
        return `${session.date || 'recent'} ${session.name}: ${exercises.join('; ')}`;
    }).join('\n');
}

function buildProgramGenerationPrompt({ alert, action, clientId, program, context }) {
    const currentSchedule = program?.weekly_schedule || [];
    const instruction = action.payload?.instruction || alert.data?.message_preview || '';
    const targetDays = action.payload?.target_days?.length ? action.payload.target_days.join(', ') : '';
    return `You are Shannon's private programming assistant inside Balance.

Create a safe, practical weekly workout program update for this client. Shannon will review/approve this backend action; the client will not see this text.

Return ONLY valid JSON:
{
  "program_name": "short program name",
  "duration_weeks": 6,
  "weekly_schedule": [
    { "day": "Mon", "workout": { "type": "inline", "name": "Lower Strength", "duration": "40 min", "difficulty": "Intermediate", "category": "home_weights", "exercises": [
      { "name": "Dumbbell Goblet Squat", "sets": 4, "reps": "10-12", "desc": "short coaching cue" }
    ] } },
    { "day": "Tue", "workout": { "type": "rest", "name": "Rest Day" } }
  ],
  "notes": "one private sentence for Shannon"
}

Rules:
- weekly_schedule must include exactly Mon, Tue, Wed, Thu, Fri, Sat, Sun.
- Use "type":"inline" for workout days and "type":"rest" for rest days.
- 3-8 exercises per strength workout, 1-6 sets per exercise.
- Include rest/recovery days. Do not prescribe extreme volume.
- Respect any injuries, equipment, low energy, cycle notes, and exercise dislikes from context.
- If the request says certain days, schedule workouts on those days where sensible.
- Prefer exercise names likely to exist in Shannon's library: dumbbell/barbell/machine/cable/bodyweight/yoga names. Avoid made-up equipment.
- This is programming support, not medical advice.

CLIENT_ID: ${clientId}
CLIENT_NAME: ${alert.client_name || context.user?.name || 'client'}
CLIENT REQUEST: ${instruction || '(none)'}
TARGET DAYS IF ANY: ${targetDays || '(none detected)'}

CURRENT ACTIVE PROGRAM:
${JSON.stringify({
        program_name: program?.program_name || null,
        duration_weeks: program?.duration_weeks || null,
        weekly_schedule: currentSchedule,
    }, null, 2)}

CLIENT PROFILE:
${JSON.stringify({ user: context.user, quiz: context.quiz, facts: context.facts }, null, 2)}

RECENT WORKOUT HISTORY:
${summarizeRecentWorkoutRows(context.recent_workouts) || '(none found)'}`;
}

async function performRegenerateWorkoutProgram({ alert, action }) {
    const clientId = await resolveClientId(alert);
    if (!clientId) throw new Error('No linked client account for this action');

    const program = await loadActiveProgram(clientId, { required: false });
    const context = await loadClientProgramContext(clientId);
    const prompt = buildProgramGenerationPrompt({ alert, action, clientId, program, context });
    const reply = await callGeminiFallback([{ role: 'user', parts: [{ text: prompt }] }], {
        maxOutputTokens: 5000,
        temperature: 0.35,
    });
    const generated = normalizeGeneratedProgramSchedule(parseJsonObject(reply));
    const before = summarizeSchedule(program?.weekly_schedule || []);
    const updatedAt = new Date().toISOString();
    let programId = program?.id || null;

    if (program) {
        await supabase(`custom_workout_programs?id=eq.${encodeURIComponent(program.id)}`, {
            method: 'PATCH',
            body: {
                program_name: generated.program_name,
                duration_weeks: generated.duration_weeks,
                weekly_schedule: generated.weekly_schedule,
                updated_at: updatedAt,
            },
            prefer: 'return=minimal',
        });
    } else {
        const inserted = await supabase('custom_workout_programs', {
            method: 'POST',
            body: [{
                user_id: clientId,
                program_name: generated.program_name,
                duration_weeks: generated.duration_weeks,
                weekly_schedule: generated.weekly_schedule,
                is_active: true,
                start_date: updatedAt.slice(0, 10),
            }],
            prefer: 'return=representation',
        });
        programId = inserted?.[0]?.id || null;
    }

    return {
        schedule: generated.weekly_schedule,
        before,
        after: summarizeSchedule(generated.weekly_schedule),
        program_id: programId,
        program_name: generated.program_name,
        generated_notes: generated.notes,
        updated_at: updatedAt,
        summary: `Regenerated active program: ${generated.program_name}.`,
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
        } else if (action.type === 'edit_workout_exercises') {
            result = await performEditWorkoutExercises({ alert, action });
        } else if (action.type === 'regenerate_workout_program') {
            result = await performRegenerateWorkoutProgram({ alert, action });
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
                exercise_before: result.exercise_before,
                exercise_after: result.exercise_after,
                generated_notes: result.generated_notes,
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
