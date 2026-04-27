/**
 * log-lp-event
 *
 * Server-side landing-page analytics endpoint. Receives event payloads from
 * the LP tracker JS and writes them to `lp_events`. Always returns 200 fast
 * so the tracker is fire-and-forget.
 */

const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_EVENT_TYPES = new Set(['page_view', 'scroll', 'click', 'time_on_page']);
const MAX_STR = 500;

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
}

function trim(value, max = MAX_STR) {
    if (value === null || value === undefined) return null;
    const s = String(value);
    return s.length > max ? s.slice(0, max) : s;
}

function intOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders(), body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_SERVICE_KEY) {
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, skipped: 'no_service_key' }) };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, skipped: 'bad_json' }) };
    }

    // Accept a batch of events or a single event.
    const events = Array.isArray(payload.events) ? payload.events : [payload];
    const rows = [];
    for (const e of events) {
        if (!e || !ALLOWED_EVENT_TYPES.has(e.event_type)) continue;
        if (!e.session_id || !e.landing_page) continue;
        rows.push({
            session_id: trim(e.session_id, 64),
            landing_page: trim(e.landing_page, 64),
            event_type: trim(e.event_type, 32),
            target: trim(e.target, 200),
            target_text: trim(e.target_text, 200),
            scroll_depth: intOrNull(e.scroll_depth),
            duration_ms: intOrNull(e.duration_ms),
            viewport_w: intOrNull(e.viewport_w),
            viewport_h: intOrNull(e.viewport_h),
            click_x: intOrNull(e.click_x),
            click_y: intOrNull(e.click_y),
            utm_source: trim(e.utm_source, 128),
            utm_medium: trim(e.utm_medium, 128),
            utm_campaign: trim(e.utm_campaign, 128),
            referrer: trim(e.referrer, 500),
            user_agent: trim(e.user_agent, 200),
        });
    }
    if (rows.length === 0) {
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, inserted: 0 }) };
    }

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/lp_events`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify(rows),
        });
        if (!res.ok) {
            const text = await res.text();
            console.error('[log-lp-event] insert failed', res.status, text);
        }
    } catch (err) {
        console.error('[log-lp-event] error', err && err.message);
    }
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, inserted: rows.length }) };
};
