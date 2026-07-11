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
const TAHLIA_EMAIL = 'seed.tahlia.brooks+kayla30@plantbased-balance.org';
const TAHLIA_SOURCE = 'tahlia-social-worker';
const SHANNON_FEED_REVIEW_USER_IDS = new Set([
    'bd1bccd6-56b6-4975-b708-7404c910d1a2',
    '00a6605e-8edb-4917-85ba-24a23f179059',
]);
const ALLOWED_TAHLIA_POST_ACTIVITY_TYPES = new Set(['workout', 'personal_best', 'weigh_in', 'fitness_diary']);
const TAHLIA_CARD_MEDIA_TYPES = new Set(['workout_card', 'checkin_card']);

const {
    DAY_ORDER,
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

async function authenticatedUser(event = {}) {
    const authorization = event.headers?.authorization || event.headers?.Authorization || '';
    const token = String(authorization).replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!response.ok) return null;
    return response.json();
}

function findAction(data, actionId) {
    const actions = Array.isArray(data?.proposed_actions) ? data.proposed_actions : [];
    return actions.find(action => action?.id === actionId) || null;
}

function updateAction(data, actionId, patch) {
    const actions = Array.isArray(data?.proposed_actions) ? data.proposed_actions : [];
    return actions.map(action => action?.id === actionId ? { ...action, ...patch } : action);
}

function isTahliaSocialAction(action = {}) {
    return ['publish_tahlia_feed_post', 'publish_tahlia_feed_comment'].includes(action.type);
}

function isAllowedTahliaPostActivityType(activityType) {
    return ALLOWED_TAHLIA_POST_ACTIVITY_TYPES.has(String(activityType || '').trim());
}

function tahliaSocialActionText(action = {}, data = {}) {
    const payload = action.payload || {};
    if (action.type === 'publish_tahlia_feed_post') {
        const card = parseTahliaCardPayload(payload.card_payload) || parseTahliaCardPayload(payload.caption);
        if (card) return tahliaCardPublicText(card) || data.draft_text || action.preview || '';
        return payload.caption || data.draft_text || action.preview || '';
    }
    if (action.type === 'publish_tahlia_feed_comment') {
        return payload.comment_text || data.draft_text || action.preview || '';
    }
    return action.preview || data.draft_text || '';
}

function tahliaSocialActionKind(action = {}, data = {}) {
    if (action.type === 'publish_tahlia_feed_post') return 'feed_post';
    if (action.type === 'publish_tahlia_feed_comment') return 'feed_comment';
    return data.social_action || action.type || 'social_action';
}

function cleanSocialText(value = '', max = 500) {
    return String(value || '')
        // This is the final guard before a Tahlia draft, edit, or card caption
        // reaches the Feed. Preserve hyphenated words, but remove AI-style
        // dash punctuation from public copy.
        .replace(/\s*--+\s*/g, ', ')
        .replace(/\s*[\u2012-\u2015\uFE58\uFE63\uFF0D]+\s*/g, ', ')
        .replace(/\s-\s/g, ', ')
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .trim()
        .slice(0, max);
}

function normalizeTahliaProposedCreatedAt(value, fallback = new Date()) {
    const parsed = value ? new Date(value) : new Date(fallback);
    if (!Number.isFinite(parsed.getTime())) return new Date(fallback).toISOString();
    const latestAllowed = Date.now() + (15 * 60 * 1000);
    if (parsed.getTime() > latestAllowed) return new Date().toISOString();
    return parsed.toISOString();
}

