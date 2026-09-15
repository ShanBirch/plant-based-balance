const test = require('node:test');
const assert = require('node:assert/strict');
const { sendRejectedMediaWithRetry, persistReviewHold } = require('../netlify/functions/_lib/ig-media-recovery');
const { deliveredPrefix } = require('../netlify/functions/_lib/ig-media-recovery');
const { hasIncompleteDelivery } = require('../netlify/functions/_lib/ig-media-recovery');

test('cleanup must not mistake an intro for a complete media reply', () => {
    for (const data of [
        {send_claim_id:'in-progress'},
        {chunks_sent:1,chunks_total:3},
        {last_send_error:'image rejected'},
        {auto_send_review_hold:{code:'immediate_dispatch_failed'}},
        {draft_image_attachment_url:'proof.png'},
        {draft_video_attachment_url:'course.mp4'},
    ]) assert.equal(hasIncompleteDelivery(data), true);
    assert.equal(hasIncompleteDelivery({chunks_sent:3,chunks_total:3}), false);
    assert.equal(hasIncompleteDelivery({}), false);
});

test('partial retry resumes after the canonically confirmed introduction', () => {
    const items = [{kind:'text',text:'Intro'}, {kind:'image',text:'[IMAGE:proof.png]'}, {kind:'text',text:'Question?'}];
    const rows = [{id:'receipt',text:'Intro',manychat_message_id:'ig_graph:confirmed-id'}];
    const recovered = deliveredPrefix(items, rows, 'ig_graph:');
    assert.equal(recovered.length, 1);
    assert.equal(recovered[0].response.message_id, 'confirmed-id');
    assert.deepEqual(recovered[0].canonicalMessages, rows);
    assert.deepEqual(items.slice(recovered.length).map(x => x.kind), ['image','text']);
    assert.throws(() => deliveredPrefix([{kind:'text',text:'Edited intro'}], rows, 'ig_graph:'), /manual review/);
    assert.throws(() => deliveredPrefix(items, [{text:'Intro'}], 'ig_graph:'), /manual review/);
    assert.throws(() => deliveredPrefix(items, [{text:'[IMAGE:proof.png]',manychat_message_id:'ig_graph:x'}], 'ig_graph:'), /manual review/);
});

test('explicit transient rejection retries only the failed photo then permits the following question', async () => {
    const sent = ['intro'];
    const waits = [];
    let calls = 0;
    await sendRejectedMediaWithRetry(async () => {
        if (++calls === 1) throw Object.assign(new Error('provider rejected photo'), { retryableMediaRejection: true });
        sent.push('photo');
        return { message_id: 'photo-id' };
    }, async ms => waits.push(ms));
    sent.push('question');
    assert.deepEqual(sent, ['intro', 'photo', 'question']);
    assert.deepEqual(waits, [2000]);
    assert.equal(calls, 2);
});

test('repeated explicit failures stop after three attempts', async () => {
    let calls = 0;
    await assert.rejects(sendRejectedMediaWithRetry(async () => {
        calls++;
        throw Object.assign(new Error('unavailable'), { retryableMediaRejection: true });
    }, async () => {}), /unavailable/);
    assert.equal(calls, 3);
});

for (const failure of ['network timeout', 'credits exhausted', 'permission denied', 'invalid image']) {
    test(`does not replay ${failure}`, async () => {
        let calls = 0;
        await assert.rejects(sendRejectedMediaWithRetry(async () => {
            calls++;
            throw new Error(failure);
        }, async () => assert.fail('must not wait/retry')), new RegExp(failure));
        assert.equal(calls, 1);
    });
}

test('holding a failed send preserves receipts and provider error rather than stale draft data', async () => {
    const fresh = { chunks_sent: 1, sent_chunks: ['intro'], last_send_error: 'Graph image 500', draft_text: 'current' };
    const writes = [];
    const result = await persistReviewHold({ alertId: 'test', fallbackData: { draft_text: 'old' }, hold: { code: 'failed' },
        query: async (url, options) => options ? writes.push({ url, options }) : [{ status: 'pending', data: fresh }],
    });
    assert.equal(result.chunks_sent, 1);
    assert.equal(result.last_send_error, 'Graph image 500');
    assert.equal(result.draft_text, 'current');
    assert.deepEqual(result.sent_chunks, ['intro']);
    assert.match(writes[0].url, /status=eq.pending&data->>send_claim_id=is.null/);
});

for (const row of [{ status: 'sent', data: { complete: true } }, { status: 'pending', data: { send_claim_id: 'active' } }]) {
    test(`hold cannot overwrite ${row.status === 'sent' ? 'completed delivery' : 'an active sender'}`, async () => {
        const result = await persistReviewHold({ alertId: 'test', hold: { code: 'failed' },
            query: async (url, options) => { assert.equal(options, undefined); return [row]; },
        });
        assert.deepEqual(result, row.data);
    });
}
