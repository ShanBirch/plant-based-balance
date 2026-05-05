/**
 * analyze-coach-edit
 *
 * Admin-dashboard direct sends use this capability-token endpoint to run the
 * same edit-learning loop as the server-side send functions.
 */

const {
    analyzeCoachEditAndUpdatePrompt,
    normalizeCoachDraftText,
} = require('./_lib/client-context');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (_) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const alertId = String(body.alertId || '').trim();
    const draftText = normalizeCoachDraftText(body.draftText || '').trim();
    const sentMessage = normalizeCoachDraftText(body.sentMessage || body.replyText || '').trim();
    const source = String(body.source || 'unknown').trim().slice(0, 80);

    if (!alertId || !sentMessage) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing alertId or sentMessage' }) };
    }

    try {
        const result = await analyzeCoachEditAndUpdatePrompt({
            alertId,
            draftText,
            sentMessage,
            source,
        });
        return { statusCode: 200, body: JSON.stringify(result) };
    } catch (err) {
        console.error('[analyze-coach-edit] failed:', err.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Edit analysis failed', details: err.message }),
        };
    }
};
