const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../netlify/functions/ig-instant-draft')._test;

test('price and home FAQ before a goal cannot jump to preview', () => {
    const history = [{direction:'out',text:"What's the main change you want in the next six weeks?"}];
    const currentMessage = "What's the price of the course? Can I do the workouts at home?";
    const draft = {chunks:["It's one AUD $149 payment for the full six weeks, with no subscription or auto-renewal. Yep, you can do the workouts at home.","If you want, I can send the free personalised app preview so you can see how it would look for you."]};
    const fixed = api.preservePaidMetaPendingBlocker({draft,history,currentMessage});
    assert.match(fixed.joined, /AUD \$149/);
    assert.match(fixed.joined, /workouts at home/);
    assert.doesNotMatch(fixed.joined, /preview/);
    assert.match(fixed.joined, /main change/);
    assert.equal(fixed.videoAttachmentUrl, null);
    assert.equal(api.preservePaidMetaPendingBlocker({draft,history,currentMessage:'Can you send the preview?'}), draft);
    const previewFact = api.preservePaidMetaPendingBlocker({draft:{chunks:['Opening the preview does not charge you.',"What's the main change you want in the next six weeks?"]},history,currentMessage:'Will opening the preview charge me?'});
    assert.match(previewFact.joined, /does not charge you/);
    assert.equal((previewFact.joined.match(/main change/g)||[]).length, 1);
});

test('direct course price openers answer without the BALANCE keyword', () => {
    for (const message of ["What's the price of the course?", 'What is the cost of the course?', 'How much is the course?', 'Can you tell me the course price?']) {
        assert.equal(api.shouldUseDeterministicMetaAdFirstReply(message), true, message);
        const reply = api.buildMetaAdFoundersPassFirstReply(message, { flowVariant: 'broad_pain' });
        assert.equal(reply.firstReplyIntent, 'price', message);
        assert.match(reply.joined, /^Hey!/);
        assert.match(reply.joined, /AUD \$/);
        assert.match(reply.joined, /no subscription or automatic renewal/);
        assert.match(reply.joined, /hoping to work towards/);
        assert.ok(reply.joined.split(/\s+/).length < 60);
        assert.equal(reply.checkoutUrl, null);
        assert.deepEqual(api.collectPaidMetaWriterContractIssues({ draft: reply, currentMessage: message, history: [], flowVariant: 'broad_pain' }), []);
    }
});

test('general course introduction stays brief while an explicit outline still gets the curriculum', () => {
    const brief = api.buildMetaAdFoundersPassFirstReply('Tell me about the course', { flowVariant: 'broad_pain' });
    assert.equal(brief.firstReplyIntent, 'overview');
    assert.match(brief.joined, /^Hey/);
    assert.doesNotMatch(brief.joined, /Week 1/i);
    assert.ok(brief.joined.split(/\s+/).length < 60);
    assert.deepEqual(api.collectPaidMetaWriterContractIssues({ draft: brief, currentMessage: 'Tell me about the course', history: [], flowVariant: 'broad_pain' }), []);
    const detailed = api.buildMetaAdFoundersPassFirstReply('What will I learn week by week?', { flowVariant: 'broad_pain' });
    assert.equal(detailed.firstReplyIntent, 'curriculum');
    assert.match(detailed.joined, /Week 1/i);
});

test('accepted course price and a grocery expense are not course price questions', () => {
    const reply = api.buildMetaAdFoundersPassFirstReply("The course price is fine. Fancy groceries are what I can't afford. Can the food plan use basic supermarket stuff?", { flowVariant: 'broad_pain' });
    assert.notEqual(reply.firstReplyIntent, 'price');
});
