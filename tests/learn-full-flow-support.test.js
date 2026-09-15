const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../netlify/functions/ig-instant-draft')._test;
const send=require('../netlify/functions/send-ig-reply')._test;
const {LEARN_SUPPORT_CHOICE}=require('../netlify/functions/_lib/paid-meta-zoom');

test('live coalesced duplicate goal records produce one current turn',()=>{
 const currentMessage=api.buildCurrentInboundTurnText('Whats the details of the course',[
  {text:'I want to lose weight',created_at:'2026-09-15T00:07:19.804+00:00'},
  {text:'I want to lose weight',created_at:'2026-09-15T00:07:19.804Z'},
 ]);
 assert.equal(currentMessage,'I want to lose weight\nWhats the details of the course');
 const history=[{direction:'out',text:"What's the main change you want in the next six weeks?"},{direction:'in',text:'I want to lose weight'},{direction:'in',text:'I want to lose weight'}];
 const draft=api.buildDeterministicPaidMetaConversationReply({currentMessage,history,flowVariant:'broad_pain'});
 assert.ok(draft.imageAttachmentUrl);assert.match(draft.joined,/gets in the way/);
});

test('goal then course-details fragment without punctuation preserves discovery',()=>{
 const opener={direction:'out',text:"Hey, how are you? What's the main change you want in the next six weeks?"};
 for(const question of ['Whats the details of the course','What are the details of the course?','Can you give me the details of the course','Tell me more details about the course']){
  for(const combined of [false,true]){
   const history=[opener,{direction:'in',text:'I want to lose weight',created_at:'2026-09-15T00:07:19.804+00:00'},{direction:'in',text:'I want to lose weight',created_at:'2026-09-15T00:07:19.804Z'}];
   const currentMessage=combined?`I want to lose weight\n${question}`:question;
   const draft=api.buildDeterministicPaidMetaConversationReply({currentMessage,history,flowVariant:'broad_pain'});
   assert.ok(draft?.imageAttachmentUrl,question);
   assert.match(draft.joined,/This is Ally/);assert.match(draft.joined,/gets in the way/);
   assert.doesNotMatch(draft.joined,/preview|\$149|Zoom/);
   assert.equal(api.selectFastDeterministicPaidMetaProgression({draft,currentMessage}),draft);
   assert.deepEqual(api.collectPaidMetaWriterContractIssues({draft,currentMessage,history,flowVariant:'broad_pain'}),[]);
  }
 }
});

for(const [index,question,goal] of [
 [1,'Whats the course about?','I want to lose some weight!'],
 [2,"What's the course about?",'I need to lose weight, 15 kilos'],
 [3,'What is the course about?','I want to build strength'],
 [4,'What does the course cover?','I want to get fitter'],
 [5,'What does this course teach?','I want better body composition'],
 [6,'Can you explain the course?','I want to build muscle'],
 [7,'Can you tell me about the course?','I want to lose 5kg'],
 [8,'What is this course about?','I need to lose some weight'],
 [9,"What's this course about?",'I want to get stronger'],
 [10,'Whats the course about?','I want to lose 15 kilograms'],
]) test(`overview plus goal full journey ${index}`,()=>{
 const opener={direction:'out',text:"Hey, how are you? What's the main change you want in the next six weeks?"};
 for(const batched of [false,true]){
  const history=[opener,{direction:'in',text:question}];
  const currentMessage=batched?`${question}\n${goal}`:goal;
  const d=api.buildDeterministicPaidMetaConversationReply({currentMessage,history,flowVariant:'broad_pain'});
  assert.match(d.joined,/understand what makes habits hard/);
  assert.ok(d.imageAttachmentUrl);assert.match(d.joined,/gets in the way/);
  assert.equal(d.videoAttachmentUrl,undefined);
  assert.equal(api.selectFastDeterministicPaidMetaProgression({draft:d,currentMessage}),d);
  assert.deepEqual(api.collectPaidMetaWriterContractIssues({draft:d,currentMessage,history,flowVariant:'broad_pain'}),[]);
  history.push({direction:'in',text:goal},...d.chunks.map(text=>({direction:'out',text})),{direction:'out',text:`[IMAGE:${d.imageAttachmentUrl}]`});
  const offer=api.buildDeterministicPaidMetaConversationReply({currentMessage:'Shift work makes regular workouts hard',history,flowVariant:'broad_pain',allowVideoAttachment:true});
  assert.ok(offer.videoAttachmentUrl);assert.equal(offer.chunks.at(-1),LEARN_SUPPORT_CHOICE);
  history.push(...offer.chunks.map(text=>({direction:'out',text})));
  const base={history,flowVariant:'broad_pain',appPreviewUrl:'https://future-balance.netlify.app/p/synthetic-token-12345'};
  const invite=api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:'On my own please'});
  assert.match(invite.joined,/Would you like that\?/);assert.equal(invite.appPreviewHandoff,undefined);
  history.push({direction:'out',text:invite.joined});
  assert.equal(api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:'Yes please'}).appPreviewHandoff,true);
 }
});

