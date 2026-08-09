/**
 * Month Wrapped - first-of-month user push
 *
 * Runs at 09:00 Brisbane on the first day of each month and recaps the
 * completed calendar month. The daily cron only does work when Brisbane's
 * wall-clock date is the first, so month lengths and year rollover stay safe.
 *
 * Dedup uses the existing weekly_wrapped.iso_week text column with a YYYY-MM
 * period key. The legacy table and function filename remain for compatibility.
 */

const { supabaseQuery } = require('./_lib/client-context');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const DAY_MS = 24 * 60 * 60 * 1000;
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;

function getBrisbaneWallClockDate(date = new Date()) {
    return new Date(date.getTime() + BRISBANE_OFFSET_MS);
}

// ============================================================
// Completed calendar-month helpers
// ============================================================

function getWrappedMonthStart(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
}

function getMonthKey(date) {
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
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

async function loadPushedUserSet(periodKey) {
    try {
        const rows = await supabaseQuery(
            `weekly_wrapped?select=user_id&iso_week=eq.${encodeURIComponent(periodKey)}&push_sent_at=not.is.null&limit=10000`
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

async function recordPushSent(userId, periodKey) {
    try {
        await supabaseQuery('weekly_wrapped', {
            method: 'POST',
            prefer: 'return=minimal,resolution=merge-duplicates',
            body: [{
                user_id: userId,
                iso_week: periodKey,
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
    const title = 'Your Month, Wrapped';
    const body = 'Tap to see the progress you stacked up last month.';
    try {
        const res = await fetch(`${SITE_URL}/.netlify/functions/send-dm-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: user.id,
                senderId: user.id, // self — this is a system push, not a DM
                senderName: title,
                messageText: body,
                type: 'monthly_wrapped_ready',
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
    const brisbaneNow = getBrisbaneWallClockDate(new Date());
    if (brisbaneNow.getUTCDate() !== 1) {
        return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'not_first_day_in_brisbane' }) };
    }
    const periodKey = getMonthKey(getWrappedMonthStart(brisbaneNow));
    console.log(`[weekly-wrapped] starting for ${periodKey} at ${new Date().toISOString()}`);

    const [recipients, alreadyPushed] = await Promise.all([
        loadActiveRecipients(),
        loadPushedUserSet(periodKey),
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
            if (ok) await recordPushSent(u.id, periodKey);
            return ok;
        }));
        results.forEach(ok => { if (ok) sent++; else failed++; });
    }

    const elapsed = Date.now() - started;
    const summary = {
        iso_week: periodKey,
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

exports.getBrisbaneWallClockDate = getBrisbaneWallClockDate;
exports.getWrappedMonthStart = getWrappedMonthStart;
exports.getMonthKey = getMonthKey;
