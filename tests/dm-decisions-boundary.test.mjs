import assert from 'node:assert/strict';
import { reviewClaim, buildReviewRequest } from '../scripts/review-dm-decisions.mjs';
const threadId='11111111-1111-4111-8111-111111111111', source='22222222-2222-4222-8222-222222222222';
const message={id:source,direction:'in',text:'Hello',created_at:'2026-10-29T00:00:00Z'};
const base={threadId,sourceMessageId:source,finalText:'Hi!',fullThreadReviewed:true,conversationReview:{lane:'organic_business',reason:'Answers greeting'},decisionsContext:{thread:{id:threadId,custom_data:{relationship_memory_compaction:{summary:'Complete history'}}},history_proof:{mode:'full_history_summary_and_complete_delta',validated_compaction:true,boundary:'2026-10-29T00:00:00Z'},messages:null,latest_inbound:message}};
let calls=0; const fetchImpl=async(url,opts)=>{calls++;return {ok:true,json:async()=>({answers:JSON.parse(opts.body).questions.map(q=>({name:q.name,type:'predicate',probability:0.95}))})}};
const run=async x=>await reviewClaim(x,{currentPolicy:'Current policy',learningRevision:'test',apiKey:'test',fetchImpl});
let good=await run(base); assert.equal(good.decisionsReview.status,'passed'); assert.equal(calls,1);
let wrong=structuredClone(base); wrong.decisionsContext.latest_inbound.id='33333333-3333-4333-8333-333333333333'; assert.equal((await run(wrong)).decisionsReview.reason,'missing_or_invalid_complete_context'); assert.equal(calls,1);
let invalid=structuredClone(base); invalid.decisionsContext.history_proof.validated_compaction=false; assert.equal((await run(invalid)).decisionsReview.reason,'missing_or_invalid_complete_context'); assert.equal(calls,1);
let later=structuredClone(base); later.decisionsContext.latest_inbound.created_at='2026-10-30T00:00:00Z'; assert.equal((await run(later)).decisionsReview.reason,'missing_or_invalid_complete_context'); assert.equal(calls,1);
let delta=structuredClone(base); delta.decisionsContext.messages=[message]; assert.equal((await run(delta)).decisionsReview.status,'passed'); assert.equal(calls,2);
console.log('Boundary-source review and negative isolation checks passed');






