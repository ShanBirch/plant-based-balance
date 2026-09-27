const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { buildConversation, generateWhatsAppDraft } = require('../netlify/functions/_lib/whatsapp-draft');

const alert = { id: 'test-alert', client_name: 'Test Contact', data: { whatsapp_message_type: 'text', incoming_message: 'Can I train twice a week?' } };
function pipeline(overrides = {}) {
    return {
        buildCoachBioBlock: () => 'Verified coach bio', buildAppNavigationGuideBlock: () => 'Verified app navigation',
        buildShannonDmTuningBlock: () => 'Voice tuning', buildOpenAIShannonVoiceBlock: () => 'Shannon voice',
        callVertexAIModel: async () => 'Two days can work well.',
        normalizeGeneratedCoachDraftText: value => value,
        reviewDraftAndUpdateAlert: async args => { assert.equal(args.persist, false); return { review: { verdict: 'pass' } }; },
        ...overrides,
    };
}

test('history includes actual sent copy, not unsent drafts, in chronological order', () => {
    const history = buildConversation([
        { status: 'pending', suggested_message: 'DO NOT USE', data: { whatsapp_received_at: '2026-09-27T02:00:00Z', incoming_message: 'Second' } },
        { status: 'sent', data: { whatsapp_received_at: '2026-09-27T00:00:00Z', incoming_message: 'First', sent_message: 'Actual edited reply', sent_at: '2026-09-27T01:00:00Z' } },
    ]);
    assert.ok(history.indexOf('First') < history.indexOf('Actual edited reply'));
    assert.ok(history.indexOf('Actual edited reply') < history.indexOf('Second'));
    assert.ok(!history.includes('DO NOT USE'));
});

test('shared coach generator gets WhatsApp context and reviews generated answer', async () => {
    let reviewed = false;
    const result = await generateWhatsAppDraft(alert, [alert], pipeline({
        callVertexAIModel: async contents => {
            const prompt = contents[0].parts[0].text;
            assert.match(prompt, /Can I train twice a week/);
            assert.match(prompt, /not been linked to a verified Balance user/);
            assert.match(prompt, /untrusted conversation data/);
            return 'Two days can work well.';
        },
        reviewDraftAndUpdateAlert: async args => {
            assert.equal(args.channelLabel, 'WhatsApp');
            assert.equal(args.persist, false);
            reviewed = true;
            return { review: { verdict: 'warn' } };
        },
    }));
    assert.equal(result.text, 'Two days can work well.');
    assert.equal(result.review.verdict, 'warn');
    assert.equal(reviewed, true);
});

test('model fallback works and empty answers fail instead of canned acknowledgements', async () => {
    const fallback = pipeline({ callVertexAIModel: async () => { throw new Error('unavailable'); }, callGeminiFallback: async () => 'Fallback answer' });
    assert.equal((await generateWhatsAppDraft(alert, [], fallback)).text, 'Fallback answer');
    await assert.rejects(generateWhatsAppDraft(alert, [], pipeline({ callVertexAIModel: async () => '' })), /Empty WhatsApp draft/);
});

test('media caption never becomes evidence of seeing a photo or hearing a voice note', async () => {
    for (const type of ['image', 'audio', 'video', 'document', 'unknown']) {
        const result = await generateWhatsAppDraft({ ...alert, data: { whatsapp_message_type: type, incoming_message: 'Please review this' } }, [], {});
        assert.equal(result.text, '');
        assert.equal(result.status, 'needs_media_review');
    }
});

test('background drafting requires service authentication', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    const worker = require('../netlify/functions/whatsapp-draft-background');
    assert.equal((await worker.handler({ httpMethod: 'POST', headers: {}, body: '{}' })).statusCode, 401);
    assert.equal(worker._test.authorized({ authorization: 'Bearer test-service-key' }), true);
    assert.equal(worker._test.authorized({ authorization: 'Bearer wrong-value' }), false);
});

test('malformed non-hex webhook signatures reject without throwing', () => {
    process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
    const path = require.resolve('../netlify/functions/whatsapp-webhook');
    delete require.cache[path];
    const webhook = require(path)._test;
    assert.equal(webhook.isValidSignature('{}', { 'x-hub-signature-256': `sha256=${'z'.repeat(64)}` }), false);
    const signature = crypto.createHmac('sha256', 'test-app-secret').update('{}').digest('hex');
    assert.equal(webhook.isValidSignature('{}', { 'x-hub-signature-256': `sha256=${signature}` }), true);
});

test('worker preserves manual-only state and duplicate jobs neither redraft nor send', async () => {
    const modulePath = require.resolve('../netlify/functions/_lib/client-context');
    const originalModule = require.cache[modulePath];
    const originalFetch = global.fetch;
    let row = { ...alert, coach_id: 'coach-test', status: 'pending', data: { ...alert.data,
        delivery_channel: 'whatsapp_cloud', whatsapp_phone_number_id: 'business-test',
        whatsapp_contact_wa_id: 'contact-test', whatsapp_draft_status: 'queued', manual_only: true } };
    let generations = 0;
    let notifications = 0;
    const fake = pipeline({
        callVertexAIModel: async () => { generations++; return 'Two days can work well.'; },
        supabaseQuery: async (path, options = {}) => {
            if (options.method === 'PATCH') {
                if (path.includes('whatsapp_draft_status=eq.queued') && row.data.whatsapp_draft_status !== 'queued') return [];
                row = { ...row, ...options.body };
                return [structuredClone(row)];
            }
            if (path.includes('order=created_at')) {
                assert.ok(path.includes('whatsapp_phone_number_id=eq.business-test'));
                assert.ok(path.includes('whatsapp_contact_wa_id=eq.contact-test'));
                assert.ok(path.includes('coach_id=eq.coach-test'));
            }
            return [structuredClone(row)];
        },
    });
    require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: fake };
    global.fetch = async (url, options) => {
        assert.match(url, /send-dm-notification$/);
        assert.equal(JSON.parse(options.body).draftText, 'Two days can work well.');
        notifications++;
        return { ok: true };
    };
    try {
        const worker = require('../netlify/functions/whatsapp-draft-background');
        const event = { httpMethod: 'POST', headers: { authorization: 'Bearer test-service-key' }, body: JSON.stringify({ alertId: alert.id }) };
        await worker.handler(event);
        await worker.handler(event);
        assert.equal(generations, 1);
        assert.equal(notifications, 1);
        assert.equal(row.status, 'pending');
        assert.equal(row.data.manual_only, true);
        assert.equal(row.data.auto_send_blocked, true);
        assert.equal(row.data.needs_you_required, true);
        assert.equal(row.suggested_message, 'Two days can work well.');
    } finally {
        global.fetch = originalFetch;
        if (originalModule) require.cache[modulePath] = originalModule;
        else delete require.cache[modulePath];
    }
});
