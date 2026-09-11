const { VERSION, normalize } = require('../../lib/onboarding-funnel');
const { verifyMetaAppPreviewRef } = require('./_lib/meta-app-preview-ref');
const ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
function config() {
    return { url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY };
}
async function request(path, options = {}) {
    const { url, key } = config();
    const res = await fetch(url + path, { ...options, headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', ...options.headers } });
    const payload = await res.json().catch(() => null);
    if (!res.ok) { const error = new Error('database_unavailable'); error.code = payload?.code; error.status = res.status; throw error; }
    return payload;
}
async function userFor(event) {
    const auth = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === 'authorization')?.[1];
    if (!auth) return null;
    if (!/^Bearer [^\s]+$/i.test(auth)) throw Object.assign(new Error('invalid_session'), { status: 401 });
    try { return await request('/auth/v1/user', { headers: { Authorization: auth } }); }
    catch (_) { throw Object.assign(new Error('invalid_session'), { status: 401 }); }
}
async function save(event, user) {
    if ((event.body || '').length > 12000) return json(413, { error: 'Event too large' });
    let raw;
    try { raw = JSON.parse(event.body || '{}'); } catch (_) { return json(400, { error: 'Invalid event' }); }
    const data = normalize(raw);
    if (!data) return json(400, { error: 'Invalid event' });
    let testAccount = false;
    if (user) {
        const profiles = await request('/rest/v1/users?select=is_test_account&id=eq.' + encodeURIComponent(user.id));
        testAccount = profiles?.[0]?.is_test_account === true || String(user.email || '').toLowerCase() === ADMIN_EMAIL;
    }
    let verifiedAd = null;
    let threadId = null;
    const ref = verifyMetaAppPreviewRef(data.meta_ref);
    if (ref) {
        const threads = await request('/rest/v1/ig_threads?select=id,custom_data&id=eq.' + encodeURIComponent(ref.threadId));
        const custom = threads?.[0]?.custom_data || {};
        const ad = custom.meta_ad_attribution || {};
        threadId = threads?.[0]?.id || null;
        if (ad.ad_id && ad.source === 'meta_ads') {
            verifiedAd = { utm_source: 'meta', utm_medium: 'paid_social' };
            ['ad_id', 'adset_id', 'campaign_id', 'creative_id'].forEach(key => { if (ad[key]) verifiedAd[key] = String(ad[key]).slice(0,128); });
            if (!data.last_touch.utm_campaign && ad.campaign_id) verifiedAd.utm_campaign = String(ad.campaign_id).slice(0,128);
        }
        if (custom.internal_test_auto_reply_enabled === true || custom.internal_test_conversation_reset_at) testAccount = true;
    }
    const lastTouch = { ...data.last_touch, ...verifiedAd };
    const row = {
        event_id: data.event_id, visitor_id: data.visitor_id, session_id: data.session_id,
        event_type: 'onboarding_progress', landing_page: 'onboarding', page_variant: VERSION,
        duration_ms: Math.round(data.duration_ms),
        utm_source: lastTouch.utm_source || null, utm_medium: lastTouch.utm_medium || null,
        utm_campaign: lastTouch.utm_campaign || null, utm_content: lastTouch.utm_content || null,
        metadata: { funnel_version: VERSION, phase: data.phase, step: data.step, status: data.status,
            flow: data.flow, mode: data.mode, step_number: data.step_number,
            user_id: user?.id || null, test_mode: data.test_mode || testAccount,
            occurred_at: Math.abs(Date.now() - Date.parse(data.occurred_at)) < 86400000 ? data.occurred_at : new Date().toISOString(),
            first_touch: data.first_touch, last_touch: lastTouch, verified_paid_meta: !!verifiedAd, thread_id: threadId }
    };
    try { await request('/rest/v1/lp_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) }); }
    catch (error) { if (error.code !== '23505') throw error; }
    return json(200, { ok: true });
}

function summarize(rows, now = Date.now(), traffic = 'all') {
    const visitors = new Map();
    const steps = new Map();
    const campaigns = new Map();
    const accountsByVisitor = new Map();
    const testVisitors = new Set(rows.filter(row => row.metadata?.test_mode).map(row => row.visitor_id));
    rows = rows.filter(row => !row.metadata?.test_mode && !testVisitors.has(row.visitor_id));
    const paidVisitors = new Set(rows.filter(row => row.metadata?.verified_paid_meta || /^(paid_social|paid|cpc|ppc)$/i.test(row.metadata?.last_touch?.utm_medium || '')).map(row => row.visitor_id));
    if (traffic === 'paid') rows = rows.filter(row => paidVisitors.has(row.visitor_id));
    rows = rows.map(row => ({ ...row, created_at: row.metadata?.occurred_at || row.created_at })).sort((a,b) => a.created_at.localeCompare(b.created_at));
    rows.forEach(row => {
        if (row.metadata?.user_id) {
            if (!accountsByVisitor.has(row.visitor_id)) accountsByVisitor.set(row.visitor_id, new Set());
            accountsByVisitor.get(row.visitor_id).add(row.metadata.user_id);
        }
    });
    for (const row of rows) {
        const m = row.metadata || {};
        if (m.test_mode) continue;
        const accounts = accountsByVisitor.get(row.visitor_id);
        const identity = m.user_id || (accounts?.size === 1 ? Array.from(accounts)[0] : 'visitor:' + row.visitor_id);
        if (!visitors.has(identity)) visitors.set(identity, { rows: [], first: row, latest: row, complete: false });
        const person = visitors.get(identity);
        person.rows.push(row);
        if (row.created_at < person.first.created_at) person.first = row;
        if (row.created_at > person.latest.created_at) person.latest = row;
        if (m.phase === 'setup' && m.step === 'setup' && m.status === 'completed') person.complete = true;
        const key = [m.flow, m.phase, m.mode, m.step].join(':');
        if (!steps.has(key)) steps.set(key, { key, flow: m.flow, phase: m.phase, mode: m.mode, step: m.step, order: m.step_number || 0, reached: new Set(), completed: new Set(), last: new Set(), times: [] });
        const step = steps.get(key);
        if (m.status === 'viewed' || m.status === 'completed') step.reached.add(identity);
        if (m.status === 'completed') { step.completed.add(identity); if (row.duration_ms > 0) step.times.push(row.duration_ms); }
    }
    let completed = 0, quiet = 0;
    for (const [identity, person] of visitors) {
        const m = person.latest.metadata;
        const key = [m.flow, m.phase, m.mode, m.step].join(':');
        steps.get(key)?.last.add(identity);
        if (person.complete) completed++;
        if (!person.complete && now - Date.parse(person.latest.created_at) >= 86400000) quiet++;
        const attributedEntry = person.rows.find(row => row.metadata.verified_paid_meta) || person.first;
        const source = attributedEntry.utm_source || 'Unattributed';
        const campaign = attributedEntry.utm_campaign || 'Unattributed';
        const ad = attributedEntry.metadata.last_touch?.ad_id || 'Unknown';
        const campaignKey = JSON.stringify([source, campaign, ad]);
        if (!campaigns.has(campaignKey)) campaigns.set(campaignKey, { source, campaign, ad, visitors: 0, completed: 0 });
        const group = campaigns.get(campaignKey); group.visitors++; if (person.complete) group.completed++;
    }
    return {
        visitors: visitors.size, completed, quiet, excluded_test_browsers: testVisitors.size,
        steps: Array.from(steps.values()).map(step => {
            step.times.sort((a, b) => a - b);
            return { ...step, reached: step.reached.size, completed: step.completed.size, last: step.last.size, median_seconds: step.times.length ? Math.round(step.times[Math.floor(step.times.length / 2)] / 1000) : null, times: undefined };
        }).sort((a,b) => a.flow.localeCompare(b.flow) || ['entry','setup','question','screen','tour','task','payment'].indexOf(a.phase) - ['entry','setup','question','screen','tour','task','payment'].indexOf(b.phase) || a.order - b.order || a.step.localeCompare(b.step)),
        campaigns: Array.from(campaigns.values()).sort((a,b) => b.visitors - a.visitors)
    };
}
async function report(event, user) {
    if (!user) return json(401, { error: 'Sign in to view onboarding progress' });
    if (String(user.email || '').toLowerCase() !== ADMIN_EMAIL) return json(403, { error: 'Admin access required' });
    const days = [7,30,90].includes(Number(event.queryStringParameters?.days)) ? Number(event.queryStringParameters.days) : 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const traffic = event.queryStringParameters?.traffic === 'all' ? 'all' : 'paid';
    const rows = [];
    for (let offset = 0; offset < 50000; offset += 1000) {
        const page = await request('/rest/v1/lp_events?select=created_at,visitor_id,metadata,utm_source,utm_campaign,duration_ms&event_type=eq.onboarding_progress&page_variant=eq.' + VERSION + '&created_at=gte.' + encodeURIComponent(since) + '&order=id.asc&limit=1000&offset=' + offset);
        rows.push(...page);
        if (page.length < 1000) return json(200, { ...summarize(rows, Date.now(), traffic), days, since, traffic, version: VERSION, measured_from: rows[0]?.created_at || null });
    }
    return json(422, { error: 'Too many events for this report. Choose a shorter date window.' });
}
exports.handler = async event => {
    if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
    if (!config().url || !config().key) return json(503, { error: 'Progress tracking unavailable' });
    try { const user = await userFor(event); return event.httpMethod === 'GET' ? await report(event, user) : await save(event, user); }
    catch (error) { return json(error.status === 401 ? 401 : 503, { error: error.status === 401 ? 'Sign in again' : 'Progress tracking temporarily unavailable' }); }
};
exports.summarize = summarize;
