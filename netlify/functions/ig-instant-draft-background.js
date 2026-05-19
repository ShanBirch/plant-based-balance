/**
 * Background wrapper for IG/FB instant DM drafts.
 *
 * manychat-inbound needs to return quickly so ManyChat does not retry the
 * webhook, but the draft producer can take longer than the webhook function's
 * life. Netlify background functions acknowledge the request immediately and
 * keep running after the caller returns.
 */

const { handler: runIgInstantDraft } = require('./ig-instant-draft');

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        return await runIgInstantDraft(event);
    } catch (error) {
        console.error('[ig-instant-draft-background] dispatch failed:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'draft_dispatch_failed', details: error.message }),
        };
    }
};
