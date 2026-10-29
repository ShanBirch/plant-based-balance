## Free enrolment, paid continuation only when Shannon directs it, 30 October 2026

Shannon explicitly corrected the timing again: do not proactively mention the optional paid price during free challenge enrolment or onboarding, including after interest, setup questions, account access or the welcome. Get them started, establish the unknown goal and help them make progress. His preferred response is “Awesome, I can get you set up now if you like 😊 What are you hoping for, strength, weight loss or just building a routine? Anything in particular?” Adapt to known facts and do not assume weight loss.

The offer is genuinely four weeks free, no card, no automatic billing, no payment obligation and no paid subscription created by joining. Explain those free-challenge facts naturally before accepting enrolment; terms_disclosed in reserve_balance_coaching_challenge means these free terms, not a mandatory paid-continuation pitch. Record free_terms_only:true and paid_continuation_not_offered:true in the review for clarity. Preserve actual acceptance, suitability, provenance, capacity, all holds and setup guards. Do not falsely mark any disclosure or consent that did not happen.

Optional continued coaching remains AUD $14.99/week, as a separate later offer. Wait for Shannon's case-specific instruction to introduce it, for example once the person has done a few sessions and is happy with progress. Do not automatically pitch after a session count, a positive check-in or in week four. A direct question about price or what happens after the free period gets an immediate honest answer; do not evade or imply ongoing coaching is free. Any paid continuation later requires the actual price, explicit separate opt-in and verified payment. Never create a charge/subscription, imply automatic renewal or extend paid access from free enrolment, gratitude or workout completion. Existing paid agreements retain their terms. This supersedes ALL older instructions requiring the optional rate before free enrolment, without changing free duration or capacity. No retrospective correction message.

# Four-week Balance consistency challenge

Authorised by Shannon, 25 October 2026. This supersedes the goal-only organic
free-month invitation and organic call-first guidance. Existing agreements,
paid enquiries and the separate Summer Ready offer retain their actual terms.

## Conversation before an offer

Shannon's 25 October follow-up correction: in an eligible open reciprocal
business conversation, answer first and normally ask one relevant easy question
in the same substantive turn. Short replies should still give the person a
reason to respond. Do not routinely end a fresh substantive answer with only
encouragement or a paraphrase. Follow their topic and take a natural opening
toward their routine, goal, existing support and wanted help; when fit is known,
invite them under the live capacity and terms below instead of interviewing
indefinitely. This overrides generic acknowledgement-only preferences for open
business exchanges. Completed conversations, refusals, space requests, ignored
pivots, known answers, safety/support and independent holds remain exceptions.
No question quota, invented problem, retrospective message or silence chase.

Understand the person's own goal, current routine, existing support and whether
they actually welcome help. A goal, weight-loss history, friendliness or gym
interest alone is not a help signal. Use their complete conversation, reuse known
answers and ask only the next useful missing question, usually one per turn.
Reflect their answer and offer a useful thought rather than stacking questions.
Do not investigate their whole life, manufacture dissatisfaction, or force a
blocker confession. A direct coaching/price question gets a direct answer.

Examples of conversational jobs, never a pasted sequence:
- Routine/support: are they following a programme or putting it together themselves?
- Fit: what part of their current week would they like support with?
- Recognition: explain how the help would fit the real detail they supplied.

Someone happy with their routine or already well supported stays a friendly
connection. Respect refusals, ignored pivots, question fatigue, personal contacts
and independent holds. Calls are optional when requested or genuinely useful;
there is no call or booking requirement for this challenge.

## The actual offer

Name: **Balance four-week consistency challenge**. One rolling intake of six
new participants, with an individual start on verified invitation claim. Do not
invent a common start date, group activities, prizes, deadline or remaining count.
It is four weeks of coaching free, with a realistic assigned workout routine,
general meal-planning support and one weekly training/food review and appropriate
adjustments. No live sessions, course, unlimited replies or guaranteed result.
Focus on a manageable routine and participation rather than promised weight loss.