test('independent choice offers preview without repeating inclusions or sending the card',()=>{
 const history=[
  {direction:'out',text:'Hey, how are you? Balance Learn is a six-week course in the app using neuroscience and psychology. You get workouts, food support and my weekly check-in.'},
  {direction:'in',text:'I want to lose 5kg'},
  {direction:'out',text:'What usually gets in the way of making that happen consistently?'},
  {direction:'in',text:'The kids and chocolate after dinner make consistency difficult'},
  {direction:'out',text:'A flexible food routine can include chocolate and fit around family life.'},
  {direction:'out',text:"It's one AUD $149 payment, with no subscription or auto-renewal. Here's the course video."},
  {direction:'out',text:'[VIDEO:course.mp4]'},
  {direction:'out',text:LEARN_SUPPORT_CHOICE},
 ];
 const currentMessage='On my own please';
 const draft=api.buildDeterministicPaidMetaConversationReply({history,currentMessage,flowVariant:'broad_pain',appPreviewUrl:'https://future-balance.netlify.app/p/synthetic-token-12345'});
 assert.equal(draft.appPreviewHandoff,undefined);
 assert.match(draft.joined,/Would you like that\?/);
 assert.deepEqual(api.collectPaidMetaWriterContractIssues({draft,currentMessage,history,flowVariant:'broad_pain'}),[]);
});

test('weight target in one message or rapid fragments keeps acknowledgement, photo and blocker',()=>{
 const opener={direction:'out',text:"Hey, how are you? What's the main change you want in the next six weeks?"};
 const cases=[
  ['I need to lose weight, 15 kilos',[opener]],
  ['I need to lose weight\n15 kilos',[opener]],
  ['15 kilos',[opener,{direction:'in',text:'I need to lose weight'}]],
  ['15 kilos',[opener,{direction:'in',text:'I need to lose weight'},{direction:'in',text:'15 kilos'}]],
 ];
 for(const [currentMessage,history] of cases){
  const d=api.buildDeterministicPaidMetaConversationReply({currentMessage,history,flowVariant:'broad_pain'});
  assert.match(d.joined,/Yep, losing 15kg/);
  assert.match(d.joined,/This is Ally/);
  assert.ok(d.imageAttachmentUrl);
  assert.match(d.joined,/gets in the way/);
  assert.equal(d.videoAttachmentUrl,undefined);
  assert.equal(api.selectFastDeterministicPaidMetaProgression({draft:d,currentMessage}),d);
  assert.deepEqual(api.collectPaidMetaWriterContractIssues({draft:d,currentMessage,history,flowVariant:'broad_pain'}),[]);
 }
 assert.equal(api.isPaidMetaBareGoalMessage('I need to lose weight, 15 kilos, but childcare is hard'),false);
});

