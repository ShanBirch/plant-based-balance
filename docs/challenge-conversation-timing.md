FINAL 30 October clarification: [Six-cell timing x approach test](challenge-factorial-abc.md) supersedes the A-only and all-direct versions below. BOTH approaches follow real Story rapport and run in EACH timing arm. Historical records remain intact.

Latest, 30 October 2026: [Direct challenge across all ABC timings](challenge-direct-abc.md) supersedes the Group A nested split and fitness-first requirement. Historical text/receipts below are preserved.

## Free enrolment, paid continuation only when Shannon directs it, 30 October 2026

Shannon explicitly corrected the timing again: do not proactively mention the optional paid price during free challenge enrolment or onboarding, including after interest, setup questions, account access or the welcome. Get them started, establish the unknown goal and help them make progress. His preferred response is “Awesome, I can get you set up now if you like 😊 What are you hoping for, strength, weight loss or just building a routine? Anything in particular?” Adapt to known facts and do not assume weight loss.

The offer is genuinely four weeks free, no card, no automatic billing, no payment obligation and no paid subscription created by joining. Explain those free-challenge facts naturally before accepting enrolment; terms_disclosed in reserve_balance_coaching_challenge means these free terms, not a mandatory paid-continuation pitch. Record free_terms_only:true and paid_continuation_not_offered:true in the review for clarity. Preserve actual acceptance, suitability, provenance, capacity, all holds and setup guards. Do not falsely mark any disclosure or consent that did not happen.

Optional continued coaching remains AUD $14.99/week, as a separate later offer. Wait for Shannon's case-specific instruction to introduce it, for example once the person has done a few sessions and is happy with progress. Do not automatically pitch after a session count, a positive check-in or in week four. A direct question about price or what happens after the free period gets an immediate honest answer; do not evade or imply ongoing coaching is free. Any paid continuation later requires the actual price, explicit separate opt-in and verified payment. Never create a charge/subscription, imply automatic renewal or extend paid access from free enrolment, gratitude or workout completion. Existing paid agreements retain their terms. This supersedes ALL older instructions requiring the optional rate before free enrolment, without changing free duration or capacity. No retrospective correction message.

Latest: see [Group A approach subtest](challenge-group-a-approach.md), authorised 30 October 2026. New A1/A2 must be reported separately from the original timing-only comparison.

## Natural transitions and separate pushback, Shannon 30 October 2026

This supersedes the 29 October generic gym-bridge example. Read the current continuityPolicy.trainingTransition and pushbackTracking from conversation-continuity.mjs. ABC is an earliest opportunity, never a requirement to interrupt unrelated conversation. Ground the transition in their actual words or a truthful relevant answer about Shannon's day. Avoid qualification question chains and explain commercial intent directly when asked. An optional challenge invitation needs person-specific relevance, not a compulsory coach-status or blocker interview. Respect all refusals and existing holds.

The original exposure revision was `natural_transition_20261030_v1`; after the later free-onboarding correction, use `natural_transition_20261030_v2` for new ordinary exposures and `challenge_approach_20261030_v1` for nested A1/A2. Put this in review.policy_revision for future training_opened and invited receipts. Preserve historical receipt revisions, stable arms, counting, intake capacity, offer and current sole sender. Do not send retrospective corrections or manufacture follow-ups.

After full-thread review of an actual subsequent inbound, use record_balance_challenge_timing_event(thread_id,kind,inbound_message_id,review) with:
- fitness_topic_rejected: explicitly rejects fitness discussion/activity. Merely not using a gym is not rejection.
- sales_intent_concern: questions selling, hidden business intent or being interviewed; concern is not automatically a refusal.
- offer_declined: explicitly declines a delivered invitation. Keep the existing declined receipt for backward compatibility too.
- already_supported: explicitly satisfied with an existing coach/plan or declines because already supported. Mere coach ownership is not refusal.

Review requires full_thread_reviewed:true, summary, reviewed_by, exact verbatim evidence_quote, exposure_message_id referencing the actual earlier training_opened/invited outbound, and policy_revision matching that exposure (legacy_unversioned only when absent). Offer declines require invited exposure. Multiple categories can coexist if each has evidence. No inferred classification from emojis, gratitude, no goal or silence. Historical generic declines stay unclassified until reviewed; never invent a new assignment for an old chat.

