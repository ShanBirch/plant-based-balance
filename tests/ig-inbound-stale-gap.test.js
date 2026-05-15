const assert = require('assert');

const { selectRecentInboundSinceLastReplyIg } = require('../netlify/functions/_lib/client-context');

const recent = selectRecentInboundSinceLastReplyIg({
    currentCreatedAt: '2026-05-15T12:00:00.000Z',
    history: [
        { direction: 'out', text: 'old reply', created_at: '2026-05-10T00:00:00.000Z' },
        { direction: 'in', text: 'stale topic', created_at: '2026-05-12T00:00:00.000Z' },
        { direction: 'in', text: 'current topic', created_at: '2026-05-15T11:55:00.000Z' },
    ],
});

assert.deepStrictEqual(recent.map(m => m.text), ['current topic']);

console.log('ig inbound stale gap tests passed');
