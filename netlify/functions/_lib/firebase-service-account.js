const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let cachedServiceAccountPromise = null;

function normalizeServiceAccount(account) {
    if (!account || typeof account !== 'object') return null;

    const clientEmail = account.client_email || account.clientEmail;
    const privateKey = account.private_key || account.privateKey;
    const projectId = account.project_id || account.projectId;

    if (!clientEmail || !privateKey || !projectId) return null;

    return {
        client_email: clientEmail,
        private_key: String(privateKey).replace(/\\n/g, '\n'),
        project_id: projectId,
    };
}

function loadServiceAccountFromEnv() {
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            return normalizeServiceAccount(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
        }
        if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
            return normalizeServiceAccount({
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                private_key: process.env.FIREBASE_PRIVATE_KEY,
                project_id: process.env.FIREBASE_PROJECT_ID,
            });
        }
    } catch (err) {
        console.error('[FirebaseServiceAccount] Config parse error:', err.message);
    }
    return null;
}

async function loadServiceAccountFromSupabase() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/app_private_secrets?select=value&key=eq.firebase_service_account&limit=1`,
        {
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (!res.ok) {
        console.error('[FirebaseServiceAccount] Supabase lookup failed:', res.status, await res.text());
        return null;
    }

    const rows = await res.json();
    const rawValue = rows?.[0]?.value;
    if (!rawValue) return null;

    try {
        return normalizeServiceAccount(typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue);
    } catch (err) {
        console.error('[FirebaseServiceAccount] Supabase secret parse failed:', err.message);
        return null;
    }
}

async function loadFirebaseServiceAccount() {
    if (!cachedServiceAccountPromise) {
        cachedServiceAccountPromise = (async () => {
            const envAccount = loadServiceAccountFromEnv();
            if (envAccount) return envAccount;
            return loadServiceAccountFromSupabase();
        })();
    }
    return cachedServiceAccountPromise;
}

module.exports = {
    loadFirebaseServiceAccount,
};
