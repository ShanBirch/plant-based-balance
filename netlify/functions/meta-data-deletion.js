const crypto = require('crypto');

const SITE_URL = 'https://plantbased-balance.org';

const jsonHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
};

function json(statusCode, body) {
    return {
        statusCode,
        headers: jsonHeaders,
        body: JSON.stringify(body),
    };
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

    const appSecret = process.env.META_APP_SECRET || process.env.META_IG_APP_SECRET || '';
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

function readSignedRequest(event) {
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
    const body = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8')
        : (event.body || '');

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

exports.handler = async function handler(event, context) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: jsonHeaders, body: '' };
    }

    if (event.httpMethod === 'GET') {
        return json(200, {
            service: 'Balance Meta data deletion callback',
            status: 'ready',
            contact: 'shannon@plantbased-balance.org',
            instructions_url: `${SITE_URL}/data-deletion.html`,
        });
    }

    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'method_not_allowed' });
    }

    const signedRequest = readSignedRequest(event);
    const parsed = parseSignedRequest(signedRequest);

    if (!parsed.data) {
        return json(400, { error: parsed.error || 'invalid_request' });
    }

    if (parsed.error === null && !parsed.verified) {
        return json(403, { error: 'invalid_signature' });
    }

    const code = confirmationCode(parsed.data.user_id, context.awsRequestId);

    console.log('[meta-data-deletion] request received', {
        confirmation_code: code,
        signed_request_verified: parsed.verified,
        meta_user_id_present: Boolean(parsed.data.user_id),
    });

    return json(200, {
        url: `${SITE_URL}/data-deletion.html?code=${encodeURIComponent(code)}`,
        confirmation_code: code,
    });
};
