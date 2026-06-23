const assert = require('assert');

const audit = require('../netlify/functions/story-comment-quality-audit')._test;

const direct = audit.classifyReplyConfusion({
    outboundText: 'how was the session?',
    replyText: 'what do you mean?',
});
assert.strictEqual(direct.signal, 'direct_confusion_reply');
assert.strictEqual(direct.priority, 'high');

const normal = audit.classifyReplyConfusion({
    outboundText: 'how was the session?',
    replyText: 'haha it was good thank you',
});
assert.strictEqual(normal, null);

const wrongPet = audit.classifyReplyConfusion({
    outboundText: 'oh so cute, whats their name?',
    replyText: 'not my dog sorry, I just shared it',
});
assert.strictEqual(wrongPet.signal, 'wrong_story_context_reply');

const awkward = audit.classifyReplyConfusion({
    outboundText: 'where was that taken?',
    replyText: 'do I know you? bit random',
});
assert.strictEqual(awkward.signal, 'awkward_or_random_reply');
assert.strictEqual(awkward.priority, 'medium');

const outbounds = [
    {
        id: 'out-1',
        thread_id: 'thread-1',
        text: 'how was the session?',
        created_at: '2026-06-22T08:00:00.000Z',
    },
    {
        id: 'out-2',
        thread_id: 'thread-1',
        text: 'all good',
        created_at: '2026-06-22T09:00:00.000Z',
    },
];

const firstFlag = audit.firstFlaggedReplyAfter({
    outbound: outbounds[0],
    outboundMessages: outbounds,
    inboundMessages: [
        {
            id: 'in-1',
            thread_id: 'thread-1',
            direction: 'in',
            text: 'haha',
            created_at: '2026-06-22T08:10:00.000Z',
        },
        {
            id: 'in-2',
            thread_id: 'thread-1',
            direction: 'in',
            text: 'wdym?',
            created_at: '2026-06-22T08:11:00.000Z',
        },
        {
            id: 'in-3',
            thread_id: 'thread-1',
            direction: 'in',
            text: 'what?',
            created_at: '2026-06-22T09:10:00.000Z',
        },
    ],
    now: new Date('2026-06-22T10:00:00.000Z'),
});
assert.strictEqual(firstFlag.reply.id, 'in-2');
assert.strictEqual(firstFlag.classification.signal, 'direct_confusion_reply');

const afterNextOutbound = audit.firstFlaggedReplyAfter({
    outbound: outbounds[0],
    outboundMessages: outbounds,
    inboundMessages: [{
        id: 'in-after',
        thread_id: 'thread-1',
        direction: 'in',
        text: 'what do you mean?',
        created_at: '2026-06-22T09:10:00.000Z',
    }],
    now: new Date('2026-06-22T10:00:00.000Z'),
});
assert.strictEqual(afterNextOutbound, null, 'a later reply after another outbound should not be pinned to the story comment');

const finding = audit.buildFinding({
    outbound: {
        id: 'out-1',
        alert_id: 'alert-1',
        thread_id: 'thread-1',
        text: 'how was the session?',
        created_at: '2026-06-22T08:00:00.000Z',
    },
    reply: {
        id: 'in-2',
        thread_id: 'thread-1',
        text: 'wdym?',
        created_at: '2026-06-22T08:11:00.000Z',
    },
    classification: direct,
    alert: {
        id: 'alert-1',
        client_name: 'fitlead',
        description: 'A gym class story.',
        data: {
            ig_username: 'fitlead',
            story_id: 'story-1',
            story_url: 'https://www.instagram.com/stories/fitlead/story-1',
            story_description: 'A gym class story.',
        },
    },
    thread: { id: 'thread-1', ig_username: 'fitlead' },
});
assert.strictEqual(finding.ig_username, 'fitlead');
assert.ok(finding.issue_key.includes('out-1'));
assert.strictEqual(finding.priority, 'high');

const summary = audit.summarizeFindings([finding], { dateKey: '2026-06-23' });
assert.match(summary.text, /Story comment relevance audit/);
assert.match(summary.text, /Comment: "how was the session\?"/);
assert.strictEqual(summary.counts.high, 1);

const alert = audit.buildAuditAlert({
    coachId: 'coach-1',
    findings: [finding],
    dateKey: '2026-06-23',
    now: new Date('2026-06-23T00:00:00.000Z'),
});
assert.strictEqual(alert.client_name, 'Story Comment Audit');
assert.strictEqual(alert.data.operator_queue, 'needs_you');
assert.strictEqual(alert.data.needs_you_required, true);
assert.strictEqual(alert.data.findings[0].reply_message_id, 'in-2');

console.log('story comment quality audit tests passed');
