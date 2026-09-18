const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(name, query) {
    const context = { exports: {}, console, require() { return { supabaseQuery: query }; } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../netlify/functions', name), 'utf8'), context);
    return context.exports.handler;
}

test('coach assignment keeps signup context without sending or queuing a welcome text', async () => {
    const calls = [];
    const handler = load('onboarding-welcome-draft.js', async (url, options) => {
        calls.push({ url, options });
        if (url.startsWith('users?')) return [{ email: 'new@example.com' }];
        if (url.startsWith('cohort_invitations?')) return [{ about_me: 'My signup goal' }];
        return [];
    });
    const result = await handler({ httpMethod: 'POST', body: JSON.stringify({ coachId: 'coach', clientId: 'client' }) });
    assert.equal(JSON.parse(result.body).auto_sent, false);
    const writes = calls.filter(call => call.options?.method);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, 'client_memory');
    assert.equal(writes[0].options.body[0].personal_context, 'My signup goal');
});

test('old app welcome endpoint cannot send even when retried', async () => {
    const handler = load('send-welcome-message.js', () => { throw Error('Unexpected database access'); });
    for (let attempt = 0; attempt < 2; attempt++) {
        const result = await handler({ httpMethod: 'POST', body: '{"newUserId":"client"}' });
        assert.equal(result.statusCode, 200);
        assert.equal(JSON.parse(result.body).skipped, 'video_welcome_replaces_text');
    }
});
