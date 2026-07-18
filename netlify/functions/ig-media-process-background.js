const {
    claimMediaRow,
    processClaimedMedia,
    loadMediaForMessage,
    buildDurableDraftPayload,
    markDraftDispatchStarted,
    markDraftDispatchFailed,
} = require('./_lib/ig-message-media');

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

async function dispatchDraft(payload) {
    const response = await fetch(`${SITE_URL}/.netlify/functions/ig-instant-draft-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`durable draft dispatch HTTP ${response.status}`);
}

async function processMessageMedia(igMessageId) {
    const rows = await loadMediaForMessage(igMessageId);
    if (!rows.length) return { processed: 0, dispatched: false, reason: 'no_media_rows' };

    let processed = 0;
    for (const row of rows) {
        if (!['received', 'retry_wait'].includes(row.status)) continue;
        if (row.next_attempt_at && Date.parse(row.next_attempt_at) > Date.now()) continue;
        const claimed = await claimMediaRow(row);
        if (!claimed) continue;
        await processClaimedMedia(claimed);
        processed++;
    }

    const payload = await buildDurableDraftPayload(igMessageId);
    if (!payload) return { processed, dispatched: false, reason: 'media_not_ready' };
    await markDraftDispatchStarted(payload.durableMediaIds);
    try {
        await dispatchDraft(payload);
    } catch (error) {
        await markDraftDispatchFailed(payload.durableMediaIds, error.message);
        throw error;
    }
    return { processed, dispatched: true };
}

exports.handler = async event => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }
    if (!body.igMessageId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing igMessageId' }) };
    }
    const result = await processMessageMedia(body.igMessageId);
    return { statusCode: 200, body: JSON.stringify(result) };
};

module.exports.processMessageMedia = processMessageMedia;
