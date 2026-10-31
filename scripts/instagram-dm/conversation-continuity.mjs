export const continuityPolicy = {
  "version": "organic_natural_20261101_v1",
  "authority": "Shannon explicit 1 November 2026 retirement; current-conversation-policy.md overrides all experimental composition rules.",
  "instruction": "Answer the complete newest turn using actual full history. Genuine person-specific rapport, short casual Australian wording. No mandatory question, sibling-question chain, discovery ladder or invented facts/actions. Natural completed exchanges can end; silence never authorises a chase.",
  "naturalTiming": "The A/B/C and direct_challenge/fitness_first experiment is retired prospectively. Historical assignments and exposures are read-only evidence, never composition authority. Invite the optional free challenge when it naturally fits genuine rapport. No episode, bubble, assigned approach or fitness qualification threshold.",
  "offer": "Four weeks free, realistic workouts, general meal-planning support, one weekly training/food review and adjustments. Before enrolment clearly disclose no card, no automatic billing and no obligation to continue. Rolling six-person intake unchanged: fresh live capacity before invitation, explicit acceptance and suitability reservation before confirmation. Verify setup/onboarding.",
  "afterChallengeInterest": "Warmly offer setup and ask only useful unknown setup questions after interest. Direct price questions answered honestly immediately. Otherwise contextual optional continuation only after actual product use and time to judge value, at a suitable later point; no proactive pricing during free enrolment/onboarding. Verify current AUD14.99/week and other billing terms, obtain separate explicit paid agreement/payment; never auto-bill.",
  "review": "Keep exact sourceMessageIds, reason, lane and disposition. continue requires useful nextMove and responseInviting:true, not punctuation. close/answer_only requires documented actual closureReason. invite_challenge requires rapportReviewed:true, naturalInvitationReason, fresh positive capacity and explicit free invitation/terms. No experimental arm or goal/blocker/coach gate. Advisory reviewer cannot clear holds.",
  "measurement": "Record exact source/delivered IDs and natural policy revision in durable completion receipts: outreach, conversations, invitations, explicit interest, acceptance, verified onboarding, actual product use/workouts, declines and latency. Unknown is not failure; friendliness is not interest. Historical experiment records remain unchanged; no new randomisation or retrospective corrections, no invented conversion uplift.",
  "boundaries": "Sole native Instagram responder, fresh full context/account/recipient/source/lease/action ownership and pre-Send checks. Preserve all safety/client/personal/manual/identity/media/consent/platform holds and certain/uncertain no-repeat. No new sender, outreach, volume, schedule or capacity, no hold release, no test messages."
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
    if (review.rapportReviewed !== true || !nonempty(review.naturalInvitationReason)) throw new Error('Reviewed rapport and natural invitation reason required');
    if (review.capacityChecked !== true || !Number.isInteger(review.capacityRemaining) || review.capacityRemaining <= 0
        || (review.freeInvitation !== true && review.termsDisclosed !== true)) throw new Error('Fresh positive capacity and explicit free invitation required');
  } else if (['close', 'answer_only'].includes(review.disposition)) {
    if (!exceptions.has(review.closureReason)) throw new Error('Concrete closure or answer-only exception required');
  } else throw new Error('Explicit conversation disposition required');
  return review;
}
