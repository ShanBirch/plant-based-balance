const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clean = (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
function monday(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw fail('Choose the Monday of the review week.');
    const d = new Date(value + 'T12:00:00Z');
    if (Number.isNaN(+d) || d.toISOString().slice(0, 10) !== value || d.getUTCDay() !== 1) throw fail('Choose the Monday of the review week.');
    return value;
}
function shift(value, days) {
    const d = new Date(value + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
function currentWeek(now = new Date()) {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const day = new Date(date + 'T12:00:00Z').getUTCDay();
    return shift(date, -((day + 6) % 7));
}
function validatePayload(input) {
    const entries = input?.entries;
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 40) throw fail('Add between 1 and 40 exercise rows.');
    const result = { title: clean(input.title, 100) || 'Your weekly progress', note: clean(input.note, 3000),
        sessions: clean(input.sessions, 300), entries: entries.map(row => {
            if (!row || typeof row !== 'object') throw fail('Each row needs an exercise, completed sets and next target.');
            const entry = { exercise: clean(row.exercise, 120), completed: clean(row.completed, 400), next: clean(row.next, 400), note: clean(row.note, 500) };
            if (!entry.exercise || !entry.completed || !entry.next) throw fail('Each row needs an exercise, completed sets and next target.');
            return entry;
        }) };
    return result;
}
// Suggestions are observations + saved targets, never an automatic prescription.
function suggestions(workouts, program, reviewWeek = currentWeek()) {
    const groups = new Map();
    for (const row of workouts) {
        if (row.is_drop_set) continue;
        const key = `${row.workout_date}|${row.template_name || ''}|${row.exercise_name}`;
        if (!groups.has(key)) groups.set(key, new Map());
        const sets = groups.get(key), signature = `${row.set_number}|${row.reps}|${row.weight_kg}`;
        sets.set(signature, row);
    }
    const prescribed = (program?.weekly_schedule || []).flatMap(day => day.workout?.exercises || []);
    return [...groups].slice(0, 40).map(([key, rows]) => {
        const values = [...rows.values()].sort((a, b) => a.set_number - b.set_number), first = values[0];
        const ex = prescribed.find(e => e.name === first.exercise_name);
        const start = program?.start_date;
        const startMonday = start && /^\d{4}-\d{2}-\d{2}$/.test(start)
            ? shift(start, -((new Date(start + 'T12:00:00Z').getUTCDay() + 6) % 7)) : null;
        const nextWeek = startMonday ? Math.floor((Date.parse(shift(reviewWeek, 7)) - Date.parse(startMonday)) / (7 * 86400000)) + 1 : null;
        const next = ex?.weeklyPlan?.find(w => Number(w.week) === nextWeek);
        const targetReps = next?.reps ?? ex?.reps, kg = next?.weightKg ?? ex?.prescribedWeightKg ?? ex?.weight_kg ?? ex?.weight;
        return { exercise: first.exercise_name,
            completed: `${first.workout_date}: ` + values.map(r => `${r.weight_kg || 'unrecorded'} kg × ${r.reps || r.time_duration || 'unrecorded'}`).join('; '),
            next: ex ? `${next?.totalSets || ex.sets} × ${targetReps}${kg != null ? ` at ${kg} kg` : ' · load to confirm'}` : 'Coach to confirm',
            note: 'Review equipment, warm-ups, working sets and symptoms before saving.' };
    });
}
function makeHandler({ query, authenticate }) {
    return async event => {
        const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }, body: JSON.stringify(body) });
        if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
        try {
            const actor = await authenticate(event);
            if (!actor || !uuid.test(actor)) return json(401, { error: 'Please sign in again.' });
            if (event.body?.length > 60000) throw fail('Progress card is too large.');
            const input = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : event.queryStringParameters || {};
            const peer = input.peer_id;
            if (!uuid.test(peer || '') || peer === actor) throw fail('Choose a coaching conversation.');
            const [asCoach, asClient] = await Promise.all([
                query(`coach_clients?select=id&coach_id=eq.${actor}&client_id=eq.${peer}&status=eq.active&limit=1`),
                query(`coach_clients?select=id&coach_id=eq.${peer}&client_id=eq.${actor}&status=eq.active&limit=1`)
            ]);
            if (!asCoach.length && !asClient.length) {
                // Delivered snapshots remain private to their two participants,
                // even after coaching ends. This never grants management access.
                if (event.httpMethod === 'GET') {
                    const records = await query(`coach_weekly_progress?select=*&or=(and(coach_id.eq.${actor},client_id.eq.${peer}),and(coach_id.eq.${peer},client_id.eq.${actor}))&message_id=not.is.null&order=created_at.desc&limit=100`);
                    if (records.length) return json(200, { can_manage: false, records });
                }
                throw fail('This coaching conversation is unavailable.', 403);
            }
            const canManage = asCoach.length > 0, client = canManage ? peer : actor, coach = canManage ? actor : peer;
            const scope = `coach_id=eq.${coach}&client_id=eq.${client}`;
            if (event.httpMethod === 'GET') {
                const records = await query(`coach_weekly_progress?select=*&${scope}${canManage ? '' : '&message_id=not.is.null'}&order=created_at.desc&limit=100`);
                if (!canManage || input.suggestions !== '1') return json(200, { can_manage: canManage, records });
                const week = monday(input.week_start || currentWeek());
                const [workouts, programs, people] = await Promise.all([
                    query(`workouts?select=workout_date,template_name,exercise_name,set_number,reps,weight_kg,time_duration,is_drop_set&user_id=eq.${client}&is_current_workout=eq.false&workout_date=gte.${week}&workout_date=lte.${shift(week, 6)}&order=workout_date.asc,set_number.asc&limit=1500`),
                    query(`custom_workout_programs?select=weekly_schedule,start_date&user_id=eq.${client}&is_active=eq.true&order=updated_at.desc&limit=1`),
                    query(`users?select=name&id=eq.${client}&limit=1`)
                ]);
                const sessions = new Set(workouts.map(r => `${r.workout_date}|${r.template_name || ''}`)).size;
                const name = clean(people[0]?.name, 70).split(/\s+/)[0];
                return json(200, { can_manage: true, records, week_start: week, suggestion: { title: name ? `${name}’s weekly progress` : 'Your weekly progress', sessions: `${sessions} session${sessions === 1 ? '' : 's'} logged in the review window`, note: '', entries: suggestions(workouts, programs[0], week) } });
            }
            if (!canManage) throw fail('Only the assigned coach can attach a progress card.', 403);
            if (input.operation === 'save') {
                const week = monday(input.week_start), payload = validatePayload(input.payload);
                if (uuid.test(input.id || '')) {
                    const existing = await query(`coach_weekly_progress?select=*&id=eq.${input.id}&${scope}&limit=1`);
                    if (existing[0]) return json(200, { record: existing[0] }); // idempotent retry
                } else throw fail('A progress card ID is required.');
                const rows = await query('coach_weekly_progress', { method: 'POST', body: { id: input.id, coach_id: coach, client_id: client, week_start: week, payload } });
                if (!rows[0]) throw fail('The card could not be saved.', 500);
                return json(200, { record: rows[0] });
            }
            if (input.operation === 'attach') {
                if (!uuid.test(input.id || '') || !uuid.test(input.message_id || '')) throw fail('Choose a saved card and check-in message.');
                const [records, messages] = await Promise.all([
                    query(`coach_weekly_progress?select=*&id=eq.${input.id}&${scope}&limit=1`),
                    query(`nudges?select=id&sender_id=eq.${coach}&receiver_id=eq.${client}&id=eq.${input.message_id}&limit=1`)
                ]);
                if (!records[0] || !messages[0]) throw fail('That card or message is unavailable.', 404);
                if (records[0].message_id === input.message_id) return json(200, { record: records[0] });
                if (records[0].message_id) throw fail('This card is already attached to a check-in.', 409);
                const rows = await query(`coach_weekly_progress?id=eq.${input.id}&${scope}&message_id=is.null`, { method: 'PATCH', body: { message_id: input.message_id } });
                if (!rows[0]) throw fail('The attachment changed. Reopen the conversation.', 409);
                return json(200, { record: rows[0] });
            }
            throw fail('Choose save or attach.');
        } catch (error) {
            if (error instanceof SyntaxError) return json(400, { error: 'Invalid progress card.' });
            return json(error.status || 500, { error: error.status ? error.message : 'Progress could not be loaded. Please try again.' });
        }
    };
}
module.exports = { makeHandler, validatePayload, monday, currentWeek, shift, suggestions };
