/**
 * Background wrapper for dashboard-approved IG/FB sends.
 *
 * Large replies intentionally pause roughly 12-24 seconds between bubbles,
 * scaled by message length. Running that through a background function keeps
 * Shannon's dashboard and Netlify's regular function budget from timing out
 * while the messages are still going.
 */

const { handler: sendIgReply } = require('./send-ig-reply');

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    payload.deliveryPacing = payload.deliveryPacing || 'human_long_reply_v1';

    return sendIgReply({
        ...event,
        body: JSON.stringify(payload),
    });
};
