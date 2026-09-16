const test=require('node:test'), assert=require('node:assert/strict');
const proof=require('../netlify/functions/_lib/paid-meta-proof-media');
test('recomposition proof identifies Kristy and her coaching timeframe',()=>{
 const p=proof.resolvePaidMetaTransformationProof({goalText:'I want to improve my body composition'});
 assert.equal(p.id,'kristy_recomposition');
 assert.match(p.imageUrl,/kristy-front-mirror-26-weeks/);
 assert.equal(p.introduction,'This is Kristy. These photos show her progress over 26 weeks of coaching with Shannon.');
 assert.equal(proof.maySendDraftImageAttachment({imageUrl:p.imageUrl,replyText:p.introduction}),true);
 assert.equal(proof.requiredPaidMetaProofImageUrl(p.introduction),p.imageUrl);
 assert.equal(proof.maySendDraftImageAttachment({imageUrl:p.imageUrl,replyText:'This is Dani. Eight weeks.'}),false);
});
test('experimental catalogue uses the same corrected proof facts',()=>{
 const {catalogue}=require('../experiments/learn-ai/flow.cjs');
 const c=catalogue();assert.ok(c.kristy);assert.equal(c.dani,undefined);assert.match(c.kristy.facts,/26 weeks of coaching with Shannon/);
});
