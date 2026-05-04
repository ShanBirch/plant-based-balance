/**
 * widget-coach-feed — feed endpoint for the Android home-screen "Coach Inbox"
 * widget.
 *
 * The widget runs in the app's process but outside the WebView, so it has no
 * Supabase JS client and no auth JWT. We can't ship the service-role key in
 * the APK either. So the auth model is:
 *
 *   1. Widget reads the device's FCM token from SharedPreferences (the
 *      messaging service stamps it on every onNewToken / onMessageReceived).
 *   2. Widget POSTs the token here.
 *   3. We look up push_subscriptions WHERE auth = token, get the user_id.
 *   4. Verify they're an admin/coach.
 *   5. Return their pending + scheduled alerts.
 *
 * The FCM token is device-scoped, never exposed in any public API, and can
 * only be read by the app itself — it's effectively as secret as the app's
 * install. Same trust posture as the FCM token already gives us for the
 * inline-reply path (push_subscriptions → who to notify).
 *
 * Returns at most LIMIT alerts that have a draft to act on, oldest scheduled
 * first then newest pending. Layout is intentionally lean — the widget shows
 * client name + 1-2 lines of draft preview + scheduled-for tag, nothing more.
 *
 * Request body:
 *   { fcmToken: string }
 *
 * Response:
 *   {
 *     ok: true,
 *     alerts: [
 *       {
 *         id, clientName, alertType, status,
 *         draftPreview, scheduledFor (or null),
 *         createdAt, hasDraft, channelLabel
 *       }, ...
 *     ],
 *     activeCount, scheduledCount
 *   }
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const LIMIT = 12;        // hard cap on alerts returned to the widget
const PREVIEW_CHARS = 140;
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

async function supabase(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} -> ${res.status} ${text}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

function truncate(s, n) {
    if (!s) return '';
    s = String(s);
    return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const fcmToken = (body.fcmToken || '').trim();
    if (!fcmToken) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing fcmToken' }) };
    }

    // 1. Resolve token -> user. push_subscriptions stores native FCM tokens
    //    in the `auth` column when endpoint starts with native:// (see
    //    register_push_subscription RPC). Multiple rows can exist for the
    //    same token across reinstalls — use the most recent.
    let user;
    try {
        const subs = await supabase(
            `push_subscriptions?select=user_id,updated_at&auth=eq.${encodeURIComponent(fcmToken)}&order=updated_at.desc.nullslast&limit=1`
        );
        user = subs[0];
    } catch (e) {
        console.error('[widget-feed] subscription lookup failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Lookup failed' }) };
    }
    if (!user || !user.user_id) {
        // Not a logged-in / registered device. Common on fresh installs
        // before the app has registered its FCM token. The widget shows a
        // friendly "Sign in to load" empty state.
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, alerts: [], activeCount: 0, scheduledCount: 0, hint: 'unregistered_token' }),
        };
    }
    const coachId = user.user_id;

    // 2. Coach gate — only admins should ever see this feed. Same gate
    //    instant-coach-draft uses to decide whether to draft at all.
    try {
        const users = await supabase(`users?select=email&id=eq.${coachId}&limit=1`);
        const email = String(users[0]?.email || '').trim().toLowerCase();
        if (email !== BALANCE_ADMIN_EMAIL) {
            return {
                statusCode: 200,
                body: JSON.stringify({ ok: true, alerts: [], activeCount: 0, scheduledCount: 0, hint: 'not_admin' }),
            };
        }
    } catch (e) {
        console.error('[widget-feed] admin check failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Admin check failed' }) };
    }

    // 3. Pull the live feed: pending + scheduled. We sort client-side
    //    after fetch because we want scheduled rows pinned to the TOP
    //    (sorted by scheduled_for ascending — soonest fire first), then
    //    pending rows below (sorted by created_at descending — newest
    //    first). PostgREST can't easily mix ordering directions across
    //    a status partition, so we just fetch unordered and re-sort.
    let alerts = [];
    try {
        alerts = await supabase(
            `coach_alerts?select=id,client_id,client_name,alert_type,status,suggested_message,created_at,scheduled_for,scheduled_reply_text,data&coach_id=eq.${coachId}&status=in.(pending,scheduled)&limit=${LIMIT}`
        );
    } catch (e) {
        console.error('[widget-feed] alert query failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Alert query failed' }) };
    }
    alerts.sort((a, b) => {
        // Scheduled rows always before pending rows.
        if (a.status === 'scheduled' && b.status !== 'scheduled') return -1;
        if (b.status === 'scheduled' && a.status !== 'scheduled') return 1;
        if (a.status === 'scheduled') {
            // Both scheduled: soonest fire first.
            const ta = Date.parse(a.scheduled_for || '') || 0;
            const tb = Date.parse(b.scheduled_for || '') || 0;
            return ta - tb;
        }
        // Both pending: newest first.
        const ta = Date.parse(a.created_at || '') || 0;
        const tb = Date.parse(b.created_at || '') || 0;
        return tb - ta;
    });

    // 4. Reshape to the lean fields the widget actually renders. Strip
    //    photo-marker URLs from the preview (they read as raw URLs in the
    //    tiny widget bubble — bad UX). Prefer scheduled_reply_text on
    //    scheduled rows so Shannon sees the exact text that's about to fire,
    //    not the original AI draft if he edited before scheduling.
    const stripPhotoMarkers = s => String(s || '').replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, '📷 photo');
    let activeCount = 0;
    let scheduledCount = 0;
    const trimmed = alerts.map(a => {
        const isScheduled = a.status === 'scheduled';
        if (isScheduled) scheduledCount++; else activeCount++;
        const draftSource = isScheduled
            ? (a.scheduled_reply_text || a.suggested_message)
            : a.suggested_message;
        const draftPreview = truncate(stripPhotoMarkers(draftSource), PREVIEW_CHARS);
        const channelLabel =
            a.data?.channel === 'instagram' ? 'IG' :
            a.data?.channel === 'messenger' ? 'FB' :
            null;
        return {
            id: a.id,
            clientName: a.client_name || 'Client',
            alertType: a.alert_type,
            status: a.status,
            hasDraft: !!draftSource && draftSource.trim().length > 0,
            draftPreview,
            scheduledFor: a.scheduled_for || null,
            createdAt: a.created_at,
            channelLabel,
        };
    });

    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            alerts: trimmed,
            activeCount,
            scheduledCount,
        }),
    };
};