The report retains old group totals and adds distinct-account category counts plus pushback_cohorts by arm, exposure revision and event kind. Categories overlap, so do not sum them as people. Compare the same revision and equal 48-hour reply/7-day downstream windows; include assigned-but-unexposed, unknown and immature cases. Zero newly labelled receipts is not proof of zero pushback. The wording revision is a new analysis cohort within the same arms; do not compare it to old wording as a clean timing effect.

# Free challenge conversation timing pilot

Shannon authorised a prospective A/B/C timing test on 28 October 2026.
The same casual free pre-Christmas challenge is used throughout:
A introduces training in conversation one, B in conversation two, C in three.
The copy is freshly written to actual context, not three different scripts.

Conversation means a separate reciprocal episode, not a message or bubble.
Shannon clarified that a later Story reply OR direct follow-up DM we send
starts the next exchange when the person actually replies.
Record the exact new canonical opener and the person's subsequent inbound,
after reviewing the prior conversation's boundary. More bubbles, elapsed time,
and worker wakes do not increment the count. Answered Sunday follow-ups do;
unanswered outgoing messages do not.
No forced daily contact, silence follow-up or new sender.

Only new eligible organic Instagram business conversations enter the clean
comparison. Pre-launch reciprocal histories, clients, prior offers/training
pivots, paid enquiries, internal tests, protected/personal contacts and holds
stay out. Historical warm conversations can retain their normal authorised
handling but must not be labelled as first-conversation experiment exposures.
The reviewer must verify complete history, identity and eligibility, then call
`assign_balance_challenge_timing` with the current inbound and honest review.
Assignment is deterministic from stable account/handle identity, approximately
one third per group, persistent across wakes and idempotent retries. Never
choose a group based on perceived enthusiasm or switch groups after a reply.

`balance_challenge_timing_context(thread_id)` returns assignment, actual episode
number, whether training is due and existing source-backed event receipts.
It is included in the installed sole responder's consolidated context read.
For a later exchange use `record_balance_challenge_timing_conversation`
with the exact new inbound, reviewed previous end-message and new opener
message. The database validates their identity/order and prevents reusing an
opener to manufacture another conversation. Use `new_story_exchange` or
`separate_returning_exchange` according to the actual source. This adds no new
Sunday outreach permission; existing review/claim/holds remain mandatory.
Below the assigned episode, continue natural rapport without a forced fitness
pivot. At the assigned episode, take the next natural opening. If it is
inappropriate, wait: timing is an earliest opportunity, not a required pitch.
Answer direct fitness/challenge enquiries immediately; record the actual
inbound as `timing_override`, retain the original group, and report the deviation.

When gym context is known, a casual cutting/bulking/maintaining question may fit
their language; for runners use running context. If inactive, ask whether they
want to restart, respecting no. No formal goal interview or coach-status gate.
Invite a little **free pre-Christmas challenge**, not a coaching sales package.
The initial invitation may be short and omit price/billing details. Answer
direct price questions immediately. Explain program, general meal plan/support,
app community and weekly check-in when asked. Before enrolment disclose the full
four-week free duration, no card/automatic billing and optional AUD $14.99/week
continuation only if explicitly chosen. Existing actual suitability review,
acceptance and capacity reservation remain mandatory. Same six-person intake;
never reset or silently expand it to get a larger experiment sample.

After actual delivery and canonical readback, call
`record_balance_challenge_timing_event` with the exact canonical message UUID
for `training_opened` or `invited`. Record `interested` or `declined` only after
reviewing actual subsequent inbound meaning. Record once, preserve retries and
uncertain delivery, never resend to obtain measurement. A plan or draft is not
an exposure. The claim helper checks assigned timing for reviews marked
`trainingPivot:true` and for invitations; this is additional to unchanged
source, account, lease, holds and native send gates, never a replacement.

`balance_challenge_timing_report()` reports all three groups, assigned people,
actual training openings, invitations, interest, declines, overrides, accepted
capacity reservations and completed onboarding. Keep people who never reach
the second/third episode in the assignment denominator. Compare like follow-up
windows and report time/attrition as well as per-invitation response. Interest
is not acceptance, onboarding is not a paid sale, workout set rows are not
complete workouts, and appreciation is not paid continuation consent.

The five remaining intake places are a small pilot, not enough for a reliable
winner. The daily reviewer may report evidence but must not change assignment,
phrasing, thresholds or the offer mid-test to chase results. It remains a
read-only evaluator, not another sender. Existing no-experiment guidance from
21 October is superseded for this specific approved timing pilot only.

Database objects are service-only with RLS and revoked public grants, following
[Supabase's database access guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
Controlled SQL fixtures run in a rollback transaction and send nothing.
