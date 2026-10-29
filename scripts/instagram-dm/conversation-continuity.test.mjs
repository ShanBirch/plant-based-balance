import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConversationReview } from './conversation-continuity.mjs';
import { fastReplyContext, fastReplyClaim } from './balance-dm-fast-reply.mjs';
const source = '11111111-1111-4111-8111-111111111111';
const base = {lane:'organic_business',reason:'Their substantive answer leaves a useful opening',sourceMessageIds:[source]};
test('fresh answer cannot be closed for lacking a question mark or with praise alone',()=>{
  for(const closureReason of ['no_question_mark','short_reply','praise_sufficient','five_minute_silence'])
    assert.throws(()=>validateConversationReview({...base,disposition:'close',closureReason},source));
  assert.throws(()=>validateConversationReview({...base,disposition:'continue',nextMove:'Nice result'},source));
});
test('contextual continuation supports natural wording without compulsory question punctuation',()=>{
  assert.doesNotThrow(()=>validateConversationReview({...base,disposition:'continue',nextMove:'Reflect their new routine and invite the missing support detail',responseInviting:true},source));
});
test('challenge invitation needs relevant fitness context and capacity without coach or wanted-help gate',()=>{
  const offer={...base,disposition:'invite_challenge',fitEvidence:{relevance:'They want to build strength'},capacityChecked:true,capacityRemaining:5,termsDisclosed:true};
  assert.doesNotThrow(()=>validateConversationReview(offer,source));
  for(const key of Object.keys(offer.fitEvidence)) assert.throws(()=>validateConversationReview({...offer,fitEvidence:{...offer.fitEvidence,[key]:''}},source));
  for(const patch of [{capacityRemaining:0},{capacityChecked:false},{termsDisclosed:false}]) assert.throws(()=>validateConversationReview({...offer,...patch},source));
});
test('refusal support goodbye and personal exceptions do not force sales questions',()=>{
  for(const closureReason of ['refusal_or_space','support_or_safety','explicit_goodbye','personal_or_manual','ignored_or_declined_pivot']) assert.doesNotThrow(()=>validateConversationReview({...base,disposition:'answer_only',closureReason},source));
  assert.throws(()=>validateConversationReview({...base,lane:'other'},source));
  assert.doesNotThrow(()=>validateConversationReview({...base,lane:'other',laneReason:'Linked client asking for workout support'},source));
});
test('brief free invitation can precede full enrolment terms without dropping capacity checks',()=>{
  const offer={...base,disposition:'invite_challenge',fitEvidence:{relevance:'They want to restart training'},capacityChecked:true,capacityRemaining:5,freeInvitation:true};
  assert.doesNotThrow(()=>validateConversationReview(offer,source));
  assert.throws(()=>validateConversationReview({...offer,freeInvitation:false},source));
  assert.throws(()=>validateConversationReview({...offer,capacityRemaining:0},source));
});
test('review must refer to exact current source',()=>{
  assert.throws(()=>validateConversationReview({...base,sourceMessageIds:['old'],disposition:'close',closureReason:'thanks_only'},source));
});
test('actual helper returns policy and saves review with existing source and ownership gates',()=>{
  const input={threadId:source,sourceMessageId:source,runId:'offline-fixture',username:'fixture',nativeConversationId:'fixture',finalText:'That sounds manageable. What would help you stick with it?',leadState:'engaged',fullThreadReviewed:true,nativeIdentityVerified:true,independentHoldsChecked:true};
  assert.match(fastReplyContext(input),/conversation_continuity_policy/);
  assert.throws(()=>fastReplyClaim(input),/review required/);
  const sql=fastReplyClaim({...input,conversationReview:{...base,disposition:'continue',nextMove:'Understand wanted support',responseInviting:true}});
  for(const value of ['conversation_review','organic_continuity_20261030','claim_ig_next_actions','order by created_at desc,id desc limit 1','balance_challenge_timing_context','timing_override']) assert.ok(sql.includes(value));
  assert.throws(()=>fastReplyClaim({...input,independentHoldsChecked:false,conversationReview:{...base,lane:'other',laneReason:'Client support'}}),/independent gates/);
});


test('approved direct nested invitation needs no invented fitness goal but retains source/capacity',()=>{
 const offer={...base,disposition:'invite_challenge',approachSubvariant:'A1_direct_challenge',directChallengeReason:'Transparent invitation in the assigned first conversation',capacityChecked:true,capacityRemaining:2,freeInvitation:true};
 assert.doesNotThrow(()=>validateConversationReview(offer,source));
 assert.throws(()=>validateConversationReview({...offer,directChallengeReason:''},source));
 assert.throws(()=>validateConversationReview({...offer,capacityRemaining:0},source));
 assert.throws(()=>validateConversationReview({...offer,approachSubvariant:'A2_fitness_first'},source));
});

test('context and claim include prospective nested allocation guard',()=>{
 const input={threadId:source,sourceMessageId:source,runId:'offline-fixture',username:'fixture',nativeConversationId:'fixture',finalText:'A small free challenge might interest you.',leadState:'engaged',fullThreadReviewed:true,nativeIdentityVerified:true,independentHoldsChecked:true};
 assert.match(fastReplyContext(input),/group_a_approach_experiment/);
 assert.match(fastReplyClaim({...input,conversationReview:{...base,disposition:'continue',nextMove:'Natural current topic',responseInviting:true}}),/balance_challenge_approach_claim_allowed/);
});
