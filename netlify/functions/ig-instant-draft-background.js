/**
 * Background wrapper for IG/FB instant DM drafts.
 *
 * manychat-inbound needs to return quickly so ManyChat does not retry the
 * webhook, but the draft producer can take longer than the webhook function's
 * life. Netlify background functions acknowledge the request immediately and
 * keep running after the caller returns.
 */

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const response = await fetch(`${SITE_URL}/.netlify/functions/ig-instant-draft`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: event.body || '{}',
        });
        const text = await response.text();
        return {
            statusCode: response.status,
            body: text || JSON.stringify({ ok: response.ok }),
        };
    } catch (error) {
        console.error('[ig-instant-draft-background] dispatch failed:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'draft_dispatch_failed', details: error.message }),
        };
    }
};