An invitation connects the person's stated support need to this experience.
It can mention the small six-person intake when relevant. Before enrolment,
explain: four weeks free, no card or automatic billing and no payment obligation.
Do not proactively mention optional pricing during free enrolment/onboarding.
Answer direct price questions honestly; paid continuation is a separate later
conversation only when Shannon directs it for that person.

## Live reservation and existing worker

Read `balance_coaching_challenge_status('consistency_20261025')` immediately before
offering. Stop invitations when closed/full. Say six places in the intake, never
claim six remaining without fresh evidence. Acceptance alone does not guarantee
a place: reserve atomically before confirming enrolment.

After explicit acceptance and disclosed terms, call
`reserve_balance_coaching_challenge(thread_id, acceptance_message_id, review)`.
Review must contain true `full_thread_reviewed`, `organic_fit_verified`,
`routine_understood`, `existing_support_understood`, `help_wanted`,
`terms_disclosed`, `explicit_challenge_acceptance`, `independent_holds_checked`;
nonempty `reviewed_by`, `routine_summary`, `existing_support_summary`,
`help_wanted_summary`; and `source_message_ids` listing the exact inbound UUIDs
supporting that review. The database validates provenance, holds, duplicate
identity and the six-person cap. If full, explain truthfully; no automatic
waitlist, replacement intake or alternative free-month bypass.

Then collect only missing agreed availability/timezone, equipment, session
length and restriction/training context. Use the existing
`queue_balance_free_coaching` and separate setup worker. The queue requires the
reservation for new acceptances. The prepared grant is tagged with the cohort;
access and assigned programme last exactly four weeks from claim. Existing
historical grants/jobs/acceptances retain their promises and do not consume places.
No calendar-month substitution. Repeated reservations/queue calls are idempotent.
All six accepted reservations count even after completion or withdrawal; no silent
refilling, automatic expiry or reopening to manufacture scarcity.

Keep the sole MBS sender and exact native claim/readback/no-repeat path. Send the
verified invitation only when the separate worker has completed preparation.
Reminder consent is separate; weekly coaching review is included. No new sender,
retrospective pitch, silence chase, customer test or unsolicited batch blast.

## Delivery and measurement

Week 1: establish the agreed manageable routine and review the first experience.
Weeks 2-3: review actual training/food evidence and adapt to their real week.
Week 4: review progress. Do not automatically offer paid continuation. Wait for
case-specific Shannon direction before that separate optional offer, then require
explicit paid agreement and verified payment.
No automatic billing, subscription creation, or reminder-consent assumption.

The status RPC reports accepted reservations, queued/prepared setups, claimed
access and completed onboarding. `balance_coaching_challenge_progress` provides
participant-level source IDs and evidence. Workout set rows are participation,
not proof of a complete session. Record verified complete workouts, weekly review,
paid agreement and payment separately using `record_balance_challenge_milestone`;
each requires a verifiable source reference, summary and reviewer. Never label
acceptance, app opening or a friendly reply as a paid conversion. Review the
intake after participants have had their full four weeks, and report operator
time separately. Six participants is a delivery pilot, not a reliable A/B test.

## Implementation verification, 25 October 2026

The additive service-only database contract is in
`database/four-week-coaching-challenge.sql`. RLS is enabled, public access is
revoked, and the progress view uses caller permissions. Security-advisor INFO
notices about no public RLS policies are intentional for these service-only tables.

Validation: 34 focused application tests; transaction rollback checks for six-place
capacity, duplicate retry, help/hold gates, unreserved queue rejection, exact job
attribution, milestone provenance and role permissions; full separate-worker,
claim, delivery/no-repeat and expiry checks for both historical calendar-month
and new four-week grants. Generate these controlled SQL fixtures with
`node scripts/free-coaching-db-fixture.cjs` and `--challenge`; run through the
authenticated SQL tool. No fixture sends a message or persists a participant.

Mobile copy was inspected using actual onboarding markup, styles and access-copy
code in 16 controlled states: 320x568/667x375, light/dark, zero/59px top safe area,
scrolling and reopening. Header and bottom action clearance passed; screenshots
are ignored local verification output, not production-user screenshots.
