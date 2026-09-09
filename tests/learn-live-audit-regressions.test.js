const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeterministicPaidMetaConversationReply: build, shouldApplyDeterministicPaidMetaReplyOverride: selected, buildPaidMetaConversationApproval: approve } = require('../netlify/functions/ig-instant-draft')._test;
const base = { flowVariant: 'broad_pain', checkoutUrl: 'https://future-balance.netlify.app/fitness', appPreviewUrl: 'https://future-balance.netlify.app/p/Test_123-xyz9876543210', allowVideoAttachment: true };
test('focused course questions answer only requested facts', () => {
 const draft=build({...base,currentMessage:'How many lessons are there and what is week 4 about?'});
 assert.match(draft.joined,/31 lessons/);
 assert.match(draft.joined,/Week 4: take the fight out of food/);
 assert.doesNotMatch(draft.joined,/Week [12356]:|Certificate/);
 const review=require('../netlify/functions/ig-instant-draft')._test;
 assert.deepEqual(review.collectPaidMetaWriterContractIssues({draft,currentMessage:'How many lessons are there and what is week 4 about?',flowVariant:'broad_pain'}).filter(review.isBlockingPaidMetaWriterContractIssue),[]);
 assert.match(build({...base,currentMessage:'What is the week-by-week curriculum?'}).joined,/Week 6:/);
});
test('short acceptance delivers the offered preview across natural invitation wording', () => {
  for (const text of ['Want to see the preview?', 'Would you like a free app preview first?', 'Want me to send you the preview?', 'If you want, I can share a free personalised app preview before you decide on payment.']) {
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

test('a native echo is reconciled to its exact transport receipt without a second insert', async () => {
 const {recordDeliveredChunk}=require('../netlify/functions/_lib/ig-reply-source');
 const calls=[];
 const query=async(path,options)=>{calls.push({path,options}); return [{id:'native-echo',created_at:'2026-09-09T00:00:00Z'}];};
 const result=await recordDeliveredChunk({query,message:{thread_id:'thread',manychat_message_id:'ig_graph:exact',alert_id:'alert',text:'[VIDEO:approved]',source:'instagram_graph_send'}});
 assert.equal(result[0].id,'native-echo');
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.method,'PATCH');
 assert.match(calls[0].path,/manychat_message_id=eq.ig_graph%3Aexact/);
 assert.equal(calls[0].options.body.alert_id,'alert');
});

test('finishing an older reply leaves newer inbound alerts queued', async () => {
 const {clearManyChatHomeNotifications}=require('../netlify/functions/send-ig-reply')._test;
 const calls=[];
 await clearManyChatHomeNotifications({alertId:'old',igThreadId:'thread',sentAt:'2026-09-09T00:56:00Z',answeredThrough:'2026-09-09T00:55:02Z',source:'auto',query:async p=>{calls.push(p);return [];}});
 assert.match(calls[0],/created_at=lte.2026-09-09T00%3A55%3A02Z/);
 assert.doesNotMatch(calls[0],/00%3A56/);
});

test('accepted signed preview does not restart the offer after an intervening FAQ', () => {
 const {collectPaidMetaWriterContractIssues}=require('../netlify/functions/ig-instant-draft')._test;
 const history=[{direction:'in',text:'I want to get stronger but only have two evenings a week.'},{direction:'out',text:'Want me to open your free personalised preview before you pay?'},{direction:'in',text:'Can I train at home?'},{direction:'out',text:'Yes, home workouts can fit your dumbbells.'}];
 const draft=build({...base,currentMessage:'Yes please',history});
 assert.equal(draft.appPreviewHandoff,true);
 const issues=collectPaidMetaWriterContractIssues({draft,currentMessage:'Yes please',history,flowVariant:'broad_pain'});
 assert.equal(issues.some(x=>/earned paid-Meta offer/.test(x)),false);
});

test('an already delivered offer survives media and preview bubbles in history', () => {
 const history=[{direction:'in',text:'I want to get stronger but only have two evenings a week.'},{direction:'out',text:'Balance Learn is a six-week course. Your workout program and meal plan are included for $149, no subscription. Want the preview before you pay?'},...Array.from({length:5},()=>({direction:'out',text:'[VIDEO:approved]'})),{direction:'out',text:'Your preview is ready'}];
 const draft=build({...base,currentMessage:'I keep starting and stopping',history});
 assert.notEqual(draft?.model,'deterministic_paid_meta_guided_sales_v1');
});

test('a typo goal remains known when the next message is a vague blocker', () => {
 const history=[{direction:'in',text:'loose wieght'},{direction:'out',text:'This is Ally.'},{direction:'out',text:'[IMAGE:approved]'},{direction:'out',text:'What usually gets in the way of making that happen consistently?'}];
 const draft=build({...base,currentMessage:'dunno. all of it tbh',history});
 assert.ok(draft.videoAttachmentUrl);
 assert.match(draft.joined,/149/);
 assert.doesNotMatch(draft.joined,/what.*gets in the way/i);
});

test('curriculum facts survive the writer contract and fallback', () => {
 const {collectPaidMetaWriterContractIssues,buildPaidMetaGuaranteedContractFallback}=require('../netlify/functions/ig-instant-draft')._test;
 const currentMessage='What do you actually teach in each of the six weeks? How many lessons are there, and is there a certificate?';
 const history=[{direction:'out',text:"What's the main change you'd like to make over the next six weeks?"}];
 const draft=build({...base,currentMessage,history});
 assert.deepEqual(collectPaidMetaWriterContractIssues({draft,currentMessage,history,flowVariant:'broad_pain'}),[]);
 const fallback=buildPaidMetaGuaranteedContractFallback({draft,currentMessage,history,flowVariant:'broad_pain',issues:['The course answer must return to the still-missing six-week goal.']});
 assert.match(fallback.joined,/31 lessons/);
 assert.match(fallback.joined,/Certificate of Completion/);
});
test('night work and disrupted food are already supplied blockers despite goal typos', () => {
  const draft = build({...base,currentMessage:'wanna loose wieght\ni work nights so food is all over the place\nand im vegetarian'});
  assert.doesNotMatch(draft.joined,/what.*gets in the way/i);
  assert.match(draft.joined,/food|meal/i);
  assert.ok(draft.videoAttachmentUrl);
});