function parseTahliaCardPayload(value) {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return null;
    const raw = value.trim();
    if (!raw.startsWith('{')) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function tahliaCardPublicText(card = {}) {
    const cardType = String(card.card_type || '').toLowerCase();
    if (cardType === 'fitness_diary') return cleanSocialText(card.note || card.day_story || card.share_caption || '', 500);
    return cleanSocialText(card.share_caption || card.caption || '', 500);
}

function stripTahliaMediaPostCopy(card = {}) {
    const next = { ...(card || {}) };
    delete next.share_caption;
    delete next.caption;
    delete next.note;
    delete next.day_story;
    return next;
}

function activityAllowsTahliaCardType(activityType, cardType) {
    if (activityType === 'workout') return cardType === 'workout';
    if (activityType === 'personal_best') return cardType === 'pb';
    if (activityType === 'fitness_diary') return cardType === 'fitness_diary';
    if (activityType === 'weigh_in') return cardType === 'friday_weigh_in';
    return false;
}

function applyTahliaCardPublicText(card = {}, editedText = '') {
    const next = { ...card };
    if (String(next.card_type || '').toLowerCase() === 'fitness_diary') {
        next.note = editedText;
    } else {
        next.share_caption = editedText;
    }
    return next;
}

function normalizedTahliaCardCaption({ payload = {}, activityType = '' }) {
    const mediaType = cleanSocialText(payload.media_type || '', 40);
    if (!TAHLIA_CARD_MEDIA_TYPES.has(mediaType)) return null;
    const card = parseTahliaCardPayload(payload.card_payload) || parseTahliaCardPayload(payload.caption);
    if (!card) throw new Error('Tahlia card post is missing card data');
    const cardType = String(card.card_type || '').toLowerCase();
    if (!activityAllowsTahliaCardType(activityType, cardType)) {
        throw new Error('Tahlia card type does not match the approved activity');
    }
    if (mediaType === 'workout_card' && !['workout', 'pb', 'friday_weigh_in'].includes(cardType)) {
        throw new Error('Tahlia workout card payload is not a workout or PB card');
    }
    if (mediaType === 'checkin_card' && cardType !== 'fitness_diary') {
        throw new Error('Tahlia check-in card payload is not a fitness diary card');
    }
    const caption = JSON.stringify(stripTahliaMediaPostCopy(card));
    if (caption.length > 6000) throw new Error('Tahlia card payload is too large');
    return caption;
}

function applyTahliaSocialEditFromRequest({ data = {}, action = {}, actionId = '', body = {}, now = new Date() }) {
    if (!isTahliaSocialAction(action)) return { data, action, changed: false };

    const hasEditedText = Object.prototype.hasOwnProperty.call(body, 'editedText');
    if (!hasEditedText) return { data, action, changed: false };

    const editedText = cleanSocialText(body.editedText, 500);
    if (!editedText) throw new Error('Tahlia post text is empty');

    const originalText = cleanSocialText(
        body.originalText || tahliaSocialActionText(action, data),
        500
    );
    const editReason = cleanSocialText(body.editReason || '', 240);
    const editedAt = now.toISOString();
    const actionKind = tahliaSocialActionKind(action, data);
    const payload = {
        ...(action.payload || {}),
    };
    if (action.type === 'publish_tahlia_feed_post') {
        const mediaType = cleanSocialText(payload.media_type || 'text', 40) || 'text';
        if (TAHLIA_CARD_MEDIA_TYPES.has(mediaType)) {
            throw new Error('Tahlia media posts do not support a caption');
        } else {
            payload.caption = editedText;
        }
    } else if (action.type === 'publish_tahlia_feed_comment') {
        payload.comment_text = editedText;
    }

    const learning = {
        action_id: actionId || action.id || '',
        action_type: action.type || '',
        action_kind: actionKind,
        original_text: originalText,
        edited_text: editedText,
        edit_reason: editReason,
        edited_at: editedAt,
        source: cleanSocialText(body.source || 'admin_dashboard_tahlia_social', 80),
        activity_type: data.activity_type || payload.activity_type || data.evidence?.activity_type || null,
        story_id: data.target_story_id || payload.story_id || data.evidence?.story_id || null,
        story_author_name: data.target_story_author_name || payload.story_author_name || data.evidence?.story_author_name || null,
        inferred_theme: data.evidence?.inferred_theme || null,
    };
    const history = Array.isArray(data.tahlia_social_edit_history)
        ? data.tahlia_social_edit_history.slice(-19)
        : [];
    const patchedAction = {
        ...action,
        preview: editedText,
        original_preview: action.original_preview || originalText,
        edited_preview: editedText,
        edited_at: editedAt,
        edited_by: learning.source,
        edit_reason: editReason,
        payload,
    };
    const patchedData = {
        ...data,
        original_draft_text: data.original_draft_text || originalText,
        draft_text: editedText,
        was_edited: editedText !== (data.original_draft_text || originalText),
        edit_reason: editReason || data.edit_reason || null,
        tahlia_social_last_edit: learning,
        tahlia_social_edit_history: [...history, learning],
        tahlia_social_learning_updated_at: editedAt,
        proposed_actions: updateAction(data, actionId || action.id, patchedAction),
    };

    return {
        data: patchedData,
        action: patchedAction,
        changed: editedText !== originalText || !!editReason,
        learning,
    };
}

async function resolveTahliaUserForAction({ alert, action }) {
    const payload = action.payload || {};
    const userId = String(payload.user_id || alert.data?.tahlia_user_id || '').trim();
    if (!userId) throw new Error('Tahlia user id missing from action');

    const rows = await supabase(
        `users?select=id,name,email,is_test_account&id=eq.${encodeURIComponent(userId)}&limit=1`
    );
    const user = rows[0] || null;
    if (!user?.id || String(user.email || '').toLowerCase() !== TAHLIA_EMAIL) {
        throw new Error('Tahlia social action can only publish as the seeded Tahlia account');
    }
    if (user.is_test_account) {
        await supabase(`users?id=eq.${encodeURIComponent(user.id)}`, {
            method: 'PATCH',
            body: { is_test_account: false },
            prefer: 'return=minimal',
        });
        user.is_test_account = false;
    }
    return user;
}

function assertTahliaApprovalAlert(alert = {}, action = {}) {
    const data = alert.data || {};
    if (!isTahliaSocialAction(action)) return;
    if (data.subtype !== 'tahlia_social_approval' || data.source !== TAHLIA_SOURCE) {
        throw new Error('This Tahlia action is not from the approval-only social worker');
    }
    if (data.needs_shannon_approval !== true || data.operator_queue !== 'needs_you') {
        throw new Error('Tahlia social action must be approved from Needs You');
    }
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

function brisbaneDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Brisbane',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
}

function dateKeyToUtcNoon(dateKey) {
    return new Date(`${String(dateKey || '').slice(0, 10)}T12:00:00Z`);
}

function formatUtcDateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function addDaysToDateKey(dateKey, days) {
    const date = dateKeyToUtcNoon(dateKey);
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return formatUtcDateKey(date);
}

function dayIndexForDateKey(dateKey) {
    const date = dateKeyToUtcNoon(dateKey);
    if (Number.isNaN(date.getTime())) return 0;
    return (date.getUTCDay() + 6) % 7;
}

function nextDayOnOrAfter(dateKey, targetDay) {
    const targetIndex = DAY_ORDER.indexOf(targetDay);
    if (targetIndex < 0) return dateKey;
    const currentIndex = dayIndexForDateKey(dateKey);
    const offset = (targetIndex - currentIndex + 7) % 7;
    return addDaysToDateKey(dateKey, offset);
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

async function performSetProgramWeek({ alert, action }) {
    const clientId = await resolveClientId(alert);
    if (!clientId) throw new Error('No linked client account for this action');

    const program = await loadActiveProgram(clientId);
    const targetWeek = Math.max(1, Math.min(Number(action.payload?.target_week || 1) || 1, 16));
    const targetDay = DAY_ORDER.includes(action.payload?.target_day)
        ? action.payload.target_day
        : (DAY_ORDER.includes(action.payload?.day) ? action.payload.day : '');
    const todayKey = brisbaneDateKey();
    const targetWeekStartsOn = nextDayOnOrAfter(todayKey, targetDay);
    const startDate = addDaysToDateKey(targetWeekStartsOn, -7 * (targetWeek - 1));
    const updatedAt = new Date().toISOString();

    await supabase(`custom_workout_programs?id=eq.${encodeURIComponent(program.id)}`, {
        method: 'PATCH',
        body: {
            start_date: startDate,
            updated_at: updatedAt,
        },
        prefer: 'return=minimal',
    });

    return {
        program_id: program.id,
        program_name: program.program_name,
        previous_start_date: program.start_date || null,
        start_date: startDate,
        target_week: targetWeek,
        target_week_starts_on: targetWeekStartsOn,
        target_day: targetDay || null,
        updated_at: updatedAt,
        summary: targetDay
            ? `Set active program so week ${targetWeek} starts ${targetDay} (${targetWeekStartsOn}).`
            : `Set active program to week ${targetWeek} from ${targetWeekStartsOn}.`,
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

async function performPublishTahliaFeedPost({ alert, action }) {
    assertTahliaApprovalAlert(alert, action);
    const tahlia = await resolveTahliaUserForAction({ alert, action });
    const payload = action.payload || {};
    const mediaType = cleanSocialText(payload.media_type || 'text', 40) || 'text';
    const activityType = cleanSocialText(payload.activity_type || alert.data?.activity_type || alert.data?.evidence?.activity_type || '', 40);
    if (!isAllowedTahliaPostActivityType(activityType)) {
        throw new Error('Tahlia can only publish workout, PB, or check-in posts');
    }
    if (payload.media_url || payload.thumbnail_url) {
        throw new Error('Tahlia Feed posts must not include generated media');
    }

    let caption = '';
    if (mediaType === 'text') {
        caption = cleanSocialText(payload.caption || alert.data?.draft_text || '', 500);
        if (caption.length < 3) throw new Error('Tahlia post caption is empty');
    } else if (TAHLIA_CARD_MEDIA_TYPES.has(mediaType)) {
        caption = normalizedTahliaCardCaption({ payload, activityType });
    } else {
        throw new Error('Tahlia Feed post type is not allowed');
    }
    const backgroundColor = cleanSocialText(payload.background_color || '#f8fafc', 24) || '#f8fafc';
    const proposedCreatedAt = normalizeTahliaProposedCreatedAt(
        payload.proposed_created_at || alert.data?.evidence?.source_created_at || alert.data?.drafted_at
    );
    const summaryText = cleanSocialText(action.preview || alert.data?.draft_text || tahliaCardPublicText(parseTahliaCardPayload(caption)) || caption, 120);
    const recentCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const existing = await supabase(
        `stories?select=id,created_at&user_id=eq.${encodeURIComponent(tahlia.id)}&caption=eq.${encodeURIComponent(caption)}&created_at=gte.${encodeURIComponent(recentCutoff)}&limit=1`
    ).catch(() => []);
    if (existing[0]?.id) {
        return {
            story_id: existing[0].id,
            duplicate: true,
            summary: 'Tahlia Feed post already existed, no duplicate published.',
        };
    }

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await supabase('stories', {
        method: 'POST',
        body: [{
            user_id: tahlia.id,
            media_type: mediaType,
            media_url: '',
            thumbnail_url: null,
            caption,
            duration: 5,
            background_color: mediaType === 'text' ? backgroundColor : null,
            created_at: proposedCreatedAt,
            expires_at: expiresAt,
        }],
        prefer: 'return=representation',
    });
    const story = rows[0] || null;
    return {
        story_id: story?.id || null,
        summary: `Published Tahlia Feed post: ${summaryText}`,
    };
}

async function performPublishTahliaFeedComment({ alert, action }) {
    assertTahliaApprovalAlert(alert, action);
    const tahlia = await resolveTahliaUserForAction({ alert, action });
    const payload = action.payload || {};
    const storyId = String(payload.story_id || alert.data?.target_story_id || '').trim();
    const commentText = cleanSocialText(payload.comment_text || alert.data?.draft_text || '', 500);
    const proposedCreatedAt = normalizeTahliaProposedCreatedAt(
        payload.proposed_created_at || alert.data?.drafted_at
    );
    if (!storyId) throw new Error('Target story missing from Tahlia comment action');
    if (commentText.length < 2) throw new Error('Tahlia comment is empty');

    const stories = await supabase(
        `stories?select=id,user_id,created_at&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&id=eq.${encodeURIComponent(storyId)}&limit=1`
    );
    const story = stories[0] || null;
    if (!story?.id) throw new Error('Target Feed post no longer exists');
    if (story.user_id === tahlia.id) throw new Error('Tahlia cannot comment on her own Feed post');

    const existing = await supabase(
        `feed_comments?select=id&story_id=eq.${encodeURIComponent(storyId)}&user_id=eq.${encodeURIComponent(tahlia.id)}&limit=1`
    ).catch(() => []);
    if (existing[0]?.id) {
        return {
            comment_id: existing[0].id,
            duplicate: true,
            summary: 'Tahlia already commented on this Feed post, no duplicate published.',
        };
    }

    const rows = await supabase('feed_comments', {
        method: 'POST',
        body: [{
            story_id: storyId,
            user_id: tahlia.id,
            comment_text: commentText,
            created_at: proposedCreatedAt,
        }],
        prefer: 'return=representation',
    });
    const comment = rows[0] || null;
    return {
        comment_id: comment?.id || null,
        story_id: storyId,
        summary: `Published Tahlia comment: ${commentText.slice(0, 120)}`,
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

function coachActionReceiptTitle(alert, action) {
    const clientName = alert.client_name || 'Client';
    if (action.type === 'set_program_week') return `${clientName}: program week updated`;
    if (action.type === 'move_workout_days') return `${clientName}: workout days updated`;
    if (action.type === 'edit_workout_exercises') return `${clientName}: workout updated`;
    if (action.type === 'regenerate_workout_program') return `${clientName}: program regenerated`;
    return `${clientName}: coach action completed`;
}

async function insertNeedsYouActionReceipt({ alert, action, result, completedAt }) {
    if (isTahliaSocialAction(action)) return;

    const idempotencyKey = `coach_action_receipt:${alert.id}:${action.id}`;
    const existing = await supabase(
        `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
    ).catch(() => []);
    if (existing?.length) return;

    const summary = result.summary || `${action.label || action.type || 'Coach action'} completed.`;
    await supabase('coach_alerts', {
        method: 'POST',
        body: [{
            alert_type: 'general_idea',
            client_id: alert.client_id || null,
            client_name: alert.client_name || null,
            coach_id: alert.coach_id || null,
            title: coachActionReceiptTitle(alert, action),
            description: summary,
            priority: 'medium',
            status: 'pending',
            idempotency_key: idempotencyKey,
            data: {
                subtype: 'coach_action_receipt',
                operator_queue: 'needs_you',
                needs_you_required: true,
                needs_you_reason: 'coach_action_completed',
                source_alert_id: alert.id,
                source_action_id: action.id,
                action_type: action.type,
                action_label: action.label || '',
                completed_at: completedAt,
                result: {
                    summary,
                    program_id: result.program_id,
                    program_name: result.program_name,
                    previous_start_date: result.previous_start_date,
                    start_date: result.start_date,
                    target_week: result.target_week,
                    target_week_starts_on: result.target_week_starts_on,
                    target_day: result.target_day,
                },
            },
        }],
        prefer: 'return=minimal',
    });
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
            `coach_alerts?select=id,alert_type,client_id,client_name,coach_id,status,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
        );
        alert = rows[0] || null;
    } catch (e) {
        console.error('[perform-coach-action] alert lookup failed:', e.message);
        return json(500, { error: 'Alert lookup failed' });
    }
    if (!alert) return json(404, { error: 'Alert not found' });

    let data = alert.data || {};
    let action = findAction(data, actionId);
    if (!action) return json(404, { error: 'Action not found' });
    if (action.status === 'completed') return json(409, { error: 'Action already completed', action });
    if (action.status && action.status !== 'pending') return json(409, { error: `Action is ${action.status}`, action });

    if (isTahliaSocialAction(action)) {
        const user = await authenticatedUser(event).catch(() => null);
        if (!user?.id) return json(401, { error: 'Authentication required' });
        if (!SHANNON_FEED_REVIEW_USER_IDS.has(String(user.id || ''))) {
            return json(403, { error: 'Tahlia Feed approvals are private' });
        }
        if (alert.status !== 'pending') {
            return json(409, { error: `Tahlia approval is ${alert.status || 'not pending'}` });
        }
    }

    let editResult;
    try {
        editResult = applyTahliaSocialEditFromRequest({ data, action, actionId, body });
        data = editResult.data;
        action = editResult.action;
    } catch (e) {
        return json(400, { error: e.message || 'Tahlia edit could not be applied' });
    }

    if (body.saveOnly === true) {
        if (!isTahliaSocialAction(action)) {
            return json(400, { error: 'Save-only editing is limited to Tahlia Feed approvals' });
        }
        if (!Object.prototype.hasOwnProperty.call(body, 'editedText')) {
            return json(400, { error: 'Edited text is required' });
        }
        const savedAt = new Date().toISOString();
        const savedData = {
            ...data,
            tahlia_social_edit_saved_at: savedAt,
            tahlia_social_learning_pending: true,
        };
        try {
            await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
                method: 'PATCH',
                body: { data: savedData },
                prefer: 'return=minimal',
            });
        } catch (e) {
            return json(500, { error: 'Tahlia edit could not be saved', details: e.message });
        }
        return json(200, {
            ok: true,
            saved: true,
            changed: !!editResult?.changed,
            saved_at: savedAt,
            action: findAction(savedData, actionId),
            data: savedData,
        });
    }

    let result;
    try {
        if (action.type === 'move_workout_days') {
            result = await performMoveWorkoutDays({ alert, action });
        } else if (action.type === 'edit_workout_exercises') {
            result = await performEditWorkoutExercises({ alert, action });
        } else if (action.type === 'set_program_week') {
            result = await performSetProgramWeek({ alert, action });
        } else if (action.type === 'regenerate_workout_program') {
            result = await performRegenerateWorkoutProgram({ alert, action });
        } else if (action.type === 'publish_tahlia_feed_post') {
            result = await performPublishTahliaFeedPost({ alert, action });
        } else if (action.type === 'publish_tahlia_feed_comment') {
            result = await performPublishTahliaFeedComment({ alert, action });
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
    const publishedText = isTahliaSocialAction(action)
        ? cleanSocialText(tahliaSocialActionText(action, data), 500)
        : '';
    const nextData = {
        ...data,
        ...(isTahliaSocialAction(action) ? {
            draft_text: data.original_draft_text || data.draft_text || publishedText,
            edited_draft_text: publishedText,
            sent_message: publishedText,
            was_edited: !!data.original_draft_text && cleanSocialText(data.original_draft_text, 500) !== publishedText,
            tahlia_social_learning_pending: false,
            tahlia_social_published_text: publishedText,
        } : {}),
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
                previous_start_date: result.previous_start_date,
                start_date: result.start_date,
                target_week: result.target_week,
                target_week_starts_on: result.target_week_starts_on,
            },
        }),
        last_coach_action_result: {
            action_id: actionId,
            type: action.type,
            completed_at: completedAt,
            summary: result.summary,
            previous_start_date: result.previous_start_date,
            start_date: result.start_date,
            target_week: result.target_week,
            target_week_starts_on: result.target_week_starts_on,
        },
    };

    try {
        const alertPatch = { data: nextData };
        if (isTahliaSocialAction(action)) {
            alertPatch.status = 'sent';
            alertPatch.actioned_at = completedAt;
        }
        await supabase(`coach_alerts?id=eq.${encodeURIComponent(alertId)}`, {
            method: 'PATCH',
            body: alertPatch,
            prefer: 'return=minimal',
        });
    } catch (e) {
        return json(500, { error: 'Action completed but alert update failed', details: e.message, result });
    }

    await insertNeedsYouActionReceipt({ alert: { ...alert, data: nextData }, action, result, completedAt })
        .catch(e => console.warn('[perform-coach-action] receipt insert failed:', e.message));

    if (!isTahliaSocialAction(action)) {
        await sendDonePush({ alert: { ...alert, data: nextData }, result });
    }
    return json(200, { ok: true, action: findAction(nextData, actionId), data: nextData, result });
};

exports._test = {
    applyTahliaSocialEditFromRequest,
    cleanSocialText,
    isAllowedTahliaPostActivityType,
    normalizeTahliaProposedCreatedAt,
    normalizedTahliaCardCaption,
    isTahliaSocialAction,
    stripTahliaMediaPostCopy,
    tahliaSocialActionText,
};
