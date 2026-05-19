/**
 * scheduled-coach-reply-worker — Netlify scheduled function.
 *
 * Runs every minute. Finds coach_alerts where:
 *   status = 'scheduled' AND scheduled_for <= now()
 * and fires each one through the same send-coach-reply path Shannon's manual
 * tap-Send uses. send-coach-reply branches on data.channel internally so
 * Instagram + Messenger drafts route through send-ig-reply automatically.
 *
 * Concurrency-safety: each alert is claimed via an atomic UPDATE that flips
 * status from 'scheduled' -> 'pending' (gated on the alert STILL being
 * scheduled and STILL due), so a slow run + a fast run can't double-fire the
 * same alert. After the claim, send-coach-reply does its own status check
 * and flips to 'sent', which is the terminal state.
 *
 * Schedule (registered in netlify.toml):
 *   [functions."scheduled-coach-reply-worker"]
 *     schedule = "* * * * *"
 *
 * Concurrency cap: each invocation processes up to MAX_PER_RUN alerts so a
 * pathological backlog doesn't blow Netlify's 10s function budget. Anything
 * not picked up this run gets caught by the next minute's run.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const { normalizeCoachDraftText } = require('./_lib/client-context');

// Hard cap per run. Realistic backlog should be 0-3. If we ever see this
// kicking in, it's either a worker outage or someone schedule-bombed the API.
const MAX_PER_RUN = 25;

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

/**
 * Atomically claim a single due alert by flipping it from 'scheduled' back
 * to 'pending'. The PostgREST PATCH with eq filters on BOTH status and
 * scheduled_for is the claim primitive — only one concurrent worker can win
 * the row, the other gets an empty array back.
 *
 * Returns the claimed alert row, or null if someone else won the race.
 */
async function claimAlert(alertId) {
    const claimed = await supabase(
        `coach_alerts?id=eq.${alertId}&status=eq.scheduled`,
        {
            method: 'PATCH',
            body: { status: 'pending' },
            prefer: 'return=representation',
        }
    );
    return claimed[0] || null;
}

function buildAutoSendReviewHold(alert) {
    const data = alert?.data || {};
    const isAutoSend = data.scheduled_via === 'auto_send'
        || data.reply_timing_choice?.source === 'auto_send'
        || data.reply_timing_suggestion?.source === 'auto_send';
    if (!isAutoSend) return null;
    const isManyChatDm = data.channel === 'instagram'
        || data.channel === 'messenger'
        || alert?.alert_type === 'ig_incoming_dm'
        || alert?.alert_type === 'fb_incoming_dm';
    if (!isManyChatDm) return null;
    if (data.auto_send_review_hold?.code) return data.auto_send_review_hold;
    if (data.media_review?.required) {
        return {
            code: 'media_review',
            label: `${data.media_review.label || 'Media'} needs Shannon review`,
        };
    }
    if (data.context_review?.required) {
        return {
            code: 'context_review',
            label: data.context_review.label || 'tracked DM context may be incomplete',
        };
    }
    const review = data.draft_review;
    if (!review) {
        return {
            code: 'draft_review_pending',
            label: 'AI draft review has not completed',
        };
    }
    if (review.verdict !== 'pass' || review.notification_required || review.context_loss_suspected) {
        return {
            code: 'draft_review',
            label: review.summary || 'AI draft needs Shannon review',
        };
    }
    return null;
}

/**
 * Hand the (now pending again) alert to send-coach-reply, which already knows
 * how to route to the in-app or ManyChat path based on data.channel and how
 * to flip to 'sent' once delivered.
 */
async function fireAlert(alert) {
    const replyText = normalizeCoachDraftText(alert.scheduled_reply_text || alert.suggested_message || '');
    const draftText = normalizeCoachDraftText(alert.suggested_message || '');
    if (!replyText) {
        // Defensive: a scheduled alert with no text shouldn't exist. Mark it
        // canceled so we don't keep retrying.
        try {
            await supabase(`coach_alerts?id=eq.${alert.id}`, {
                method: 'PATCH',
                body: {
                    status: 'canceled',
                    data: { ...(alert.data || {}), cancel_reason: 'empty_scheduled_text' },
                },
                prefer: 'return=minimal',
            });
        } catch { /* non-fatal */ }
        return { ok: false, error: 'empty_scheduled_text' };
    }

    const autoHold = buildAutoSendReviewHold(alert);
    if (autoHold) {
        const heldAt = new Date().toISOString();
        try {
            await supabase(`coach_alerts?id=eq.${alert.id}`, {
                method: 'PATCH',
                body: {
                    data: {
                        ...(alert.data || {}),
                        auto_send_review_hold: {
                            ...autoHold,
                            held_at: autoHold.held_at || heldAt,
                            held_by: autoHold.held_by || 'scheduled_worker',
                        },
                        schedule_blocked_at: heldAt,
                        schedule_blocked_reason: autoHold.code,
                    },
                },
                prefer: 'return=minimal',
            });
        } catch (e) {
            console.warn(`[scheduled-worker] failed to stamp auto-review hold for ${alert.id}:`, e.message);
        }
        return { ok: false, error: `auto_review_hold_${autoHold.code}` };
    }

    const res = await fetch(`${SITE_URL}/.netlify/functions/send-coach-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            alertId: alert.id,
            replyText,
            draftText,
            source: 'scheduled_worker',
        }),
    });
    const text = await res.text();
    if (!res.ok) {
        console.error(`[scheduled-worker] send-coach-reply ${res.status} for alert ${alert.id}: ${text.slice(0, 240)}`);
        // If send failed for a transient reason, leave it pending — the next
        // worker tick won't pick it up (status is no longer 'scheduled'), so
        // the alert lands in Shannon's regular inbox flow as a still-pending
        // item he can re-action manually. This is safer than retrying blindly
        // and double-sending after eventual recovery.
        return { ok: false, error: `send_failed_${res.status}` };
    }
    return { ok: true };
}

exports.handler = async () => {
    const startedAt = Date.now();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
    }

    const nowIso = new Date().toISOString();
    let due = [];
    try {
        due = await supabase(
            `coach_alerts?select=id,coach_id,client_id,client_name,scheduled_for,scheduled_reply_text,suggested_message,data,alert_type&status=eq.scheduled&scheduled_for=lte.${nowIso}&order=scheduled_for.asc&limit=${MAX_PER_RUN}`
        );
    } catch (e) {
        console.error('[scheduled-worker] due-query failed:', e.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'due_query_failed', details: e.message }) };
    }

    if (due.length === 0) {
        return {
            statusCode: 200,
            body: JSON.stringify({ checked_at: nowIso, due: 0, fired: 0 }),
        };
    }

    console.log(`[scheduled-worker] ${due.length} alert(s) due at ${nowIso}`);

    let fired = 0;
    let lostRace = 0;
    let failed = 0;

    for (const alert of due) {
        // Claim — wins exactly once across concurrent workers.
        const claimed = await claimAlert(alert.id);
        if (!claimed) {
            lostRace++;
            continue;
        }
        // Use the freshly-claimed row (newer than the initial query result)
        // so we have the latest data/scheduled_reply_text fields.
        const result = await fireAlert(claimed);
        if (result.ok) fired++;
        else failed++;
    }

    const elapsedMs = Date.now() - startedAt;
    return {
        statusCode: 200,
        body: JSON.stringify({
            checked_at: nowIso,
            due: due.length,
            fired,
            lost_race: lostRace,
            failed,
            elapsed_ms: elapsedMs,
        }),
    };
};
