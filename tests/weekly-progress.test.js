const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { makeHandler, validatePayload, monday, currentWeek, suggestions } = require('../netlify/functions/_lib/weekly-progress');
const coach = '00a6605e-8edb-4917-85ba-24a23f179059';
const client = '83661229-aacd-4020-a765-ffdbe500c2da';
const stranger = 'e1403726-19bc-4663-85d4-59b668791a80';
const id = '11111111-1111-4111-8111-111111111111', message = '22222222-2222-4222-8222-222222222222';
const payload = { title: 'Good first week back', sessions: '2 sessions logged', note: 'Same weights.', entries: [{ exercise: 'Bench', completed: '3 × 6 at 80 kg', next: '3 × 8 at 80 kg', note: '' }] };
function fixture() {
    const records = [], writes = [];
    let actor = coach;
    const query = async (path, options = {}) => {
        if (path.startsWith('coach_clients?')) return path.includes(`coach_id=eq.${coach}&client_id=eq.${client}`) ? [{ id: 'assigned' }] : [];
        if (path.startsWith('nudges?')) return path.includes(`sender_id=eq.${coach}&receiver_id=eq.${client}&id=eq.${message}`) ? [{ id: message }] : [];
        if (path.startsWith('coach_weekly_progress')) {
            if (path.includes('&or=')) return [];
            if (options.method === 'POST') { records.push({ ...options.body, created_at: '2026-10-24T00:00:00Z', message_id: null }); writes.push(options); return [records.at(-1)]; }
            const selectedId = path.match(/(?:\?|&)id=eq\.([^&]+)/)?.[1];
            let result = records.filter(r => (!selectedId || selectedId === r.id) && path.includes(`coach_id=eq.${r.coach_id}&client_id=eq.${r.client_id}`));
            if (path.includes('message_id=not.is.null')) result = result.filter(r => r.message_id);
            if (path.includes('message_id=is.null')) result = result.filter(r => !r.message_id);
            if (options.method === 'PATCH') { for (const r of result) Object.assign(r, options.body); writes.push(options); }
            return result;
        }
        if (path.startsWith('workouts?') || path.startsWith('custom_workout_programs?')) return [];
        if (path.startsWith('users?')) return [{ name: 'Shane Minahan' }];
        throw new Error('Unexpected query ' + path);
    };
    const handler = makeHandler({ query, authenticate: async () => actor });
    const call = async (input, method = 'GET') => handler({ httpMethod: method, headers: {}, queryStringParameters: method === 'GET' ? input : {}, body: method === 'POST' ? JSON.stringify(input) : undefined });
    return { call, records, writes, actor: value => { actor = value; } };
}
test('Brisbane review week and exact Monday validation', () => {
    assert.equal(currentWeek(new Date('2026-10-18T14:05:00Z')), '2026-10-19');
    assert.equal(monday('2026-10-19'), '2026-10-19');
    assert.throws(() => monday('2026-10-20'));
    assert.throws(() => monday('2026-02-30'));
    assert.throws(() => validatePayload({ entries: [] }));
    assert.throws(() => validatePayload({ entries: [{ exercise: 'bench' }] }));
});
test('only assigned coach saves, drafts stay hidden from member', async () => {
    const f = fixture();
    assert.equal((await f.call({ operation: 'save', peer_id: client, week_start: '2026-10-19', payload, id }, 'POST')).statusCode, 200);
    assert.equal(f.records.length, 1);
    f.actor(client);
    const read = await f.call({ peer_id: coach });
    assert.deepEqual(JSON.parse(read.body).records, []);
    assert.equal((await f.call({ operation: 'save', peer_id: coach, week_start: '2026-10-19', payload, id }, 'POST')).statusCode, 403);
    f.actor(stranger);
    assert.equal((await f.call({ peer_id: coach })).statusCode, 403);
    assert.equal((await f.call({ peer_id: 'x&coach_id=neq.x' })).statusCode, 400);
    f.actor(null);
    assert.equal((await f.call({ peer_id: client })).statusCode, 401);
});
test('attachment validates exact sent conversation, retry does not duplicate', async () => {
    const f = fixture();
    const save = { operation: 'save', peer_id: client, week_start: '2026-10-19', payload, id };
    await f.call(save, 'POST'); await f.call(save, 'POST');
    assert.equal(f.records.length, 1);
    assert.equal((await f.call({ operation: 'attach', peer_id: client, id, message_id: stranger }, 'POST')).statusCode, 404);
    const attach = { operation: 'attach', peer_id: client, id, message_id: message };
    assert.equal((await f.call(attach, 'POST')).statusCode, 200);
    assert.equal((await f.call(attach, 'POST')).statusCode, 200);
    assert.equal(f.writes.length, 2);
    f.actor(client);
    const read = JSON.parse((await f.call({ peer_id: coach })).body);
    assert.equal(read.records.length, 1); assert.equal(read.records[0].message_id, message);
    assert.equal(read.can_manage, false);
});
test('review suggestions use a simple personalised title and validated week', async () => {
    const f = fixture();
    const result = await f.call({ peer_id: client, suggestions: '1', week_start: '2026-10-19' });
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).suggestion.title, 'Shane’s weekly progress');
    assert.equal((await f.call({ peer_id: client, suggestions: '1', week_start: '2026-10-20' })).statusCode, 400);
});
test('former participants can read only delivered cards without gaining write access', async () => {
    const paths = [];
    const handler = makeHandler({ authenticate: async () => client, query: async path => {
        paths.push(path);
        if (path.startsWith('coach_clients')) return [];
        assert.ok(path.includes(`coach_id.eq.${coach},client_id.eq.${client}`));
        assert.ok(path.includes(`coach_id.eq.${client},client_id.eq.${coach}`));
        assert.ok(path.includes('message_id=not.is.null'));
        return [{ id, coach_id: coach, client_id: client, message_id: message, payload }];
    } });
    const read = await handler({ httpMethod: 'GET', queryStringParameters: { peer_id: coach, suggestions: '1' } });
    assert.equal(read.statusCode, 200);
    assert.equal(JSON.parse(read.body).can_manage, false);
    const write = await handler({ httpMethod: 'POST', body: JSON.stringify({ operation: 'save', peer_id: coach, id, payload, week_start: '2026-10-19' }) });
    assert.equal(write.statusCode, 403);
});
test('a coach can receive an attached card without exposing the sender’s drafts', async () => {
    const handler = makeHandler({ authenticate: async () => coach, query: async path => {
        if (path.startsWith('coach_clients')) return path.includes(`coach_id=eq.${coach}&client_id=eq.${client}`) ? [{ id: 'assigned' }] : [];
        if (path.includes(`coach_id=eq.${client}&client_id=eq.${coach}`)) {
            assert.ok(path.includes('message_id=not.is.null'));
            return [{ id, message_id: message, payload }];
        }
        return [];
    } });
    const result = JSON.parse((await handler({ httpMethod: 'GET', queryStringParameters: { peer_id: client } })).body);
    assert.equal(result.records.length, 1);
    assert.equal(result.records[0].message_id, message);
});
test('suggestions retain mixed loads and missed sets, deduplicate exact duplicate set rows', () => {
    const row = { exercise_name: 'Bench', workout_date: '2026-10-20', template_name: 'Push', set_number: 1, reps: '6', weight_kg: '80' };
    const data = [row, row, { ...row, set_number: 2 }, { ...row, set_number: 3, reps: '5', weight_kg: '75' }, { ...row, set_number: 4, is_drop_set: true }];
    const result = suggestions(data, { weekly_schedule: [{ workout: { exercises: [{ name: 'Bench', sets: 3, reps: '6', prescribedWeightKg: 80 }] } }] });
    assert.equal(result.length, 1);
    assert.equal(result[0].completed, '2026-10-20: 80 kg × 6; 80 kg × 6; 75 kg × 5');
    assert.equal(result[0].next, '3 × 6 at 80 kg');
});
test('immutable snapshots deny direct client database access and lock attached data', () => {
    const sql = fs.readFileSync('supabase/migrations/20261023232633_coach_weekly_progress.sql', 'utf8');
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /revoke all on public.coach_weekly_progress from public,anon,authenticated/i);
    assert.match(sql, /old.message_id is not null/);
    assert.match(sql, /new.payload is distinct from old.payload/);
    assert.match(sql, /n.sender_id=new.coach_id and n.receiver_id=new.client_id/);
});
test('both text and audio messages expose attachment anchors in deployed chat renderer', () => {
    const source = fs.readFileSync('js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js', 'utf8');
    assert.ok((source.match(/data-progress-message-id=/g) || []).length >= 4);
    assert.match(source, /balanceWeeklyProgress.mount\(container, messages, recipientId\)/);
});
test('late progress attachments stay visible at chat bottom without moving someone reading history', async () => {
    const vm = require('node:vm');
    for (const initialTop of [500, 100]) {
        const container = { isConnected: true, scrollHeight: 1000, clientHeight: 500, scrollTop: initialTop,
            querySelectorAll: () => [], querySelector: () => ({ appendChild: () => { container.scrollHeight += 100; } }) };
        const window = { supabaseClient: { auth: { getSession: async () => ({ data: { session: { access_token: 'fixture' } } }) } } };
        const document = { getElementById: () => null, createElement: () => ({ querySelector: () => ({}) }) };
        vm.runInNewContext(fs.readFileSync('lib/weekly-progress.js', 'utf8'), { window, document, URLSearchParams, console,
            fetch: async () => ({ ok: true, json: async () => ({ can_manage: false, records: [{ week_start: '2026-10-19', message_id: message, payload }] }) }) });
        await window.balanceWeeklyProgress.mount(container, [], client);
        assert.equal(container.scrollTop, initialTop === 500 ? 1100 : 100);
    }
});
test('weight reveal compares matching units, keeps original loads and escapes custom text', () => {
    const vm = require('node:vm'), window = {};
    vm.runInNewContext(fs.readFileSync('lib/weekly-progress.js', 'utf8'), { window });
    const render = (completed, next, exercise = 'Bench') => window.balanceWeeklyProgress.cardHtml({ payload: { title: 'Progress', sessions: '', entries: [{ exercise, completed, next }] } });
    const increase = render('SAMPLE · 3 × 15 at 20 kg per dumbbell', '3 × 6 at 22.5 kg per dumbbell');
    assert.match(increase, /wp-old-weight[^>]*>20 kg each/);
    assert.match(increase, /wp-new-weight[^>]*>22.5 kg each/);
    assert.match(increase, /wp-exercise/);
    assert.match(increase, /Replay reveal/);
    assert.doesNotMatch(render('3 × 8 at 20 kg', '3 × 10 at 20 kg'), /Weight increased/);
    assert.doesNotMatch(render('3 × 15 at 20 kg each', '3 × 6 at 30 kg total'), /Weight increased/);
    const mixed = render('20 kg × 15; 18 kg × 12', 'Coach to confirm', '<img src=x>');
    assert.doesNotMatch(mixed, /Weight increased|<img/);
    assert.match(mixed, /&lt;img src=x&gt;/);
    assert.match(mixed, /wp-plain/);
});
