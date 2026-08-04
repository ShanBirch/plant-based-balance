const crypto = require('node:crypto');

const META_APP_PREVIEW_URL = 'https://plantbased-balance.org/meta-app-preview.html';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function signingSecret(env = process.env) {
    return String(
        env.META_APP_PREVIEW_REF_SECRET
        || env.SUPABASE_SERVICE_ROLE_KEY
        || env.SUPABASE_SERVICE_KEY
        || ''
    ).trim();
}

function encode(value) {
    return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(encodedPayload, secret) {
    return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function createMetaAppPreviewRef(threadId, {
    nowMs = Date.now(),
    ttlMs = DEFAULT_TTL_MS,
    env = process.env,
} = {}) {
    const id = String(threadId || '').trim();
    const secret = signingSecret(env);
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) || !secret) return '';
    const payload = encode(JSON.stringify({
        t: id,
        i: Math.floor(nowMs / 1000),
        e: Math.floor((nowMs + ttlMs) / 1000),
    }));
    return `${payload}.${signPayload(payload, secret)}`;
}

function verifyMetaAppPreviewRef(token, {
    nowMs = Date.now(),
    env = process.env,
} = {}) {
    const value = String(token || '').trim();
    const secret = signingSecret(env);
    if (!secret || value.length > 700) return null;
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra) return null;
    const expected = signPayload(payload, secret);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length
        || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
    let parsed;
    try { parsed = JSON.parse(decode(payload)); } catch (_) { return null; }
    const issuedMs = Number(parsed?.i) * 1000;
    const expiresMs = Number(parsed?.e) * 1000;
    const threadId = String(parsed?.t || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(threadId)
        || !Number.isFinite(issuedMs)
        || !Number.isFinite(expiresMs)
        || issuedMs > nowMs + 60_000
        || expiresMs <= nowMs
        || expiresMs - issuedMs > DEFAULT_TTL_MS + 60_000) return null;
    return { threadId, issuedAt: new Date(issuedMs).toISOString(), expiresAt: new Date(expiresMs).toISOString() };
}

function buildMetaAppPreviewUrl(threadId, options = {}) {
    const token = createMetaAppPreviewRef(threadId, options);
    if (!token) return META_APP_PREVIEW_URL;
    return `${META_APP_PREVIEW_URL}?meta_ref=${encodeURIComponent(token)}`;
}

function isMetaAppPreviewUrl(value = '') {
    try {
        const url = new URL(String(value || ''));
        return url.origin === 'https://plantbased-balance.org'
            && url.pathname === '/meta-app-preview.html';
    } catch (_) {
        return false;
    }
}

module.exports = {
    META_APP_PREVIEW_URL,
    DEFAULT_TTL_MS,
    signingSecret,
    createMetaAppPreviewRef,
    verifyMetaAppPreviewRef,
    buildMetaAppPreviewUrl,
    isMetaAppPreviewUrl,
};
