const crypto = require('crypto');
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
function object(value) { if (typeof value === 'string') { try { return JSON.parse(value) || {}; } catch (_) { return {}; } } return value && typeof value === 'object' ? value : {}; }
function order(value) { return Array.isArray(value) && value.length === 7 && value.every(Number.isInteger) && new Set(value).size === 7 && value.every(n => n >= 0 && n < 7) ? value : [0,1,2,3,4,5,6]; }
function weekKey(now = new Date()) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const date = new Date(key + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    return date.toISOString().slice(0,10);
}
function nextWeek(now) { const date = new Date(weekKey(now) + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+7); return date.toISOString().slice(0,10); }
function describe(program, facts, now = new Date()) {
    const extra = object(facts?.additional_data), personal = object(facts?.personal_details);
    const base = order(extra.workout_day_order);
    let schedule;
    if (program?.is_active && Array.isArray(program.weekly_schedule)) {
        if (program.weekly_schedule.length !== 7 || !program.weekly_schedule.every((item,i) => item.day === DAYS[i])) return {available:false, reason:'Your coach needs to check your workout calendar before days can be moved here.'};
        schedule = DAYS.map(day => program.weekly_schedule.find(item => item.day === day)?.workout || {type:'rest'});
    } else {
        const calendar = object(personal.workout_calendar);
        if (!KEYS.some(key => calendar[key])) return { available: false, reason: 'Your workout plan needs to be saved before you can choose days here.' };
        schedule = KEYS.map(key => ({ type: calendar[key] && calendar[key] !== 'rest' ? 'workout' : 'rest', name: calendar[key] }));
    }
    const start = nextWeek(now);
    const end = new Date(start + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate()+6);
    // Dated or live appointments must keep their assigned days.
    const fixed = base.map((source, index) => schedule[source]?.type === 'activity' || schedule[source]?.availableFrom || schedule[source]?.availableUntil ? index : -1).filter(n => n >= 0);
    const sources = base.filter((source, index) => !fixed.includes(index) && schedule[source] && schedule[source].type !== 'rest');
    if (!sources.length) return { available: false, reason: 'There are no flexible workout sessions to move in your current plan.' };
    const signature = crypto.createHash('sha256').update(JSON.stringify({ program: program?.id || null, schedule, base })).digest('hex');
    const saved = object(extra.weekly_workout_day_orders)[start];
    const selectedOrder = saved?.signature === signature ? order(saved.order) : base;
    return { available: true, week_start: start, week_end: end.toISOString().slice(0,10), count: sources.length,
        days: DAYS.filter((day,index) => sources.includes(selectedOrder[index])), locked_days: fixed.map(index => DAYS[index]), signature,
        base_order: base, sources, program_id: program?.id || null, program_revision: program?.updated_at || null };
}
function selection(plan, input) {
    if (!plan.available) throw new Error(plan.reason || 'Your workout plan is unavailable.');
    if (input?.signature !== plan.signature || input?.week_start !== plan.week_start) throw new Error('Your workout plan changed. Reopen the check-in to load your latest days.');
    const days = input?.days;
    if (!Array.isArray(days) || days.length !== plan.count || new Set(days).size !== days.length || days.some(day => !DAYS.includes(day) || plan.locked_days.includes(day))) throw new Error('Choose exactly ' + plan.count + ' available workout days.');
    const sorted = DAYS.filter(day => days.includes(day));
    const mapped = new Array(7);
    plan.locked_days.forEach(day => { const i = DAYS.indexOf(day); mapped[i] = plan.base_order[i]; });
    sorted.forEach((day,i) => { mapped[DAYS.indexOf(day)] = plan.sources[i]; });
    const used = mapped.filter(Number.isInteger);
    const remaining = plan.base_order.filter(source => !used.includes(source));
    for (let i=0; i<7; i++) if (!Number.isInteger(mapped[i])) mapped[i] = remaining.shift();
    return { week_start: plan.week_start, week_end: plan.week_end, days: sorted, order: mapped, signature: plan.signature, program_id: plan.program_id, program_revision: plan.program_revision };
}
async function load(query, clientId, now) {
    const id = encodeURIComponent(clientId);
    const [programs, rows] = await Promise.all([
        query('custom_workout_programs?select=id,is_active,start_date,duration_weeks,updated_at,weekly_schedule&user_id=eq.'+id+'&is_active=eq.true&order=updated_at.desc&limit=1'),
        query('user_facts?select=user_id,personal_details,additional_data&user_id=eq.'+id+'&limit=1')
    ]);
    return { plan: describe(programs[0], rows[0], now), facts: rows[0] };
}
function publicPlan(plan) { const { base_order, sources, ...visible } = plan; return visible; }
async function save(query, clientId, chosen) {
    // Compare-and-swap prevents overwriting concurrent facts/preferences edits.
    for (let attempt=0; attempt<3; attempt++) {
        const rows = await query('user_facts?select=additional_data,updated_at&user_id=eq.'+encodeURIComponent(clientId)+'&limit=1');
        if (!rows[0]) throw new Error('Your saved workout profile could not be found.');
        const raw = rows[0].additional_data, extra = object(raw);
        const entries = { ...object(extra.weekly_workout_day_orders), [chosen.week_start]: chosen };
        const filter = rows[0].updated_at ? '&updated_at=eq.' + encodeURIComponent(rows[0].updated_at) : raw == null ? '&additional_data=is.null' : '&additional_data=eq.'+encodeURIComponent(JSON.stringify(raw));
        const updated = await query('user_facts?user_id=eq.'+encodeURIComponent(clientId)+filter, { method:'PATCH', body:{ additional_data:{...extra, weekly_workout_day_orders:entries} } });
        if (updated.length) return chosen;
    }
    throw new Error('Your schedule changed while saving. Please try again.');
}
module.exports = { DAYS, order, weekKey, nextWeek, describe, selection, load, publicPlan, save };
