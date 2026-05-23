const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';

function cleanString(value, max = 500) {
    return String(value || '').trim().slice(0, max);
}

function parseBoolean(value, fallback = false) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const raw = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
    return fallback;
}

function env(name) {
    return name ? cleanString(process.env[name] || '') : '';
}

function sanitizeEnvSuffix(value) {
    return cleanString(value, 120)
        .replace(/^@+/, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
}

function normalizeAccountEntry(ownerId, value = {}) {
    const source = typeof value === 'string' ? { bot_account: value } : (value || {});
    const cleanOwnerId = cleanString(
        ownerId
        || source.owner_ig_user_id
        || source.ownerId
        || source.account_id
        || source.accountId
        || source.ig_user_id
        || source.igUserId
        || source.id,
        120
    );
    if (!cleanOwnerId) return null;
    return {
        ownerId: cleanOwnerId,
        accountId: cleanOwnerId,
        botAccount: cleanString(source.bot_account || source.botAccount || source.handle || source.account_handle || source.name, 120),
        accessToken: cleanString(source.access_token || source.accessToken, 5000),
        accessTokenEnv: cleanString(source.access_token_env || source.accessTokenEnv || source.token_env || source.tokenEnv, 160),
        tokenSecretKey: cleanString(source.token_secret_key || source.tokenSecretKey || source.secret_key || source.secretKey, 180),
        autoDraftMessages: source.auto_draft_messages != null || source.autoDraftMessages != null
            ? parseBoolean(source.auto_draft_messages ?? source.autoDraftMessages, false)
            : null,
        autoDraftStoryReplies: source.auto_draft_story_replies != null || source.autoDraftStoryReplies != null
            ? parseBoolean(source.auto_draft_story_replies ?? source.autoDraftStoryReplies, false)
            : null,
        autoSendMessages: source.auto_send_messages != null || source.autoSendMessages != null
            ? parseBoolean(source.auto_send_messages ?? source.autoSendMessages, false)
            : null,
    };
}

function parseMetaIgAccountMap(raw = '') {
    const text = cleanString(raw, 20000);
    if (!text) return {};
    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (err) {
        console.warn('[meta-ig-accounts] invalid META_IG_ACCOUNT_MAP_JSON:', err.message);
        return {};
    }
    const entries = Array.isArray(parsed)
        ? parsed.map(item => [item?.owner_ig_user_id || item?.ownerId || item?.account_id || item?.accountId || item?.id, item])
        : Object.entries(parsed || {});
    return entries.reduce((acc, [ownerId, value]) => {
        const normalized = normalizeAccountEntry(ownerId, value);
        if (normalized?.ownerId) acc[normalized.ownerId] = normalized;
        return acc;
    }, {});
}

let cachedRawMap = null;
let cachedMap = null;

function getMetaIgAccountMap() {
    const raw = process.env.META_IG_ACCOUNT_MAP_JSON
        || process.env.META_INSTAGRAM_ACCOUNT_MAP_JSON
        || '';
    if (raw === cachedRawMap && cachedMap) return cachedMap;
    cachedRawMap = raw;
    cachedMap = parseMetaIgAccountMap(raw);
    return cachedMap;
}

function resolveMetaIgAccountConfig(ownerId) {
    const cleanOwnerId = cleanString(ownerId, 120);
    const map = getMetaIgAccountMap();
    const mapped = cleanOwnerId ? map[cleanOwnerId] : null;
    const globalOwnerIds = [
        process.env.META_IG_USER_ID,
        process.env.INSTAGRAM_GRAPH_ACCOUNT_ID,
        process.env.IG_GRAPH_BUSINESS_ACCOUNT_ID,
        process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    ].map(v => cleanString(v, 120)).filter(Boolean);
    const isGlobalOwner = !cleanOwnerId || globalOwnerIds.includes(cleanOwnerId);
    const botAccount = mapped?.botAccount
        || (isGlobalOwner ? cleanString(process.env.META_IG_BOT_ACCOUNT || process.env.IG_BOT_ACCOUNT || '', 120) : '');
    return {
        ownerId: cleanOwnerId,
        accountId: cleanOwnerId,
        botAccount,
        accessToken: mapped?.accessToken || '',
        accessTokenEnv: mapped?.accessTokenEnv || '',
        tokenSecretKey: mapped?.tokenSecretKey || '',
        autoDraftMessages: mapped?.autoDraftMessages != null
            ? mapped.autoDraftMessages
            : parseBoolean(process.env.META_IG_AUTO_DRAFT_MESSAGES, false),
        autoDraftStoryReplies: mapped?.autoDraftStoryReplies != null
            ? mapped.autoDraftStoryReplies
            : parseBoolean(process.env.META_IG_AUTO_DRAFT_STORY_REPLIES, false),
        autoSendMessages: mapped?.autoSendMessages != null
            ? mapped.autoSendMessages
            : parseBoolean(process.env.META_IG_AUTO_SEND_MESSAGES, false),
    };
}

function accountTokenEnvCandidates(account = {}) {
    const candidates = [];
    if (account.accessTokenEnv) candidates.push(account.accessTokenEnv);
    const suffixes = [
        sanitizeEnvSuffix(account.botAccount),
        sanitizeEnvSuffix(account.ownerId),
    ].filter(Boolean);
    for (const suffix of suffixes) {
        candidates.push(`META_IG_ACCESS_TOKEN_${suffix}`);
        candidates.push(`INSTAGRAM_GRAPH_ACCESS_TOKEN_${suffix}`);
        candidates.push(`IG_GRAPH_ACCESS_TOKEN_${suffix}`);
        candidates.push(`META_IG_${suffix}_ACCESS_TOKEN`);
    }
    candidates.push('META_IG_ACCESS_TOKEN');
    candidates.push('INSTAGRAM_ACCESS_TOKEN');
    candidates.push('INSTAGRAM_GRAPH_ACCESS_TOKEN');
    candidates.push('IG_GRAPH_ACCESS_TOKEN');
    return [...new Set(candidates)].filter(Boolean);
}

function accountSecretKeyCandidates(account = {}) {
    const suffixes = [
        sanitizeEnvSuffix(account.botAccount).toLowerCase(),
        sanitizeEnvSuffix(account.ownerId).toLowerCase(),
    ].filter(Boolean);
    const candidates = [];
    if (account.tokenSecretKey) candidates.push(account.tokenSecretKey);
    for (const suffix of suffixes) {
        candidates.push(`instagram_graph_access_token_${suffix}`);
        candidates.push(`meta_ig_access_token_${suffix}`);
    }
    candidates.push('instagram_graph_access_token');
    candidates.push('meta_ig_access_token');
    return [...new Set(candidates)].filter(Boolean);
}

const tokenCache = new Map();

async function secretValueForKey(key, supabaseQuery) {
    const cleanKey = cleanString(key, 180);
    if (!cleanKey || typeof supabaseQuery !== 'function') return '';
    const cached = tokenCache.get(`secret:${cleanKey}`);
    if (cached) return cached;
    try {
        const rows = await supabaseQuery(`app_private_secrets?select=value&key=eq.${encodeURIComponent(cleanKey)}&limit=1`);
        const token = cleanString(rows?.[0]?.value || '', 5000);
        if (token) tokenCache.set(`secret:${cleanKey}`, token);
        return token;
    } catch (err) {
        console.warn(`[meta-ig-accounts] token secret lookup failed for ${cleanKey}:`, err.message);
        return '';
    }
}

async function resolveMetaIgAccessToken(ownerId, supabaseQuery) {
    const account = resolveMetaIgAccountConfig(ownerId);
    if (account.accessToken) return { token: account.accessToken, account, source: 'account_map' };
    for (const envName of accountTokenEnvCandidates(account)) {
        const token = env(envName);
        if (token) return { token, account, source: `env:${envName}` };
    }
    for (const key of accountSecretKeyCandidates(account)) {
        const token = await secretValueForKey(key, supabaseQuery);
        if (token) return { token, account, source: `secret:${key}` };
    }
    return { token: '', account, source: 'none' };
}

function buildGraphSubscriberId(ownerId, userId) {
    const cleanUserId = cleanString(userId, 120);
    if (!cleanUserId) return '';
    const cleanOwnerId = cleanString(ownerId, 120);
    return cleanOwnerId
        ? `${GRAPH_SUBSCRIBER_PREFIX}${cleanOwnerId}:${cleanUserId}`
        : `${GRAPH_SUBSCRIBER_PREFIX}${cleanUserId}`;
}

function legacyGraphSubscriberIds(userId) {
    const cleanUserId = cleanString(userId, 120);
    if (!cleanUserId) return [];
    return [
        `meta_ig:${cleanUserId}`,
        `${GRAPH_SUBSCRIBER_PREFIX}${cleanUserId}`,
    ];
}

module.exports = {
    GRAPH_SUBSCRIBER_PREFIX,
    cleanString,
    parseBoolean,
    parseMetaIgAccountMap,
    getMetaIgAccountMap,
    resolveMetaIgAccountConfig,
    resolveMetaIgAccessToken,
    buildGraphSubscriberId,
    legacyGraphSubscriberIds,
    _test: {
        sanitizeEnvSuffix,
        accountTokenEnvCandidates,
        accountSecretKeyCandidates,
        normalizeAccountEntry,
    },
};
