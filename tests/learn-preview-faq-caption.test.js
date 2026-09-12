const test=require('node:test');
const assert=require('node:assert/strict');
const {getAutoDmHoldReason,collectPaidMetaWriterContractIssues,isBlockingPaidMetaWriterContractIssue,buildPaidMetaGuaranteedContractFallback}=require('../netlify/functions/ig-instant-draft')._test;
const currentMessage='I watch lessons with sound off on the train. Are there captions or written lessons I can read?';
const base={currentMessage,draft:{model:'openai-gpt-5.4-mini-paid-meta',joined:'There is written lesson content you can read in the app. If you want, I can show you a personalised preview before you join.'},draftReview:{verdict:'pass',confidence:1,issues:[],notification_required:false,context_loss_suspected:false},qualifier:{facts:{}},leadStage:'qualifying',linkedUserId:null,meaningfulLeadReplyCount:1,alertData:{meta_ad_conversation_fast_lane:true,offer_flow_variant:'broad_pain'}};
test('reviewed factual Learn answer with ordinary preview invitation is not an organic coaching pitch',()=>{
 assert.equal(getAutoDmHoldReason(base),null);
 assert.equal(getAutoDmHoldReason({...base,alertData:{}})?.code,'premature_challenge_invite');
 assert.equal(getAutoDmHoldReason({...base,contextReview:{required:true}})?.code,'context_review');
 assert.equal(getAutoDmHoldReason({...base,mediaReview:{required:true}})?.code,'media_review');
 assert.ok(getAutoDmHoldReason({...base,draftReview:{verdict:'warn',issues:['unverified claim']}}));
 assert.ok(getAutoDmHoldReason({...base,draft:{...base.draft,joined:base.draft.joined+' Pay now at https://example.com/checkout'}}));
});
test('caption question cannot fabricate availability or silently deny it',()=>{
 for(const joined of ['There are captions and written lessons in the app.','The videos do not have captions.']){
  const a={currentMessage,draft:{model:base.draft.model,joined},history:[],flowVariant:'broad_pain'};
  const issues=collectPaidMetaWriterContractIssues(a);
  assert.ok(issues.some(x=>/Unverified lesson captions/.test(x)&&isBlockingPaidMetaWriterContractIssue(x)));
  const fixed=buildPaidMetaGuaranteedContractFallback({...a,issues});
  assert.match(fixed.joined,/written lesson content/);
  assert.match(fixed.joined,/can't confirm video captions/);
  assert.ok(!collectPaidMetaWriterContractIssues({...a,draft:fixed}).some(x=>/Unverified lesson captions/.test(x)));
 }
});
