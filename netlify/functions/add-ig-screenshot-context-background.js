/**
 * Background runner for screenshot-based IG/FB DM context backfills.
 *
 * The screenshot reader plus redraft dispatch can outlive Netlify's normal
 * request window. The foreground function validates and queues this runner so
 * the admin dashboard does not see a 504 while the useful work continues.
 */

const { handler: runScreenshotContext } = require('./add-ig-screenshot-context');

exports.handler = async (event = {}) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let body = {};
    try {
        body = event.body ? JSON.parse(event.body) : {};
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    return runScreenshotContext({
        ...event,
        body: JSON.stringify({
            ...body,
            backgroundRun: true,
        }),
    });
};
