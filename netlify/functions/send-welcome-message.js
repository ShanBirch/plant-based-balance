// Retired: new members receive the onboarding coach video instead of a text DM.
// Keep the endpoint as a no-op for older installed clients and queued retries.
exports.handler = async (event) => ({
    statusCode: event.httpMethod === 'POST' ? 200 : 405,
    body: JSON.stringify(event.httpMethod === 'POST'
        ? { skipped: 'video_welcome_replaces_text', auto_sent: false }
        : { error: 'Method not allowed' }),
});