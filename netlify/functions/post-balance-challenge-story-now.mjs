const DEFAULT_SITE_URL = 'https://plantbased-balance.org';
const DEFAULT_VIDEO_PATH = '/assets/ig/challenge-story-next-round.mp4';
const DEFAULT_GRAPH_BASE = 'https://graph.instagram.com';

function cleanString(value, max = 1000) {
    return String(value || '').trim().slice(0, max);
}

function parseJsonObject(raw) {
    try {
        const parsed = JSON.parse(cleanString(raw, 20000));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function sanitizeEnvSuffix(value) {
    return cleanString(value, 120)
        .replace(/^@+/, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
}

function normalizeGraphApiVersion(value) {
    const raw = cleanString(value, 40);
    if (!raw) return 'v25.0';
    return raw.startsWith('v') ? raw : `v${raw}`;
}

function siteUrl() {
    return cleanString(process.env.URL || process.env.SITE_URL || DEFAULT_SITE_URL, 300).replace(/\/+$/, '');
}

function defaultBalanceChallengeStoryUrl() {
    const explicit = cleanString(process.env.BALANCE_CHALLENGE_STORY_VIDEO_URL, 700);
    if (explicit) return explicit;
    return `${siteUrl()}${DEFAULT_VIDEO_PATH}`;
}

function graphBase() {
    return cleanString(process.env.META_IG_GRAPH_BASE || process.env.IG_GRAPH_BASE || DEFAULT_GRAPH_BASE, 200).replace(/\/+$/, '');
}

function graphVersion() {
    return normalizeGraphApiVersion(
        process.env.IG_GRAPH_API_VERSION
        || process.env.INSTAGRAM_GRAPH_API_VERSION
        || process.env.META_GRAPH_API_VERSION
        || 'v25.0'
    );
}

function defaultIgUserId() {
    return cleanString(
        process.env.INSTAGRAM_GRAPH_ACCOUNT_ID
        || process.env.IG_GRAPH_BUSINESS_ACCOUNT_ID
        || process.env.META_IG_USER_ID
        || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
        120
    );
}

function accountMap() {
    return parseJsonObject(process.env.META_IG_ACCOUNT_MAP_JSON || process.env.META_INSTAGRAM_ACCOUNT_MAP_JSON || '');
}

function mappedAccountConfig(igUserId) {
    const map = accountMap();
    const account = map[igUserId] || {};
    return account && typeof account === 'object' ? account : {};
}

function igUserIdCandidates(explicit) {
    const ids = [
        cleanString(explicit, 120),
        defaultIgUserId(),
        ...Object.keys(accountMap()).map(id => cleanString(id, 120)),
    ].filter(Boolean);
    return [...new Set(ids)];
}

function tokenEnvCandidates(igUserId) {
    const account = mappedAccountConfig(igUserId);
    const botAccount = cleanString(account.bot_account || account.botAccount || account.handle || '', 120);
    const explicit = cleanString(account.access_token_env || account.accessTokenEnv || account.token_env || '', 160);
    const suffixes = [sanitizeEnvSuffix(botAccount), sanitizeEnvSuffix(igUserId)].filter(Boolean);
    const names = [];
    if (explicit) names.push(explicit);
    for (const suffix of suffixes) {
        names.push(`META_IG_ACCESS_TOKEN_${suffix}`);
        names.push(`INSTAGRAM_GRAPH_ACCESS_TOKEN_${suffix}`);
        names.push(`IG_GRAPH_ACCESS_TOKEN_${suffix}`);
        names.push(`META_IG_${suffix}_ACCESS_TOKEN`);
    }
    names.push(
        'META_IG_COCOS_ACCESS_TOKEN',
        'META_IG_ACCESS_TOKEN',
        'INSTAGRAM_ACCESS_TOKEN',
        'INSTAGRAM_GRAPH_ACCESS_TOKEN',
        'IG_GRAPH_ACCESS_TOKEN'
    );
    return [...new Set(names)].filter(Boolean);
}

function tokenSecretKeyCandidates(igUserId) {
    const account = mappedAccountConfig(igUserId);
    const botAccount = cleanString(account.bot_account || account.botAccount || account.handle || '', 120);
    const explicit = cleanString(account.token_secret_key || account.tokenSecretKey || account.secret_key || '', 180);
    const suffixes = [sanitizeEnvSuffix(botAccount).toLowerCase(), sanitizeEnvSuffix(igUserId).toLowerCase()].filter(Boolean);
    const names = [];
    if (explicit) names.push(explicit);
    for (const suffix of suffixes) {
        names.push(`instagram_graph_access_token_${suffix}`);
        names.push(`meta_ig_access_token_${suffix}`);
    }
    names.push('instagram_graph_access_token', 'meta_ig_access_token');
    return [...new Set(names)].filter(Boolean);
}

let cachedDefaultSecretToken = null;

async function defaultSecretToken(debug = null) {
    const supabaseUrl = cleanString(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '', 300).replace(/\/+$/, '');
    const serviceKey = cleanString(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '', 5000);
    const key = 'instagram_graph_access_token';
    if (cachedDefaultSecretToken) return cachedDefaultSecretToken;
    if (!supabaseUrl || !serviceKey) {
        if (debug) debug.secretLookup = { key, ok: false, reason: 'missing_supabase_env' };
        return '';
    }
    const url = `${supabaseUrl}/rest/v1/app_private_secrets?select=value&key=eq.${encodeURIComponent(key)}&limit=1`;
    const res = await fetch(url, {
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
        },
    });
    if (!res.ok) {
        if (debug) debug.secretLookup = { key, ok: false, status: res.status };
        return '';
    }
    const rows = await res.json().catch(() => []);
    const token = cleanString(rows?.[0]?.value || '', 5000);
    if (debug) debug.secretLookup = { key, ok: Boolean(token), rows: Array.isArray(rows) ? rows.length : 0, usable: looksLikeUsableToken(token) };
    if (looksLikeUsableToken(token)) cachedDefaultSecretToken = token;
    return token;
}

function looksLikeUsableToken(token) {
    const clean = cleanString(token, 5000);
    return clean.length >= 40 && !clean.includes('*') && !/\s/.test(clean);
}

async function resolveAccessToken(igUserId, debug = null) {
    const envAttempts = [];
    for (const envName of tokenEnvCandidates(igUserId)) {
        const token = cleanString(process.env[envName] || '', 5000);
        envAttempts.push({
            envName,
            present: Boolean(token),
            masked: token.includes('*'),
            length: token.length,
        });
        if (looksLikeUsableToken(token)) return { token, source: `env:${envName}` };
    }
    if (debug) debug.envAttempts = envAttempts;
    const token = await defaultSecretToken(debug);
    if (looksLikeUsableToken(token)) return { token, source: 'secret:instagram_graph_access_token' };
    return { token: '', source: 'none' };
}

function graphUrl(path) {
    return `${graphBase()}/${graphVersion()}/${String(path || '').replace(/^\/+/, '')}`;
}

async function graphPost(path, params) {
    const body = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value != null && value !== '') body.set(key, String(value));
    });
    const res = await fetch(graphUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { raw: text };
    }
    if (!res.ok) {
        const message = data?.error?.message || text || `Graph API error ${res.status}`;
        const error = new Error(message);
        error.status = res.status;
        error.graph = data;
        throw error;
    }
    return data;
}

