// Notify admin(s) on the lock screen whenever a new user signs up.
// Triggered by database/new_user_signup_trigger.sql via pg_net.

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

    const admins = await supabaseQuery(`admin_users?select=user_id`);
    if (!admins.length) {
        return { statusCode: 200, body: JSON.stringify({ skipped: 'no_admins' }) };
    }

    const displayName = name || (email ? email.split('@')[0] : 'Someone');
    const title = `🎉 New signup: ${displayName}`;
    const body = email ? `${email} just joined Plant Based Balance` : `${displayName} just joined Plant Based Balance`;

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
