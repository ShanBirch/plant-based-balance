# Consented workout accountability

Shannon authorised this workflow on 24 October 2026. The first organic coaching
month is free; continuation is AUD $14.99/week by explicit agreement. No call is
required. This does not alter an existing customer's agreement or enable billing.

The existing Meta Business Suite dispatcher remains the sole sender. The server
runs `refresh_workout_accountability()` every five minutes, including while the
desktop is asleep. It materialises due events and exposes missed/uncertain
delivery in Needs You. Actual native delivery requires the existing awake,
authenticated browser operator; a server queue cannot itself operate that browser.

## Onboarding and consent

After verified app onboarding, agree the member's workout days, usual times and
timezone. Say naturally: "Hey, if you're happy, I'll message you on the days
you're supposed to work out, just to kind of get you going." Explain the short
after-workout/evening follow-up when agreeing the support. Respect no or stop.
Do not treat free coaching acceptance alone as reminder consent.

Call `configure_workout_accountability` using the exact linked Instagram thread,
inbound consent message ID, confirmed IANA timezone, coaching start/end dates and
schedule array: `[{"weekday":1,"time":"17:00","session_name":"Exact saved session name"}]`.
Weekday is ISO Monday=1 through Sunday=7. Review must record
`full_thread_reviewed`, `explicit_reminder_consent`, `schedule_agreed`,
`independent_holds_checked` as true and a truthful `reviewed_by`. Do the review
first; never invent flags. The account must have completed onboarding. Verify the
session name against their actual programme. Dates must reflect verified access,
not an assumed new month. Current routine slots support 06:30–20:30 local time;
other times require a deliberate quiet-hours decision instead of a silent shift.

Read back the enrollment, schedule, dates and consent source before saying saved.
Never enroll someone merely because they have an app account. Existing personal,
manual, safety, authenticity, support and human-takeover holds win. This specific
opt-in permits the event messages below, not general linked-client auto-replies.
On withdrawal, immediately set this enrollment's `enabled=false` through the
service connector, preserving the consent/audit history. Read back false; any
queued event then fails its action-time eligibility check.

## Existing operator wake and send sequence

Fresh inbound/support work first. At each owned safe boundary:

1. Call `refresh_workout_accountability()`, then `workout_accountability_due()`.
2. Review the full native/canonical conversation, consent, app workout evidence,
   all current client instructions/holds, cross-channel contact and duplicate
   evidence. Never send over a fresh unanswered inbound or active conversation.
3. Compose one casual, specific message, up to 500 characters. Before: help them
   get going with their agreed session. Logged: "Saw your workout logged 😊 How
   did it feel?" only when a matching history session exists. Evening: "How'd
   you go with your workout today?" or gently ask what got in the way when they
   actually said they missed it. Missing logs are not proof of a missed workout.
4. Call `prepare_workout_accountability(event_id, final_text,
   exact_latest_message_id, review)`. Review includes `full_thread_reviewed`,
   `native_identity_verified`, `independent_holds_checked`,
   `no_duplicate_verified`. A competing action is a wait, never supersede it.
5. Claim only the returned exact thread/action through existing
   `claim_ig_next_actions('manual',1,300,owned_run_id,ARRAY[thread_id])`.
   Recheck `ig_browser_action_owned` with the actual source ID returned in that
   action. A proactive event is never fabricated as a new inbound.
6. Fill the native composer, refresh the final native context, call
   `reserve_workout_accountability(event_id,action_id,claim_token,run_id,tab_id)`
   immediately before Send, and require true. Recheck the normal owned guard;
   activate Send once. Reservation survives crashes and prevents retries.
7. Verify visible delivery and canonical exact-text recipient readback. Call
   `record_workout_accountability(event_id,claim_token,'sent',receipt)` with
   `native_verified:true` and exact `canonical_message_id`. If the echo is not
   yet available, record `uncertain` with native proof and reconcile later.
   Never resend for an echo. Then finish the shared action using existing
   `complete_ig_next_action` with matching delivery/no-repeat evidence.

Each workout day permits one before reminder (30 minutes before; expires 30
minutes after), one logged-session follow-up, and one evening check only when no
matching history is recorded (20:00 or 90 minutes after the agreed time, whichever
is later; expires 22:30 local). A recorded session suppresses before/evening.
One event of each kind per member/date survives schedule revisions, avoiding
same-day duplicate nudges. Never manufacture full completion, attendance or
progress from a few rows; `history` records support "workout logged" only.

## Weekly review and missed sends

Saturday creates one weekly coaching-review card per enrollment/week, including
complimentary coaching members. Use the weekly-client-checkin skill and its full
evidence lanes to prepare the review. This is review-queue enrollment, not an
automatic voice message or a claim that a review was completed.

Expired or uncertain messages create deduplicated Needs You cards. Reconcile
source, native/canonical receipts, availability and holds. Do not catch up a
yesterday reminder today, blindly retry an attempt or delete its audit trail.
If browser delivery is unavailable, report that concrete gap. Quiet when unchanged;
notify meaningful missed delivery or required action, rather than marking success
from a scheduler heartbeat.

Jennie's Friday 23 October dinner SMS was a separate Google Messages one-off.
Its recorded invocation arrived at 06:54 Brisbane Saturday 24 October, beyond the
authorised date; it was not sent, and the expired automation was deleted. The
source chat is `01a156f1-b887-7050-a555-8b04a9d10c92`. Do not send a late catch-up,
recreate it as a workout reminder or confuse it with her shopping/email workflow.

## Verification

Schema installation: `database/workout-accountability.sql` via authenticated
Supabase migration. Transaction-only behavioral checks:
`supabase/tests/workout-accountability.sql`. No live client messages are tests.
