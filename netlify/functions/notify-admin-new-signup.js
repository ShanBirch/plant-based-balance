// Notify admin(s) on the lock screen the instant a new user signs up.
//
// Triggered by database/new_user_signup_trigger.sql (AFTER INSERT on
// public.users, which is populated by the auth.users trigger).
//
// This fires at account-creation time, BEFORE the onboarding quiz. The
// follow-up "welcome draft" notification fires later from
// onboarding-welcome-draft.js once the user finishes onboarding and
// assign_coach_shannon_to_user() inserts them into coach_clients. The
// two are intentionally distinct: this one says "a new person just
// joined" (informational — useful even if they bail before onboarding);
// the later one says "draft ready to send them" (actionable).

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

async function supabaseQuery(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    return res.json();
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

    const { userId, name, email } = payload;
    if (!userId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId' }) };
    }

    // Skip test accounts so QA signups don't spam admins.
    try {
        const flags = await supabaseQuery(`users?select=is_test_account&id=eq.${userId}&limit=1`);
        if (flags[0]?.is_test_account) {
            return { statusCode: 200, body: JSON.stringify({ skipped: 'test_account' }) };
        }
    } catch (e) { /* continue — don't block the notification on a lookup failure */ }

    const admins = await supabaseQuery(`admin_users?select=user_id`);
    if (!admins.length) {
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_admins' }) };
    }

    const displayName = name || (email ? email.split('@')[0] : 'Someone');
    const title = `🎉 New signup: ${displayName}`;
    const body = email
        ? `${email} just joined Plant Based Balance — welcome draft will follow once they finish the quiz.`
        : `${displayName} just joined Plant Based Balance — welcome draft will follow once they finish the quiz.`;

    const pushUrl = `${SITE_URL}/.netlify/functions/send-dm-notification`;
    const results = await Promise.all(admins.map(a =>
        fetch(pushUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientId: a.user_id,
                senderId: userId,
                senderName: title,
                messageText: body,
                type: 'new_user_signup',
                newUserId: userId,
                newUserName: displayName,
                newUserEmail: email || '',
                collapseKey: `new_user_signup:${userId}`,
            }),
        }).then(r => r.ok).catch(e => {
            console.warn('[new-signup] push failed for', a.user_id, e.message);
            return false;
        })
    ));

    return {
        statusCode: 200,
        body: JSON.stringify({ notified: results.filter(Boolean).length, total: admins.length }),
    };
};
