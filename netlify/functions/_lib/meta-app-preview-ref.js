const crypto = require('node:crypto');

const META_APP_PREVIEW_URL = 'https://plantbased-balance.org/meta-app-preview.html';
const META_APP_PREVIEW_SHORT_URL = 'https://plantbased-balance.org/p';
const META_APP_PREVIEW_BROAD_URL = 'https://future-balance.netlify.app/meta-app-preview.html';
const META_APP_PREVIEW_BROAD_SHORT_URL = 'https://future-balance.netlify.app/p';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const COMPACT_REF_VERSION = 2;
const COMPACT_SIGNATURE_BYTES = 12;

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

function uuidBytes(value = '') {
    const hex = String(value || '').replace(/-/g, '');
    if (!/^[0-9a-f]{32}$/i.test(hex)) return null;
    return Buffer.from(hex, 'hex');
}

function uuidFromBytes(value) {
    const hex = Buffer.from(value).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createMetaAppPreviewRef(threadId, {
    nowMs = Date.now(),
    ttlMs = DEFAULT_TTL_MS,
    env = process.env,
} = {}) {
    const id = String(threadId || '').trim();
    const secret = signingSecret(env);
    const idBytes = uuidBytes(id);
    const expiresAtSeconds = Math.floor((nowMs + ttlMs) / 1000);
    if (!idBytes || !secret || !Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds > 0xffffffff) return '';
    const payload = Buffer.alloc(21);
    payload.writeUInt8(COMPACT_REF_VERSION, 0);
    idBytes.copy(payload, 1);
    payload.writeUInt32BE(expiresAtSeconds, 17);
    const signature = crypto.createHmac('sha256', secret).update(payload).digest().subarray(0, COMPACT_SIGNATURE_BYTES);
    return Buffer.concat([payload, signature]).toString('base64url');
}

function verifyMetaAppPreviewRef(token, {
    nowMs = Date.now(),
    env = process.env,
} = {}) {
    const value = String(token || '').trim();
    const secret = signingSecret(env);
    if (!secret || value.length > 700) return null;
    if (!value.includes('.')) {
        let compact;
        try { compact = Buffer.from(value, 'base64url'); } catch (_) { return null; }
        const payloadLength = 21;
        if (compact.length !== payloadLength + COMPACT_SIGNATURE_BYTES
            || compact.readUInt8(0) !== COMPACT_REF_VERSION) return null;
        const payload = compact.subarray(0, payloadLength);
        const signature = compact.subarray(payloadLength);
        const expected = crypto.createHmac('sha256', secret).update(payload).digest().subarray(0, COMPACT_SIGNATURE_BYTES);
        if (!crypto.timingSafeEqual(signature, expected)) return null;
        const expiresMs = payload.readUInt32BE(17) * 1000;
        const issuedMs = expiresMs - DEFAULT_TTL_MS;
        const threadId = uuidFromBytes(payload.subarray(1, 17));
        if (expiresMs <= nowMs || expiresMs > nowMs + DEFAULT_TTL_MS + 60_000) return null;
        return { threadId, issuedAt: new Date(issuedMs).toISOString(), expiresAt: new Date(expiresMs).toISOString() };
    }
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
    const broadFlow = String(options?.flowVariant || 'broad_pain').toLowerCase() === 'broad_pain';
    const previewUrl = broadFlow ? META_APP_PREVIEW_BROAD_URL : META_APP_PREVIEW_URL;
    const shortUrl = broadFlow ? META_APP_PREVIEW_BROAD_SHORT_URL : META_APP_PREVIEW_SHORT_URL;
    if (!token) return previewUrl;
    return `${shortUrl}/${encodeURIComponent(token)}`;
}

function isMetaAppPreviewUrl(value = '') {
    try {
        const url = new URL(String(value || ''));
        return ['https://plantbased-balance.org', 'https://future-balance.netlify.app'].includes(url.origin)
            && (url.pathname === '/meta-app-preview.html'
                || /^\/p\/[A-Za-z0-9_-]{20,100}\/?$/.test(url.pathname));
    } catch (_) {
        return false;
    }
}

module.exports = {
    META_APP_PREVIEW_URL,
    META_APP_PREVIEW_SHORT_URL,
    META_APP_PREVIEW_BROAD_URL,
    META_APP_PREVIEW_BROAD_SHORT_URL,
    DEFAULT_TTL_MS,
    signingSecret,
    createMetaAppPreviewRef,
    verifyMetaAppPreviewRef,
    buildMetaAppPreviewUrl,
    isMetaAppPreviewUrl,
};
