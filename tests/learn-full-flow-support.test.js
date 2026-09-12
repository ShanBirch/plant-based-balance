const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../netlify/functions/ig-instant-draft')._test;
const send=require('../netlify/functions/send-ig-reply')._test;
const {LEARN_SUPPORT_CHOICE}=require('../netlify/functions/_lib/paid-meta-zoom');
test('body-composition goal delivers Dani proof in deterministic and writer paths',()=>{
 for(const goal of ['I want better body composition','I want to improve body composition']){
  const d=api.buildDeterministicPaidMetaConversationReply({currentMessage:goal,history:[],flowVariant:'broad_pain'});
  assert.match(d.joined,/Dani/);assert.ok(d.imageAttachmentUrl);assert.ok(api.isPaidMetaBareGoalMessage(goal));
 }
 const writer={joined:'That makes sense, body composition is a great goal. What usually gets in the way for you?',chunks:[],model:'writer'};
 const d=api.attachPaidMetaWriterSelectedMedia(writer,{allowAttachments:true,flowVariant:'broad_pain',currentMessage:'I want better body composition'});
 assert.match(d.joined,/Dani/);assert.ok(d.imageAttachmentUrl);assert.match(d.chunks.at(-1),/gets in the way/);
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
 for(const choice of ['On my own please','Just the app for me']){
  const d=api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:choice});assert.equal(d.appPreviewHandoff,true);
 }
 const zoom=api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:'Zoom sessions please'});assert.equal(zoom.paidMetaZoomHandoff,true);
 const unclear=api.buildDeterministicPaidMetaConversationReply({...base,currentMessage:'Yes'});assert.equal(unclear.paidMetaSupportChoice,true);assert.equal(unclear.joined,LEARN_SUPPORT_CHOICE);
});
