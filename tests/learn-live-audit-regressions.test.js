const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeterministicPaidMetaConversationReply: build, shouldApplyDeterministicPaidMetaReplyOverride: selected, buildPaidMetaConversationApproval: approve } = require('../netlify/functions/ig-instant-draft')._test;
const base = { flowVariant: 'broad_pain', checkoutUrl: 'https://future-balance.netlify.app/fitness', appPreviewUrl: 'https://future-balance.netlify.app/p/Test_123-xyz9876543210', allowVideoAttachment: true };
test('short acceptance delivers the offered preview across natural invitation wording', () => {
  for (const text of ['Want to see the preview?', 'Would you like a free app preview first?', 'Want me to send you the preview?']) {
    for (const currentMessage of ['yep', 'Yes please']) {
      const draft = build({...base, currentMessage, history:[{direction:'out',text}]});
      assert.equal(draft.appPreviewHandoff, true);
      assert.match(draft.joined, /https:\/\/future-balance.netlify.app\/p\//);
      assert.equal(approve({metaAdConversationFastLane:true, draft, currentMessage})?.required, false);
    }
  }
});
test('two-sentence signup request reaches checkout while negated request does not', () => {
  assert.equal(build({...base,currentMessage:'I want to join. Please send the signup link.'}).replyMode, 'campaign_buyer_handoff');
  assert.notEqual(build({...base,currentMessage:"I don't want to join. Don't send the signup link."})?.replyMode,'campaign_buyer_handoff');
});
test('goal proof survives the progression selector and typo input', () => {
  for (const currentMessage of ['I want to build strength', 'loose wieght']) {
    const draft = build({...base,currentMessage});
    assert.ok(draft.imageAttachmentUrl);
    assert.equal(selected(draft),true);
  }
});
test('combined goal and blocker preserves photo and native course video without rediscovery', () => {
  const draft = build({...base,currentMessage:'I want to feel fitter and stronger. My shifts change every week, so fixed training days never stick. I need something flexible.'});
  assert.ok(draft.imageAttachmentUrl);
  assert.ok(draft.videoAttachmentUrl);
  assert.doesNotMatch(draft.joined,/what.*gets in the way/i);
});
test('course facts and weekly terms answer the actual question', () => {
  const curriculum = build({...base,currentMessage:'How many lessons and is there a certificate?'});
  assert.match(curriculum.joined,/31 lessons/);
  assert.match(curriculum.joined,/Certificate of Completion/);
  const weekly = build({...base,currentMessage:'Can I pay weekly? Does it keep charging after six weeks?'});
  assert.match(weekly.joined,/24\.83/);
  assert.match(weekly.joined,/continues weekly.*cancel/);
  assert.match(weekly.joined,/148\.98/);
});

test('a combined proof handoff delivers both image and video in introduction order', () => {
  const {appendPaidMetaProofMedia} = require('../netlify/functions/send-ig-reply')._test;
  const imageUrl='https://plantbased-balance.org/photos/client-success/gen-cocos.jpg';
  const videoUrl='https://plantbased-balance.org/assets/balance-foundations-course-first-v8.mp4';
  const items=appendPaidMetaProofMedia([
    {kind:'text',text:'This is Gen. She built strength.'},
    {kind:'text',text:'Here is the course video.'},
    {kind:'text',text:'Want to see the preview?'},
  ],{imageUrl,videoUrl});
  assert.deepEqual(items.map(x=>x.kind),['text','image','text','video','text']);
});

test('rapid goal before the answer does not count as a delivered photo', () => {
 const draft=build({...base,currentMessage:'I want to get stronger, but I only have two evenings a week. Can I train at home?',history:[{direction:'in',text:'I want to get stronger, but I only have two evenings a week.'}]});
 assert.ok(draft.imageAttachmentUrl);
});

test('late automated bubbles are distinguished from answers to the current inbound', async () => {
 const {outboundAnswersOlderInbound} = require('../netlify/functions/_lib/ig-reply-source');
 const base={threadId:'test',outbound:{direction:'out',alert_id:'older-alert'},sourceAt:'2026-09-09T00:31:20Z'};
 for(const [answeredAt,expected] of [['2026-09-09T00:30:41Z',true],['2026-09-09T00:31:20Z',false],['2026-09-09T00:32:00Z',false]]) {
  const query=async path => path.startsWith('coach_alerts')?[{data:{draft_revision_id:'revision'}}]:[{created_at:answeredAt}];
  assert.equal(await outboundAnswersOlderInbound({...base,query}),expected);
 }
 assert.equal(await outboundAnswersOlderInbound({...base,outbound:{direction:'out',text:'A manual response'},query:async()=>[]}),false);
});
