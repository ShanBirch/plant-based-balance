const test = require('node:test');
const assert = require('node:assert/strict');
const { collectPaidMetaWriterContractIssues, buildPaidMetaGuaranteedContractFallback, buildDeterministicPaidMetaConversationReply, resolveMetaAdFirstReplyIntent } = require('../netlify/functions/ig-instant-draft')._test;
const { resolvePaidMetaTransformationProof } = require('../netlify/functions/_lib/paid-meta-proof-media');
const history = [{ direction: 'out', text: "What's the main change you want in the next six weeks?" }];
const args = (currentMessage, joined) => ({currentMessage, draft:{joined,chunks:[joined]}, history, qualifier:{facts:{}},flowVariant:'broad_pain'});

for (const [question, reply] of [
    ['The price is okay. How much time do the lessons take, and can I catch up on weekends if I miss a weekday?', 'Lesson time varies. You can work at your own pace within six weeks and catch up on weekends.'],
    ["I've already got a trainer and a meal plan that I like. I'm interested in learning habits, not replacing my coach. Can I just use the lessons?", 'Yes, you can focus on the lessons alongside your current trainer and meal plan. The same core lessons are included in the complete course.'],
    ['Can I do lessons on my phone?', 'Yes, the lessons are inside the app.'],
    ['Do the lessons have a deadline every day?', 'No daily deadline, work through them at your own pace within the six-week access period.'],
]) test(`practical lesson question stays out of outline fallback: ${question}`,()=>{
    assert.notEqual(resolveMetaAdFirstReplyIntent(question),'curriculum');
    assert.ok(!collectPaidMetaWriterContractIssues(args(question,reply)).some(x=>/full six-week course outline|course answer must return/.test(x)));
});

test('actual outline requests still require the full verified curriculum',()=>{
    const question='What do I actually learn over the six weeks?';
    assert.equal(resolveMetaAdFirstReplyIntent(question),'curriculum');
    assert.ok(collectPaidMetaWriterContractIssues(args(question,'There are lessons.')).some(x=>/full six-week course outline/.test(x)));
});

test('price repair preserves other direct answers instead of restarting discovery',()=>{
    const a=args('How much is the course, can I train without a gym, and will the free preview charge my card automatically?', 'The course costs $99. You can train at home with the equipment you have.');
    const draft=buildPaidMetaGuaranteedContractFallback({...a,issues:collectPaidMetaWriterContractIssues(a)});
    assert.match(draft.joined,/one AUD \$149 payment for the full six weeks/);
    assert.match(draft.joined,/train at home/);
    assert.match(draft.joined,/preview is free.*does not charge/);
    assert.doesNotMatch(draft.joined,/\$99|\?/);
});

for (const question of [
    'Please send the free preview. Can I train at home with no equipment, when does the course start, and will opening it charge me?',
    'Can I see the preview, and does clicking it cost anything?',
    'Show me the preview. Will I have to pay to open it?',
]) test(`preview handoff answers payment concern: ${question}`,()=>{
    const draft=buildDeterministicPaidMetaConversationReply({currentMessage:question,history,flowVariant:'broad_pain',appPreviewUrl:'https://future-balance.netlify.app/p/synthetic-preview-token-12345'});
    assert.equal(draft.appPreviewHandoff,true);
    assert.match(draft.joined,/preview is free.*won.t charge/);
});

test('corrected and negated goals never select stale weight-loss proof',()=>{
    for(const goalText of [
        'I want to lose weight\nActually not weight loss. I want strength for hiking.\nI only have two evenings a week because I work shifts.',
        "I don't want weight loss, I want to be strong.",
        'I want strength rather than weight loss.',
    ]) assert.equal(resolvePaidMetaTransformationProof({goalText}),null);
});

test('repeat-question repair retains the useful grocery answer',()=>{
    const a=args('The course price is fine. Can I use basic supermarket food?', 'Yes, the food plan can use basic supermarket ingredients. What would you most like to change in the next six weeks?');
    const issues=collectPaidMetaWriterContractIssues(a);
    assert.ok(issues.some(x=>/repeated a question/.test(x)));
    const draft=buildPaidMetaGuaranteedContractFallback({...a,issues});
    assert.match(draft.joined,/basic supermarket ingredients/);
    assert.doesNotMatch(draft.joined,/\?/);
});

test('noun-first goal question is still a repeat after a lesson answer',()=>{
    const a=args('How much time do the lessons take?', 'The time varies between lessons. What change would you most like to make over the next six weeks?');
    const issues=collectPaidMetaWriterContractIssues(a);
    assert.ok(issues.some(x=>/repeated a question/.test(x)));
    const draft=buildPaidMetaGuaranteedContractFallback({...a,issues});
    assert.equal(draft.joined,'The time varies between lessons.');
});

test('price repair does not duplicate existing home and no-charge answers',()=>{
    const a=args('How much is the course, can I train without a gym, and will the free preview charge my card automatically?', "It's AUD $149 for six weeks. You can train without a gym, and the free personalised preview won’t charge your card automatically. If you want, I can send that through here.");
    const draft=buildPaidMetaGuaranteedContractFallback({...a,issues:collectPaidMetaWriterContractIssues(a)});
    assert.equal((draft.joined.match(/gym|train at home/gi)||[]).length,1);
    assert.equal((draft.joined.match(/charg/gi)||[]).length,1);
    assert.ok(draft.chunks.length<=2);
});
