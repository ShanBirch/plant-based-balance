const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../netlify/functions/ig-instant-draft')._test;

test('Saturday and Sunday support a weekend description without weakening invented-context checks', () => {
    const draft = {joined:'Balance Learn can fit training around your weekends. It is one AUD $149 payment for the full six weeks.'};
    const issues = text => api.collectPaidMetaWriterContractIssues({draft,currentMessage:text,flowVariant:'broad_pain'});
    assert.equal(issues('Weekdays are full but I can train on Saturday and Sunday').some(x=>x.includes('weekends was invented')),false);
    assert.equal(issues('I have kids and like chocolate').some(x=>x.includes('weekends was invented')),true);
});

test('a vague consistency opener cannot turn the following bare goal into an earned offer', () => {
    const history = [
        {direction:'in',text:'I struggle to stay consistent'},
        {direction:'out',text:'Hey, how are you? Consistency usually is not a knowledge problem.'},
        {direction:'out',text:"What's the main change you'd like to make over the next six weeks?"},
    ];
    const params = {currentMessage:'I want to get stronger',history,flowVariant:'broad_pain',qualifier:{facts:{history_blockers:'struggles to stay consistent'}}};
    const draft = api.buildDeterministicPaidMetaConversationReply(params);
    assert.match(draft.joined,/This is Gen/);
    assert.match(draft.joined,/gets in the way/);
    assert.ok(draft.imageAttachmentUrl);
    assert.doesNotMatch(draft.joined,/\$149|six-week course/);
    assert.deepEqual(api.collectPaidMetaWriterContractIssues({...params,draft}), []);
});

test('early price and home FAQ cannot promise a quick video when discovery defers the attachment', () => {
    const currentMessage = "What's the price of the course? Can I do the workouts at home?";
    const history = [{direction:'out',text:"What's the main change you want in the next six weeks?"}];
    for (const intro of ["Here's a quick video showing the course and what's inside Balance.", 'Here is a short course video.', 'Here’s the video.']) {
        const result = api.preservePaidMetaPendingBlocker({currentMessage,history,draft:{chunks:["It's one AUD $149 payment for the full six weeks, with no subscription or auto-renewal. Yep, you can do the workouts at home. " + intro],videoAttachmentUrl:'video.mp4'}});
        assert.match(result.joined,/AUD \$149/);
        assert.match(result.joined,/workouts at home/);
        assert.match(result.joined,/main change/);
        assert.doesNotMatch(result.joined,/video/i);
        assert.equal(result.videoAttachmentUrl,null);
    }
});

test('goal already acknowledged with FAQ answers is not praised again before proof', () => {
    const currentMessage="I want to build muscle. What's the price of the course? Can I train at home?";
    const history=[{direction:'out',text:"What's the main change you want in the next six weeks?"}];
    const draft={chunks:["It's one AUD $149 payment for the full six weeks. Nice one, building muscle is a great goal. Yes, you can train at home."]};
    const result=api.preservePaidMetaPendingBlocker({draft,history,currentMessage});
    assert.match(result.joined,/great goal/);
    assert.doesNotMatch(result.joined,/solid goal/);
    assert.match(result.joined,/This is Gen/);
    assert.ok(result.imageAttachmentUrl);
    assert.match(result.joined,/gets in the way/);
});

test('new greeting cannot be converted into a personalised offer by old pending discovery', () => {
    const currentMessage='How does Balance work?';
    const draft=api.buildMetaAdFoundersPassFirstReply(currentMessage,{flowVariant:'broad_pain'});
    const history=[{direction:'out',text:"What's the main change you'd like to make over the next six weeks?"}];
    assert.equal(api.preservePaidMetaPendingBlocker({draft,history,currentMessage}),draft);
    assert.match(draft.joined,/^Hey!/);
});

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
    assert.equal(api.shouldUseDeterministicMetaAdFirstReply('Tell me about the course'), true);
    const brief = api.buildMetaAdFoundersPassFirstReply('Tell me about the course', { flowVariant: 'broad_pain' });
    assert.equal(brief.firstReplyIntent, 'overview');
    assert.match(brief.joined, /^Hey/);
    assert.doesNotMatch(brief.joined, /Week 1/i);
    assert.ok(brief.joined.split(/\s+/).length < 60);
    assert.deepEqual(api.collectPaidMetaWriterContractIssues({ draft: brief, currentMessage: 'Tell me about the course', history: [], flowVariant: 'broad_pain' }), []);
    const history=[{direction:'out',text:"What's the main change you'd like to make over the next six weeks?"}];
    const writer={joined:'The lessons help you understand your habits and practise changes to food and training.',model:'writer'};
    assert.ok(!api.collectPaidMetaWriterContractIssues({draft:writer,currentMessage:'Tell me about the course',history,flowVariant:'broad_pain'}).some(issue=>/curriculum|weekly themes|six themes|Week 1/i.test(issue)));
    const detailed = api.buildMetaAdFoundersPassFirstReply('What will I learn week by week?', { flowVariant: 'broad_pain' });
    assert.equal(detailed.firstReplyIntent, 'curriculum');
    assert.match(detailed.joined, /Week 1/i);
});

test('accepted course price and a grocery expense are not course price questions', () => {
    const reply = api.buildMetaAdFoundersPassFirstReply("The course price is fine. Fancy groceries are what I can't afford. Can the food plan use basic supermarket stuff?", { flowVariant: 'broad_pain' });
    assert.notEqual(reply.firstReplyIntent, 'price');
});
