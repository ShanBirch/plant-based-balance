const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sendIg = require('../netlify/functions/send-ig-reply')._test;
const { splitCoachDraftIntoDmBubbles } = require('../netlify/functions/_lib/client-context');

test('Instagram Graph replies split below the native 250-character visible cutoff', () => {
    const text = 'Inside Balance, the six-week course works like this: each week you get your learning plus clear weekly goals so you know exactly what to focus on. Then you have a coaching review where we look at what happened in real life and adjust your food and workouts for the next week so it stays doable and effective. What usually gets in the way when you try to stay consistent?';
    const options = sendIg.resolveOutboundDmBubbleOptions({
        shouldUseGraph: true,
        channel: 'instagram',
    });
    const bubbles = splitCoachDraftIntoDmBubbles([text], options);

    assert.ok(bubbles.length >= 2);
    assert.ok(bubbles.every(bubble => bubble.length <= 240));
    assert.match(bubbles[0], /[.!?]$/);
    assert.equal(bubbles.join(' ').replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim());
    assert.deepEqual(sendIg.resolveOutboundDmBubbleOptions({
        shouldUseGraph: false,
        channel: 'instagram',
    }), {});
});

test('voice companion text is restricted to the approved paid Meta app preview', () => {
    const previewUrl = 'https://plantbased-balance.org/meta-app-preview.html';
    const data = {
        voice_companion_text: `Here you go — have a quick look here: ${previewUrl}`,
        paid_meta_app_preview_handoff: true,
        paid_meta_app_preview_url: previewUrl,
    };
    assert.equal(sendIg.resolveApprovedVoiceCompanionText(data, true), data.voice_companion_text);
    const signedPreviewUrl = `${previewUrl}?meta_ref=signed-preview-reference`;
    const signedData = {
        ...data,
        voice_companion_text: `Here you go — have a quick look here: ${signedPreviewUrl}`,
        paid_meta_app_preview_url: signedPreviewUrl,
    };
    assert.equal(sendIg.resolveApprovedVoiceCompanionText(signedData, true), signedData.voice_companion_text);
    assert.equal(sendIg.resolveApprovedVoiceCompanionText(data, false), '');
    assert.equal(sendIg.resolveApprovedVoiceCompanionText({
        ...data,
        voice_companion_text: `${data.voice_companion_text} https://example.com`,
    }, true), '');
    assert.equal(sendIg.resolveApprovedVoiceCompanionText({
        ...data,
        paid_meta_app_preview_handoff: false,
    }, true), '');
});

test('voice companion follows promptly enough for the sender to retain its production receipt', () => {
    assert.equal(sendIg.resolveOutboundItemGapMs({
        index: 1,
        outboundItems: [{ kind: 'audio' }, { kind: 'text' }],
        plannedChunkGapsMs: [9500],
        chunkPacing: { minMs: 4200 },
    }), 1800);
    assert.equal(sendIg.resolveOutboundItemGapMs({
        index: 1,
        outboundItems: [{ kind: 'text' }, { kind: 'text' }],
        plannedChunkGapsMs: [6500],
        chunkPacing: { minMs: 4200 },
    }), 6500);
});

test('paid Meta voice keeps its approved thought paragraphs through DM bubble splitting', () => {
    const source = 'First thought.\n\nSecond thought.\n\nThird thought.';
    assert.deepEqual(sendIg.resolveVoiceSourceMessages({
        outbound_voice_message: true,
        scheduled_was_edited: false,
        outbound_voice_source_text: source,
    }, ['First thought.\nSecond thought.', 'Third thought.']), [source]);
    assert.deepEqual(sendIg.resolveVoiceSourceMessages({
        outbound_voice_message: true,
        scheduled_was_edited: true,
        outbound_voice_source_text: source,
    }, ['Shannon edited this.']), ['Shannon edited this.']);
    assert.deepEqual(sendIg.resolveVoiceSourceMessages({
        outbound_voice_message: true,
        outbound_voice_message_reason: 'lead_shared_consistency_blocker',
        scheduled_was_edited: false,
        outbound_voice_source_text: `Hey, how are ya.\n\n${source}`,
    }, ['First thought.\nSecond thought.', 'Third thought.']), [`Hey, how are ya.\n\n${source}`]);
    assert.deepEqual(sendIg.resolveVoiceSourceMessages({
        scheduled_was_edited: false,
        outbound_voice_source_text: `Hey, how are ya.\n\n${source}`,
    }, ['Normalized bubble text.']), [`Hey, how are ya.\n\n${source}`]);
});

test('final automated send gate sees a newer manual outbound', async () => {
    const originalFetch = global.fetch;
    try {
        global.fetch = async (url) => {
            assert.match(String(url), /ig_messages\?select=id,direction,text,created_at,alert_id/);
            assert.match(String(url), /thread_id=eq\.thread-1/);
            assert.match(String(url), /created_at=gt\.2026-07-29T08%3A39%3A30\.000Z/);
            return {
                ok: true,
                text: async () => JSON.stringify([{
                    id: 'manual-outbound',
                    direction: 'out',
                    created_at: '2026-07-29T08:40:00.000Z',
                    alert_id: null,
                }]),
            };
        };
        const delta = await sendIg.getAutomatedInstagramConversationDelta({
            alert: { created_at: '2026-07-29T08:41:00.000Z' },
            alertData: {
                ig_thread_id: 'thread-1',
                scheduled_via: 'auto_send',
                source_inbound_created_at: '2026-07-29T08:39:30.000Z',
            },
            source: 'scheduled_worker',
        });
        assert.equal(delta.id, 'manual-outbound');
        assert.equal(delta.direction, 'out');
    } finally {
        global.fetch = originalFetch;
    }
});

test('scheduled worker transports reply and draft text as UTF-8 Base64', () => {
    const source = fs.readFileSync(path.join(
        __dirname,
        '../netlify/functions/scheduled-coach-reply-worker.js'
    ), 'utf8');
    assert.match(source, /replyTextUtf8Base64:\s*Buffer\.from\(replyText, 'utf8'\)\.toString\('base64'\)/);
    assert.match(source, /draftTextUtf8Base64:\s*Buffer\.from\(draftText, 'utf8'\)\.toString\('base64'\)/);
});

test('the sender restores its full receipt when its own Graph echo wins the status race', () => {
    const source = fs.readFileSync(path.join(
        __dirname,
        '../netlify/functions/send-ig-reply.js'
    ), 'utf8');
    assert.match(source, /status=eq\.sent&data->>send_claim_id=eq\.\$\{encodeURIComponent\(sendClaimId\)\}&data->>sent_via=eq\.instagram_graph_echo/);
    assert.match(source, /body: \{ actioned_at: sentAtIso, data: mergedData \}/);
});
