const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

exports.handler = async () => {
    const response = await fetch(
        `${SITE_URL}/.netlify/functions/extract-ig-thread-memory-background`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        }
    );
    if (!response.ok) {
        const detail = await response.text();
        console.error(`[ig-memory-schedule] background dispatch failed: ${response.status} ${detail.slice(0, 500)}`);
        return {
            statusCode: 500,
            body: JSON.stringify({ dispatched: false, status: response.status }),
        };
    }
    return {
        statusCode: 200,
        body: JSON.stringify({ dispatched: true, relationship_memory_version: 2 }),
    };
};
