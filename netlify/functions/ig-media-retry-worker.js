const { supabaseQuery } = require('./_lib/client-context');
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

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

    let dispatched = 0;
    let dispatchErrors = 0;
    for (const messageId of messageIds) {
        // The scheduled function has only 30 seconds. Transcription belongs in
        // the existing background worker, whose atomic media claims also guard
        // overlapping webhook/recovery invocations. Leave failed dispatches due
        // so the next minute can recover them without losing any work.
        try {
            const response = await fetch(`${SITE_URL}/.netlify/functions/ig-media-process-background`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ igMessageId: messageId }),
                signal: AbortSignal.timeout(1500),
            });
            if (!response.ok) throw new Error(`media recovery dispatch HTTP ${response.status}`);
            dispatched++;
        } catch (error) {
            dispatchErrors++;
            console.error('[ig-media-retry-worker] background dispatch failed:', error.message);
        }
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ dispatched, dispatchErrors, recoveredStale }),
    };
};
