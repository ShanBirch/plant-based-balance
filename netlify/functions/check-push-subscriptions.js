// Debug endpoint to check push subscriptions for a user
// Usage: GET /.netlify/functions/check-push-subscriptions?user_id=UUID
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
    const userId = event.queryStringParameters?.user_id;

    if (!userId) {
        // If no user_id, return ALL subscriptions (for debugging)
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/push_subscriptions?select=user_id,endpoint,p256dh,updated_at&order=updated_at.desc&limit=20`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                }
            }
        );
        const data = await response.json();
        const summary = data.map(s => ({
            user: s.user_id?.substring(0, 8) + '...',
            type: s.endpoint?.startsWith('native://') ? 'NATIVE/FCM' : 'WEB_PUSH',
            endpoint: s.endpoint?.substring(0, 50) + '...',
            updated: s.updated_at,
        }));
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ total: data.length, subscriptions: summary }, null, 2)
        };
    }

    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=*`,
        {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            }
        }
    );
    const data = await response.json();
    const summary = data.map(s => ({
        id: s.id,
        type: s.endpoint?.startsWith('native://') ? 'NATIVE/FCM' : 'WEB_PUSH',
        endpoint: s.endpoint?.substring(0, 60) + '...',
        p256dh: s.p256dh?.substring(0, 20) + '...',
        updated: s.updated_at,
    }));
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, total: data.length, subscriptions: summary }, null, 2)
    };
};