test('preview invitation accepts yes, honours no, and explicit requests skip redundant consent',()=>{
 const history=[{direction:'out',text:LEARN_SUPPORT_CHOICE}];
 const base={history,flowVariant:'broad_pain',appPreviewUrl:'https://future-balance.netlify.app/p/synthetic-token-12345'};
 const invitation=api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:'I can do them on my own'});
 assert.match(invitation.joined,/Would you like that\?/);
 assert.doesNotMatch(invitation.joined,/https?:/);
 const after=[...history,{direction:'out',text:invitation.joined}];
 for(const currentMessage of ['Yes please','Yeah','That sounds good']){
  const d=api.buildDeterministicPaidMetaConversationReply({...base,history:after,currentMessage});
  assert.equal(d.appPreviewHandoff,true);
 }
 const declined=api.buildDeterministicPaidMetaConversationReply({...base,history:after,currentMessage:'No thanks'});
 assert.notEqual(declined?.appPreviewHandoff,true);
 const direct=api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:'On my own, show me the preview'});
 assert.equal(direct.appPreviewHandoff,true);
});
test('ordinary planning obstacles are not held as app faults; real app faults still are',()=>{
 const {isAppProblemSupportRequest}=require('../netlify/functions/_lib/client-context');
 for(const text of ['I drive between jobs and need cold packed lunches, food planning is where I get stuck','Food is my problem','My workout routine is not working for me'])assert.equal(isAppProblemSupportRequest(text),false,text);
 for(const text of ['The app is stuck','My workout will not load','The food photo upload failed','The custom workout start button won’t load the next page'])assert.equal(isAppProblemSupportRequest(text),true,text);
});
test('body-composition goal delivers Dani proof in deterministic and writer paths',()=>{
 for(const goal of ['I want better body composition','I want to improve body composition']){
  const d=api.buildDeterministicPaidMetaConversationReply({currentMessage:goal,history:[],flowVariant:'broad_pain'});
  assert.match(d.joined,/Dani/);assert.ok(d.imageAttachmentUrl);assert.ok(api.isPaidMetaBareGoalMessage(goal));
 }
 const writer={joined:'That makes sense, body composition is a great goal. What usually gets in the way for you?',chunks:[],model:'writer'};
 const d=api.attachPaidMetaWriterSelectedMedia(writer,{allowAttachments:true,flowVariant:'broad_pain',currentMessage:'I want better body composition'});
 assert.match(d.joined,/Dani/);assert.ok(d.imageAttachmentUrl);assert.match(d.chunks.at(-1),/gets in the way/);
});
test('unfamiliar blocker cannot jump from writer acknowledgement to preview without video and support choice',()=>{
 const history=[{direction:'in',text:'I want better body composition'},{direction:'out',text:'What usually gets in the way of making that happen consistently?'}];
 const currentMessage='Too much conflicting advice leaves me doing nothing';
 const draft={joined:'That makes sense. Balance Learn gives you structure. If you want, I can send the free personalised app preview next.',model:'writer'};
 const issues=api.collectPaidMetaWriterContractIssues({draft,currentMessage,history,flowVariant:'broad_pain'});
 assert.ok(issues.some(x=>/earned paid-Meta offer is missing/.test(x)));
 const fixed=api.buildPaidMetaGuaranteedContractFallback({draft,currentMessage,history,flowVariant:'broad_pain',issues});
 assert.ok(fixed.videoAttachmentUrl);assert.equal(fixed.chunks.at(-1),LEARN_SUPPORT_CHOICE);
 assert.deepEqual(api.collectPaidMetaWriterContractIssues({draft:fixed,currentMessage,history,flowVariant:'broad_pain'}),[]);
});
test('goal to photo to blocker to video to support choice then either destination',()=>{
 const history=[{direction:'out',text:"Hey, how are you? What's the main change you want in the next six weeks?"}];
 const goal='I want to lose 5kg';
 const proof=api.buildDeterministicPaidMetaConversationReply({currentMessage:goal,history,flowVariant:'broad_pain',allowVideoAttachment:true});
 assert.ok(proof.imageAttachmentUrl);assert.match(proof.joined,/Ally/);assert.match(proof.joined,/gets in the way/);
 history.push({direction:'in',text:goal},...proof.chunks.map(text=>({direction:'out',text})),{direction:'out',text:'[IMAGE:'+proof.imageAttachmentUrl+']'});
 const blocker='The kids and chocolate after dinner make consistency difficult';
 const offer=api.buildDeterministicPaidMetaConversationReply({currentMessage:blocker,history,flowVariant:'broad_pain',allowVideoAttachment:true});
 assert.ok(offer.videoAttachmentUrl);assert.equal(offer.chunks.at(-1),LEARN_SUPPORT_CHOICE);
 const finalOffer=api.ensurePaidMetaAppVideoPreviewCta(offer);
 assert.equal(finalOffer,offer,'legacy video CTA must not append a second question');
 assert.deepEqual(api.collectCocosAutoRepairIssues({draft:finalOffer,currentMessage:blocker,meaningfulLeadReplyCount:2,metaAdConversationFastLane:true,flowVariant:'broad_pain'}),[]);
 const items=send.appendPaidMetaProofMedia(offer.chunks.map(text=>({kind:'text',text})),{videoUrl:offer.videoAttachmentUrl});
 assert.equal(items.at(-2).kind,'video');assert.equal(items.at(-1).text,LEARN_SUPPORT_CHOICE);
 assert.deepEqual(api.collectPaidMetaWriterContractIssues({draft:offer,currentMessage:blocker,history,flowVariant:'broad_pain'}),[]);
 history.push({direction:'in',text:blocker},...items.map(x=>({direction:'out',text:x.text})));
 const base={history,flowVariant:'broad_pain',appPreviewUrl:'https://future-balance.netlify.app/p/synthetic-token-12345'};
 for(const choice of ['On my own please','Just the app for me','On my own with the app please','I prefer doing workouts on my own','Just Learn and workouts on my own']){
  const d=api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:choice});assert.equal(d.appPreviewHandoff,undefined);
  assert.match(d.joined,/Would you like that\?/);
  assert.deepEqual(api.collectPaidMetaWriterContractIssues({draft:d,currentMessage:choice,history,flowVariant:'broad_pain'}),[],choice+' is a choice, not an inclusions question');
  const approval=api.buildPaidMetaConversationApproval({metaAdConversationFastLane:true,draft:d,currentMessage:choice,history});
  assert.equal(approval?.required,false,choice+' must be approved through delivery');
  const acceptedHistory=[...history,{direction:'in',text:choice},{direction:'out',text:d.joined}];
  const accepted=api.buildDeterministicPaidMetaConversationReply({...base,history:acceptedHistory,currentMessage:'Yes please'});
  assert.equal(accepted.appPreviewHandoff,true);
  assert.deepEqual(api.collectPaidMetaWriterContractIssues({draft:accepted,currentMessage:'Yes please',history:acceptedHistory,flowVariant:'broad_pain'}),[]);
 }
 const zoom=api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:'Zoom sessions please'});assert.equal(zoom.paidMetaZoomHandoff,true);
 const unclear=api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:'Yes'});assert.equal(unclear.paidMetaSupportChoice,true);assert.equal(unclear.joined,LEARN_SUPPORT_CHOICE);
});
