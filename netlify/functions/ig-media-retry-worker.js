const { supabaseQuery } = require('./_lib/client-context');
const { processMessageMedia } = require('./ig-media-process-background');

const STALE_PROCESSING_MS = 10 * 60 * 1000;

exports.handler = async () => {
    const now = new Date().toISOString();
    const stale = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
    const rows = await supabaseQuery(
        `ig_message_media?select=id,ig_message_id,status,next_attempt_at,processing_started_at&or=(and(status.in.(received,retry_wait),next_attempt_at.lte.${encodeURIComponent(now)}),and(status.eq.processing,processing_started_at.lte.${encodeURIComponent(stale)}))&order=created_at.asc&limit=12`
    );
    const messageIds = [...new Set(rows.map(row => row.ig_message_id).filter(Boolean))];
    let recoveredStale = 0;
    for (const row of rows.filter(item => item.status === 'processing')) {
        await supabaseQuery(`ig_message_media?id=eq.${encodeURIComponent(row.id)}&status=eq.processing`, {
            method: 'PATCH',
            body: {
                status: 'retry_wait',
                next_attempt_at: now,
                processing_token: null,
                last_error: 'stale media-processing lease recovered',
            },
        });
        recoveredStale++;
    }

    let processedMessages = 0;
    let dispatched = 0;
    for (const messageId of messageIds) {
        const result = await processMessageMedia(messageId);
        processedMessages++;
        if (result.dispatched) dispatched++;
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ processedMessages, dispatched, recoveredStale }),
    };
};
