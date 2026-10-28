export const continuityPolicy = {
  version: 'organic_continuity_20261028_challenge_first_abc',
  authority: 'Shannon, 28 October 2026; overrides older generic acknowledgement-only learning, never independent holds',
  timingPilot: 'Read challenge-timing-abc-20261028.md. Stable A/B/C means first/second/third reciprocal conversation: a distinct later outgoing Story reply OR direct follow-up, including Sunday, plus the actual inbound exchange it starts. Unanswered outreach, hours and extra bubbles never increment. Record reviewed opener_message_id/prior boundary/new inbound through record_balance_challenge_timing_conversation using new_story_exchange or separate_returning_exchange. As the assigned topic naturally winds down, gently introduce training. Context returns challenge_timing_experiment. Mark proactive training questions trainingPivot:true. Respect training_due and document direct-inbound overrides/actual canonical exposure and outcome messages. Short FREE invitation first; details on request and full optional continuation terms before enrolment. No manufactured follow-ups or retrospective attribution.',
  instruction: 'For fresh eligible organic business replies, answer the complete turn and reflect an actual detail. When their fitness goal or relevant training context makes it natural, invite them to the small end-of-year Balance four-week consistency challenge. Do not first ask whether they have a coach, require dissatisfaction, or make them request help before an invitation. The optional invitation itself establishes interest. Gather remaining setup/suitability facts after interest and before enrolment. No fixed ladder, repeated questions, assumed need or guaranteed results. Brief praise alone is insufficient while a useful opening remains. Respect refusals, ignored pivots, personal/manual exceptions, support and genuine closure. Known existing coaching is not an automatic exclusion, but never disparage or replace their coach, pitch after a decline or assume they need help. No retrospective repair DM.',
  offer: 'Four weeks free; realistic workouts, general meal-planning support and one weekly review. No card or automatic billing. Continued coaching AUD $14.99/week only if explicitly chosen. Check consistency_20261025 capacity immediately before offering; reserve after explicit acceptance before confirming enrolment. Paid/Summer Ready and historical agreements retain their separate terms.',
  review: 'Before claim provide conversationReview: lane (organic_business or other), disposition (continue, invite_challenge, close, answer_only), reason and sourceMessageIds including the current source. Organic continue requires nextMove and responseInviting:true; proactive training questions also set trainingPivot:true. Invite requires fitEvidence.relevance from actual fitness context, capacityChecked:true, capacityRemaining>0 and freeInvitation:true. Initial free invitation can omit billing/pricing; full terms and acceptance remain required before reservation/enrolment. No pre-invitation routine/coach/help-wanted gate. Assigned A/B/C timing is checked with direct-inbound overrides recorded separately. Organic close/answer_only requires a documented closureReason. Other lane requires laneReason. These assertions never bypass independent holds.'
};

const exceptions = new Set(['explicit_goodbye', 'thanks_only', 'reaction_only', 'completed_exchange', 'refusal_or_space', 'ignored_or_declined_pivot', 'question_fatigue', 'personal_or_manual', 'support_or_safety']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

export function validateConversationReview(review, sourceMessageId) {
  if (!review || !nonempty(review.reason) || !Array.isArray(review.sourceMessageIds)
      || !review.sourceMessageIds.includes(sourceMessageId)) throw new Error('Current-source conversation review required');
  if (review.lane === 'other') {
    if (!nonempty(review.laneReason)) throw new Error('Non-organic lane evidence required');
    return review;
  }
  if (review.lane !== 'organic_business') throw new Error('Explicit conversation lane required');
  if (review.disposition === 'continue') {
    if (!nonempty(review.nextMove) || review.responseInviting !== true) throw new Error('Open organic conversation needs one useful response-inviting next move');
  } else if (review.disposition === 'invite_challenge') {
    if (!nonempty(review.fitEvidence?.relevance)) throw new Error('Challenge relevance must come from their actual fitness goal or context');
    if (review.capacityChecked !== true || !Number.isInteger(review.capacityRemaining) || review.capacityRemaining <= 0
        || (review.freeInvitation !== true && review.termsDisclosed !== true)) throw new Error('Fresh positive capacity and explicit free invitation required');
  } else if (['close', 'answer_only'].includes(review.disposition)) {
    if (!exceptions.has(review.closureReason)) throw new Error('Concrete closure or answer-only exception required');
  } else throw new Error('Explicit conversation disposition required');
  return review;
}
