# Four-week Balance consistency challenge

Current composition and offer authority: the installed current-conversation-policy.md (organic_natural_20261101_v1, Shannon1November2026). The experiment is retired prospectively; historical records stay intact. Genuine person-specific rapport then an optional invitation when it naturally fits, no fitness/goal/blocker/coach qualification or assigned episode/approach. Useful unknown setup questions follow interest. Respect refusals and silence.

Four weeks free from verified invitation claim, realistic assigned workouts, general meal-planning support and one weekly training/food review with appropriate adjustments. No live sessions, unlimited replies, guaranteed results or invented common start date. Clearly disclose before enrolment: no card, no automatic billing and no obligation to continue. Direct price questions get honest immediate answers. Otherwise contextual optional continued coaching is authorised only after actual product use and time to judge value at a suitable later point; verify current AUD14.70/week and billing terms, obtain separate explicit paid agreement/payment. Never proactively price during free enrolment/onboarding or auto-bill. Historical agreements retain their terms.

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

Keep the sole native Instagram reactive sender and exact native claim/readback/no-repeat path. Send the
verified invitation only when the separate worker has completed preparation.
Reminder consent is separate; weekly coaching review is included. No new sender,
retrospective pitch, silence chase, customer test or unsolicited batch blast.

## Delivery and measurement

Week 1: establish the agreed manageable routine and review the first experience.
Weeks 2-3: review actual training/food evidence and adapt to their real week.
After actual product use and time to judge value, review whether ongoing support fits.
A contextual optional offer may follow at a suitable later point, with verified terms,
separate explicit paid agreement and verified payment. No fixed week/session trigger.
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
