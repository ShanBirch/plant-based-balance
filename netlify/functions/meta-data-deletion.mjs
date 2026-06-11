import crypto from 'node:crypto';

const SITE_URL = 'https://plantbased-balance.org';

const jsonHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
};

function getEnv(name) {
    return globalThis.Netlify?.env?.get?.(name) || '';
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: jsonHeaders,
    });
}

function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return Buffer.from(padded, 'base64');
}

function timingSafeEqual(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseSignedRequest(signedRequest) {
    if (!signedRequest || !signedRequest.includes('.')) {
        return { data: null, verified: false, error: 'missing_signed_request' };
    }

    const [encodedSignature, encodedPayload] = signedRequest.split('.', 2);
    let data = null;

    try {
        data = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8'));
    } catch {
        return { data: null, verified: false, error: 'invalid_signed_request_payload' };
    }

    const appSecret = getEnv('META_APP_SECRET') || getEnv('META_IG_APP_SECRET');
    if (!appSecret) {
        return { data, verified: false, error: 'missing_app_secret' };
    }

    const expectedSignature = crypto
        .createHmac('sha256', appSecret)
        .update(encodedPayload)
        .digest('base64url');

    return {
        data,
        verified: timingSafeEqual(encodedSignature, expectedSignature),
        error: null,
    };
}

async function readSignedRequest(req) {
    const contentType = req.headers.get('content-type') || '';
    const body = await req.text();

    if (!body) return '';

    if (contentType.includes('application/json')) {
        try {
            const parsed = JSON.parse(body);
            return String(parsed.signed_request || parsed.signedRequest || '');
        } catch {
            return '';
        }
    }

    const params = new URLSearchParams(body);
    return params.get('signed_request') || params.get('signedRequest') || '';
}

function confirmationCode(metaUserId, requestId) {
    const seed = `${metaUserId || 'meta'}:${requestId || Date.now()}`;
    return `BAL-${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12).toUpperCase()}`;
}

export default async function handler(req, context) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: jsonHeaders });
    }

    if (req.method === 'GET') {
        return json({
            service: 'Balance Meta data deletion callback',
            status: 'ready',
            contact: 'shannon@plantbased-balance.org',
            instructions_url: `${SITE_URL}/data-deletion.html`,
        });
    }

    if (req.method !== 'POST') {
        return json({ error: 'method_not_allowed' }, 405);
    }

    const signedRequest = await readSignedRequest(req);
    const parsed = parseSignedRequest(signedRequest);

    if (!parsed.data) {
        return json({ error: parsed.error || 'invalid_request' }, 400);
    }

    if (parsed.error === null && !parsed.verified) {
        return json({ error: 'invalid_signature' }, 403);
    }

    const code = confirmationCode(parsed.data.user_id, context.requestId);

    console.log('[meta-data-deletion] request received', {
        confirmation_code: code,
        signed_request_verified: parsed.verified,
        meta_user_id_present: Boolean(parsed.data.user_id),
    });

    return json({
        url: `${SITE_URL}/data-deletion.html?code=${encodeURIComponent(code)}`,
        confirmation_code: code,
    });
}

export const config = {
    path: '/api/meta/data-deletion',
    method: ['GET', 'POST', 'OPTIONS'],
};
