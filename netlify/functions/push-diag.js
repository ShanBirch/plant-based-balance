/**
 * Push diagnostic endpoint.
 *
 * The custom Android CoachDraftMessagingService POSTs a heartbeat here each
 * time it handles an FCM message. Shannon's phone has no accessible logcat,
 * so this is the only way to verify from afar whether our custom service is
 * actually running vs Capacitor's default service silently winning the
 * FirebaseMessagingService slot.
 *
 * Check Netlify function logs after a test push:
 *   - heartbeat present → service is running; debug notification build
 *   - heartbeat absent  → service not running; the manifest tools:node="remove"
 *                         isn't taking effect. Fall back to notification+data
 *                         flow (current production path) for lockscreen UX.
 */
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = { raw: event.body }; }
    console.log('[push-diag]', JSON.stringify({
        at: new Date().toISOString(),
        ...body,
    }));
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
