# New-client onboarding support

Authorised by Shannon, 26 October 2026. Applies to newly assigned Balance clients,
including the two 25 October assignments. Keep each historical access agreement.
This extends the existing sole Meta Business Suite operator and five-minute
`refresh_workout_accountability()` server job. No additional sender or worker.

## Installation and activation

Future ready messages must include the actual Apple App Store/Google Play link,
using a reliably known phone platform or both when unknown. Preserve and explain
the exact private invitation separately: install Balance, activate coaching with
the invitation, then log in to the installed app with the same account. A download
does not prove installation, login or activation. The guarded preparation RPC now
rejects website-only handoffs. Use `phone_platform: ios|android|unknown` in its
truthful review. `netlify/functions/_lib/coaching-app-handoff.js` builds the exact
store/activation text; ordinary surrounding conversation remains context-led.
Do not resend an already delivered invitation just to update its wording.

## First two evenings

At an owned safe queue boundary, after fresh reactive work, call
`refresh_client_onboarding_support()` then `client_onboarding_support_due()`.
These events are created automatically for new active coach relationships from
24 October onward after verified app onboarding/login, exact native account
linking and a confirmed timezone. Existing coached setup timezones are reused.
The night after assignment is `setup_check`, 19:00–22:00 in their timezone; the
following night is `routine_check` in the same window. Never send expired catch-up
messages. An unresolved delivery is a Needs You card, never a claimed success.

Read full newest native/canonical history, actual app profile/program, recent
logins, workout history, client instructions and cross-channel contact first.
Never talk over a new unanswered inbound, active conversation or existing action.
If the conversation already covered an event's purpose, mark that exact pending
event `skipped` with reason/source evidence; do not send a redundant check-in.
Keep identity, safety, authenticity, personal/manual and opt-out holds intact.

Night one: casually check how setup/program feels and whether anything needs
changing, using the person's real context. Example shape, not fixed copy:
"How'd you go getting settled in? Anything you'd like changed in your program?"
Explain once that week one has a bit more support to help them find their flow.
Ask one useful question, never invent a personal detail such as a person named
Dave. Last login is account activity, not proof they installed the native app.

Night two: a short human check-in, then the next useful missing decision. Reuse
the saved program days and ask whether they suit them, rather than asking their
whole availability again. Distinguish flexible suggested sessions from agreed
appointments, and gentle recovery from strength sessions. Confirm
timezone only if unresolved; do not substitute Brisbane for Sydney.

Ask whether messages on their training mornings and a short after-session check
would help. A coach's instruction to offer support is not the member's reminder
consent. If they agree, call the existing `configure_workout_accountability`
with the exact inbound consent ID, confirmed days/times/timezone, exact saved
session names and actual access dates. Reuse existing consent if genuinely
present; never manufacture a consent ID or truth flags. If the client declines,
keep included weekly reviews and disable reminders without repeatedly asking.

Prepare via `prepare_client_onboarding_support(event_id,final_text,latest_id,review)`.
The review requires true `full_thread_reviewed`, `native_identity_verified`,
`independent_holds_checked`, `no_duplicate_verified`, `app_context_reviewed`,
`cross_channel_contact_reviewed`, plus truthful `reviewed_by`. Claim only its
returned exact manual action through the existing claim/owned-native path.
Call `reserve_client_onboarding_support` with event/action/token/run/tab immediately
before Send, require true, recheck native context/owned guard, send once, and
record through `record_client_onboarding_support(event_id,token,status,receipt)`.
`sent` requires `native_verified:true` and exact canonical outbound message ID.
Otherwise record `uncertain`, reconcile without repeating, and complete the
shared action only with verified source/version/recipient delivery evidence.

## Training-day rhythm and taper

Use the existing `workout_accountability_due`, prepare/reserve/record and native
claim sequence. All consent, identity, hold, fresh-history and no-repeat gates
remain. Compare app history plus conversation; never infer attendance from sets,
app opening, a calendar entry or absence of a log. If history already records the
matching session, suppress the morning/evening prompt.

- Days 1–7: morning commitment prompt, normally 08:00 local (earlier for an early
  session, no earlier than 06:00); morning windows expire by 10:00 or 30 minutes
  after the session, whichever comes first. "Still good for your session today?"
- A yes gets a short acknowledgement, not another intake. A no gets one useful
  question about another day if they have not already supplied it. No guilt.
- A matching logged session may earn a short "How'd it feel?" follow-up during
  the first 14 days. Say logged, never claim full completion from set rows.
- If no matching log, the existing evening window asks how they went; do not say
  they missed it unless they said so. Logged and evening are alternatives.
- Days 8–14: no routine morning prompts. From day 15: no routine post-log prompts;
  retain context-reviewed unlogged-day support and the included weekly review.
  Do not chase an unanswered check-in or turn every missing log into a message.

Read cross-channel conversation and recent sent events before each send. At most
one morning and one post-session/evening touch per training date, with a live
conversation taking precedence. A member asking to stop disables their specific
enrollment immediately; never treat a scheduling no as a global opt-out or vice
versa. Weekly reviews use the weekly-client-checkin skill's actual evidence.

## Moving a session

After their exact request supplies an unambiguous target day/time, review the
current program, recovery spacing, restrictions, other sessions and recent
messages. Resolve relative dates in the member's confirmed timezone. Ask only
for a genuinely ambiguous date/time or weekly-versus-this-week scope. Never
move exercises or choose a recovery prescription from a scheduling reply.

`move_workout_accountability_session(enrollment_id,source_message_id,source_date,
target_date,target_time,scope,expected_program_updated_at,review)` atomically moves
the actual saved app workout and reminders. `scope` is `this_week` or explicitly
requested `weekly`. Default a one-session request to `this_week`. Review requires
true `full_thread_reviewed`, `explicit_move_request`, `target_date_confirmed`,
`schedule_safety_reviewed`, `independent_holds_checked`, and `reviewed_by`.
Supply truthfully after checking the live request, never a bare yes to a different
question. Only an unlogged agreed session can move to an empty day. No silent
swaps, stacked workouts, broad regeneration or training prescription changes.

Read back the move receipt, exact program workout/day/time, and reminder schedule
before saying it moved. Temporary moves restore the usual week after the target
day. A newer human program/reminder edit blocks restoration and raises Needs You;
it is never overwritten. Cross-week one-off moves, occupied destinations,
overlapping temporary moves, unclear requests and safety/program conflicts stay
in the existing program-repair review lane with an exact explanation. Never
claim an unsupported move happened. Already completed/logged sessions do not move.

## Verification

Apply `database/client-onboarding-support.sql` through authenticated Supabase.
Run its controlled fixture in a transaction followed by rollback:
`supabase/tests/client-onboarding-support.sql`. Fixtures test actual eligibility,
queue/source invalidation, manual holds, no implicit reminder consent, duplicate
refreshes, morning timing, taper, move/readback/restore, later-edit preservation,
and private permissions. No real client messages are tests. Application checks:
`node --test tests/coaching-app-handoff.test.js tests/free-coaching-month.test.js
tests/free-starter-access.test.js`. This change adds no mobile UI.
