// Return only this member's submission receipts, never private coach drafts.
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, supabaseQuery } = require('./_lib/client-context');
const patterns = ['squat', 'hinge', 'push', 'pull'];
const reply = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
exports.handler = async event => {
    if (event.httpMethod !== 'GET') return reply(405, { error: 'Method not allowed' });
    const token = String(event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return reply(401, { error: 'Please sign in.' });
    try {
        const auth = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` } });
        if (!auth.ok) return reply(401, { error: 'Please sign in again.' });
        const user = await auth.json();
        if (!user.id) return reply(401, { error: 'Please sign in again.' });
        const id = encodeURIComponent(user.id);
        const [alerts, nudges] = await Promise.all([
            supabaseQuery(`coach_alerts?select=id,created_at,data&client_id=eq.${id}&data->>is_form_check=eq.true&data->>form_check_workout_name=like.Balance%20Master%3A%20*&order=created_at.desc&limit=500`),
            supabaseQuery(`nudges?select=id,created_at,message&sender_id=eq.${id}&nudge_type=eq.form_check&message=like.*Balance%20Master%3A%20*&order=created_at.desc&limit=500`)
        ]);
        const submissions = {};
        for (const pattern of patterns) {
            const marker = `Balance Master: ${pattern}`;
            const alert = alerts.find(row => row.data?.form_check_workout_name === marker && /^https:\/\//.test(row.data?.form_check_video_url || ''));
            const nudge = nudges.find(row => row.message?.split('\n').includes(`Workout: ${marker}`) && /\[video: https:\/\//i.test(row.message));
            const row = alert || nudge;
            if (row) submissions[pattern] = { id: row.id, submittedAt: row.created_at };
        }
        return reply(200, { submissions });
    } catch (error) {
        console.error('[master-form-check-status]', error.message);
        return reply(503, { error: 'Could not check your video submissions. Please retry.' });
    }
};