async function graphGet(path, params) {
    const url = new URL(graphUrl(path));
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value != null && value !== '') url.searchParams.set(key, String(value));
    });
    const res = await fetch(url);
    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { raw: text };
    }
    if (!res.ok) {
        const message = data?.error?.message || text || `Graph API error ${res.status}`;
        const error = new Error(message);
        error.status = res.status;
        error.graph = data;
        throw error;
    }
    return data;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForContainer(containerId, token, { timeoutMs = 22000, intervalMs = 2000 } = {}) {
    const started = Date.now();
    let lastStatus = null;

    while (Date.now() - started <= timeoutMs) {
        const status = await graphGet(containerId, {
            fields: 'status_code,status',
            access_token: token,
        });
        lastStatus = status;
        const code = cleanString(status.status_code || status.status, 80).toUpperCase();
        if (code === 'FINISHED') return status;
        if (['ERROR', 'EXPIRED'].includes(code)) {
            throw new Error(`Instagram media container ${containerId} is ${code.toLowerCase()}`);
        }
        await sleep(intervalMs);
    }

    throw new Error(`Instagram media container ${containerId} was not ready in time. Last status: ${JSON.stringify(lastStatus || {})}`);
}

async function publishBalanceChallengeStory(options = {}) {
    const candidates = igUserIdCandidates(options.igUserId);
    const videoUrl = cleanString(options.videoUrl || defaultBalanceChallengeStoryUrl(), 700);
    if (!candidates.length) throw new Error('Missing Instagram Graph account id');
    if (!videoUrl || !/^https:\/\//i.test(videoUrl)) throw new Error('Story video URL must be a public https URL');

    const errors = [];
    for (const igUserId of candidates) {
        const debug = { envAttempts: [], secretLookup: null };
        const resolved = await resolveAccessToken(igUserId, debug);
        if (!resolved.token) {
            errors.push({ igUserId, error: 'missing_token', debug });
            continue;
        }

        try {
            const container = await graphPost(`${encodeURIComponent(igUserId)}/media`, {
                media_type: 'STORIES',
                video_url: videoUrl,
                access_token: resolved.token,
            });
            const creationId = cleanString(container.id, 120);
            if (!creationId) throw new Error('Instagram did not return a media container id');

            const status = await waitForContainer(creationId, resolved.token, options.poll || {});
            const published = await graphPost(`${encodeURIComponent(igUserId)}/media_publish`, {
                creation_id: creationId,
                access_token: resolved.token,
            });

            return {
                ok: true,
                source: cleanString(options.source || 'balance_challenge_story', 120),
                igUserId,
                videoUrl,
                creationId,
                status,
                mediaId: cleanString(published.id, 120),
                graphVersion: graphVersion(),
            };
        } catch (error) {
            errors.push({
                igUserId,
                error: error.message || 'publish_failed',
                graph: error.graph || null,
            });
        }
    }

    const error = new Error(`No configured Instagram account could publish this story: ${errors.map(item => `${item.igUserId}:${item.error}`).join('; ')}`);
    error.graph = { account_errors: errors };
    throw error;
}

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function getSecrets() {
    return [
        process.env.IG_STORY_BOT_BRIDGE_SECRET,
        process.env.META_IG_SYNC_SECRET,
        process.env.META_IG_WEBHOOK_VERIFY_TOKEN,
        process.env.META_WEBHOOK_VERIFY_TOKEN,
    ]
        .map(value => String(value || '').trim())
        .filter(Boolean);
}

async function readJson(req) {
    try {
        return await req.json();
    } catch {
        return {};
    }
}

function isAuthorized(req, body = {}) {
    if (process.env.CONTEXT === 'dev') return true;
    const provided = String(
        req.headers.get('x-ig-story-secret')
        || req.headers.get('x-meta-ig-sync-secret')
        || body.secret
        || ''
    ).trim();
    return Boolean(provided && getSecrets().includes(provided));
}

export default async (req) => {
    if (req.method !== 'POST') {
        return json(405, { ok: false, error: 'method_not_allowed' });
    }

    const body = await readJson(req);
    if (!isAuthorized(req, body)) {
        return json(401, { ok: false, error: 'unauthorized' });
    }

    try {
        const result = await publishBalanceChallengeStory({
            source: 'manual_now',
            videoUrl: body.videoUrl || defaultBalanceChallengeStoryUrl(),
        });
        return json(200, result);
    } catch (error) {
        console.error('[post-balance-challenge-story-now] failed:', error);
        return json(500, {
            ok: false,
            error: error.message || 'publish_failed',
            graph: error.graph || null,
        });
    }
};

export const config = {
    path: '/api/post-balance-challenge-story-now',
};
