import crypto from 'node:crypto';

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

function verifySignedRequest(signedRequest) {
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
    const provided = Buffer.from(encodedSignature);
    const expected = Buffer.from(expectedSignature);

    return {
        data,
        verified: provided.length === expected.length && crypto.timingSafeEqual(provided, expected),
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

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: jsonHeaders });
    }

    if (req.method === 'GET') {
        return json({
            service: 'Balance Meta deauthorize callback',
            status: 'ready',
        });
    }

    if (req.method !== 'POST') {
        return json({ error: 'method_not_allowed' }, 405);
    }

    const signedRequest = await readSignedRequest(req);
    const parsed = verifySignedRequest(signedRequest);

    if (!parsed.data) {
        return json({ error: parsed.error || 'invalid_request' }, 400);
    }

    if (parsed.error === null && !parsed.verified) {
        return json({ error: 'invalid_signature' }, 403);
    }

    console.log('[meta-deauthorize] request received', {
        signed_request_verified: parsed.verified,
        meta_user_id_present: Boolean(parsed.data.user_id),
    });

    return json({ success: true });
}

export const config = {
    path: '/api/meta/deauthorize',
    method: ['GET', 'POST', 'OPTIONS'],
};
