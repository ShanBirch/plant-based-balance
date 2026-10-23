const { makeHandler } = require('./_lib/weekly-progress');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
async function query(path, options = {}) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        if (detail.code === '23505') throw Object.assign(new Error('That card or message already has a saved progress card. Reopen the conversation.'), { status: 409 });
        throw new Error('Progress storage unavailable');
    }
    return response.json();
}
async function authenticate(event) {
    const token = String(event.headers?.authorization || event.headers?.Authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    return response.ok ? (await response.json()).id : null;
}
exports.handler = makeHandler({ query, authenticate });
