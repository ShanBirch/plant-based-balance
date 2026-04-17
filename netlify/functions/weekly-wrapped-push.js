/**
 * Weekly Wrapped — Sunday Afternoon User Push
 *
 * Fires one push per active user ≈ Sunday 17:00 AEST (Sunday 07:00 UTC).
 * Copy: "Your week is wrapped 🎬 — tap to see how you stacked up."
 *
 * The push just pings the app; it doesn't embed any data. When the user opens
 * the app, `dashboard.html` auto-triggers `weeklyWrapped.open()` which fetches
 * the user's fresh 7-day aggregate client-side (see `lib/weekly-wrapped.js`).
 *
 * Dedup: records `push_sent_at` in `weekly_wrapped` per (user_id, iso_week) so
 * a re-run doesn't double-push.
 *
 * Schedule: netlify.toml `[functions."weekly-wrapped-push"] schedule = "0 7 * * 0"`
 *   - Sun 07:00 UTC
 *   - AEST (UTC+10): Sun 17:00 local
 *   - AEDT (UTC+11): Sun 18:00 local
 *   Close enough to "Sunday arvo" without DST acrobatics.
 */

const { supabaseQuery } = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const DAY_MS = 24 * 60 * 60 * 1000;

// ============================================================
// ISO week helper (mirror of client lib/weekly-wrapped.js)
// ============================================================

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

// ============================================================
// Active recipients — users with at least one push subscription
// and not flagged as test accounts
// ============================================================

async function loadActiveRecipients() {
    // Two-step: fetch subscriptions first (cheap), then hydrate user rows.
    let subs;
    try {
        subs = await supabaseQuery(
            'push_subscriptions?select=user_id&limit=10000'
        );
    } catch (err) {
        console.error('[weekly-wrapped] subscription fetch failed:', err.message);
        return [];
    }
    const userIds = [...new Set((subs || []).map(s => s.user_id).filter(Boolean))];
    if (!userIds.length) return [];

    // PostgREST's `in.(…)` has a practical URL length limit; chunk at 200.
    const CHUNK = 200;
    const users = [];
    for (let i = 0; i < userIds.length; i += CHUNK) {
        const slice = userIds.slice(i, i + CHUNK);
        try {
            const rows = await supabaseQuery(
                `users?select=id,name,email,is_test_account&id=in.(${slice.join(',')})`
            );
            users.push(...(rows || []));
        } catch (err) {
            console.warn(`[weekly-wrapped] user chunk fetch failed: ${err.message}`);
        }
    }
    return users.filter(u => !u.is_test_account);
}

// ============================================================
// Dedup: skip users already pushed for this ISO week
// ============================================================

async function loadPushedUserSet(isoWeek) {
    try {
        const rows = await supabaseQuery(
            `weekly_wrapped?select=user_id&iso_week=eq.${encodeURIComponent(isoWeek)}&push_sent_at=not.is.null&limit=10000`
        );
        return new Set((rows || []).map(r => r.user_id));
    } catch (err) {
        console.warn('[weekly-wrapped] dedup load failed (continuing unguarded):', err.message);
        return new Set();
    }
}

// ============================================================
// Record push_sent_at — upsert so we create the row if absent
// ============================================================

async function recordPushSent(userId, isoWeek) {
    try {
        await supabaseQuery('weekly_wrapped', {
            method: 'POST',
            prefer: 'return=minimal,resolution=merge-duplicates',
            body: [{
                user_id: userId,
                iso_week: isoWeek,
                // `data_snapshot` is NOT NULL; write an empty placeholder here,
                // the client overwrites with the real payload when the user opens.
                data_snapshot: { _placeholder: true, push_only: true },
                push_sent_at: new Date().toISOString(),
            }],
        });
    } catch (err) {
        // Non-fatal — the push already went out.
        console.warn(`[weekly-wrapped] record push_sent_at failed for ${userId}: ${err.message}`);
    }
}

// ============================================================
// Push per user via the shared notification dispatcher
// ============================================================

async function pushOneUser(user) {
    const title = '🎬 Your Week, Wrapped';
    const body = 'Tap to see how you stacked up this week.';
    try {
        const res = await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: user.id,
                senderId: user.id, // self — this is a system push, not a DM
                senderName: title,
                messageText: body,
                type: 'weekly_wrapped_ready',
            }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            console.warn(`[weekly-wrapped] push failed ${user.id}: ${res.status} ${text.slice(0, 160)}`);
            return false;
        }
        return true;
    } catch (err) {
        console.warn(`[weekly-wrapped] push error ${user.id}: ${err.message}`);
        return false;
    }
}

// ============================================================
// Main handler
// ============================================================

exports.handler = async () => {
    const started = Date.now();
    const isoWeek = getISOWeek(new Date());
    console.log(`[weekly-wrapped] starting for ${isoWeek} at ${new Date().toISOString()}`);

    const [recipients, alreadyPushed] = await Promise.all([
        loadActiveRecipients(),
        loadPushedUserSet(isoWeek),
    ]);

    const queue = recipients.filter(u => !alreadyPushed.has(u.id));
    console.log(`[weekly-wrapped] ${recipients.length} recipients, ${alreadyPushed.size} already pushed, ${queue.length} to push`);

    let sent = 0;
    let failed = 0;

    // Modest parallelism — don't overwhelm send-dm-notification or FCM.
    const CONCURRENCY = 5;
    for (let i = 0; i < queue.length; i += CONCURRENCY) {
        const batch = queue.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (u) => {
            const ok = await pushOneUser(u);
            if (ok) await recordPushSent(u.id, isoWeek);
            return ok;
        }));
        results.forEach(ok => { if (ok) sent++; else failed++; });
    }

    const elapsed = Date.now() - started;
    const summary = {
        iso_week: isoWeek,
        recipients: recipients.length,
        already_pushed: alreadyPushed.size,
        queued: queue.length,
        sent,
        failed,
        elapsed_ms: elapsed,
    };
    console.log(`[weekly-wrapped] done — ${JSON.stringify(summary)}`);
    return { statusCode: 200, body: JSON.stringify(summary) };
};
