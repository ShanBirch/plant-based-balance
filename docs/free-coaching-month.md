# Private coached month

Shannon confirmed on 24 October 2026: use the private starter invitation for one
free month of coaching. Gather availability in chat, prepare the program, then
return to that chat with verified access. Basic profile and food preferences stay
in onboarding. Members do not build workouts or complete a course.

Only newly prepared `coached_month_v1` grants use this experience. Historical
starters, including Jessie, keep their original program, course and promises.
Nothing creates a payment or subscription. Continued coaching is AUD $14.99/week
only after explicit agreement and a verified payment path.

The month starts on invitation claim and lasts one calendar month. Claiming binds
the exact program and coaching relationship to the authenticated account in one
transaction. Another account cannot claim it. Existing assigned programs and
paused coaching relationships require individual review, never replacement.

## Separate preparation and dispatch

Shannon explicitly confirmed the split in this chat: the dispatch manager must
not build programs. It collects the agreed details and queues a durable job, then
continues responding. The dedicated **Balance Coaching Setup Worker** chat claims
that job, prepares and verifies the program, and returns a database receipt. Only
the existing Messenger/MBS dispatcher sends the ready message to the original
conversation. Neither role has to wait for another approval for ordinary work.

### Dispatcher's quick handoff

1. Review full native/canonical history, organic offer fit, exact identity,
   independent holds and historical promises. Reuse known information; collect
   only missing goal, days, local times, IANA timezone, equipment, realistic
   session length and restriction/training context. No required call or course.
2. Call `queue_balance_free_coaching(p_thread_id,p_acceptance_message_id,
   p_timezone,p_schedule,p_equipment,p_goal,p_session_minutes,
   p_movement_restrictions,p_review)`. Schedule is ISO weekdays, for example
   `[{"weekday":2,"time":"16:30"},{"weekday":5,"time":"17:15"}]`. Equipment is
   `gym`, `dumbbells`, `bands` or `none`. Use `none_reported` only after reviewing
   actual restriction answers, not from silence. Review requires truthful
   `full_thread_reviewed`, `explicit_free_month_acceptance`, `schedule_agreed`,
   `equipment_confirmed`, `movement_restrictions_reviewed`,
   `independent_holds_checked`, and a nonempty `reviewed_by`. Preserve exact
   availability/training-history source IDs or notes in the review.
3. Read back the exact job and agreed input. Acknowledge preparation through the
   actual owned current reply, verify native/canonical delivery and complete that
   actual source action with `p_status='completed'`. Do not leave an unanswered
   question, clear somebody else's action, claim the plan is ready or wait on
   program-building tools. Continue other conversations immediately.
4. At each owned safe boundary, after fresh inbound work, call
   `refresh_free_coaching_jobs()`, `refresh_free_coaching_setups()` and
   `free_coaching_setup_due()`. Only a separately verified worker completion can
   appear here. Re-read the exact setup, job and newest full conversation.
5. Compose a brief ready message using the exact returned `invitation_url`.
   Truthfully say the program is prepared and basic profile setup loads it into
   their account. Inbox holds messages/check-ins; Nutrition has meal planning.
   Do not claim an account or saved meal plan already exists. No course task,
   checkout, automatic billing or another permission question.
6. Call `prepare_free_coaching_ready(p_setup_id,p_final_text,
   p_expected_message_id,p_review)`. Review requires truthful
   `full_thread_reviewed`, `native_identity_verified`,
   `independent_holds_checked`, `no_duplicate_verified`, `answers_latest_turn`.
   An occupied controller waits. Claim only the returned exact action through
   the existing `manual` owner, actual owned MBS run and exact thread.
7. Refresh the native conversation. Immediately before Send require true from
   `reserve_free_coaching_ready(p_setup_id,p_action_id,p_claim_token,p_run_id,
   p_tab_id)` and the ordinary `ig_browser_action_owned` guard. Send once. Verify
   native delivery plus exact canonical recipient/text readback, then call
   `record_free_coaching_ready(p_setup_id,p_claim_token,'sent',receipt)` with
   `native_verified:true` and `canonical_message_id`. Complete the shared action.
   Record uncertain delivery as `uncertain` and reconcile without resending.

Queued/reserved/uncertain setup notices must be reconciled across interruptions.
The five-minute server job releases stale unattempted setup actions and flags
missed or uncertain delivery. It cannot operate the native browser: actual
customer delivery still needs the healthy authenticated, awake sole MBS operator.

### Dedicated setup worker

The installed contract is `free-coaching-worker-contract.md` beside the MBS
operator contract. Its versioned `free-coaching-runtime` is exported from the
verified shipped commit, so the primary checkout's unrelated edits are untouched.

1. Call `refresh_free_coaching_jobs()` then
   `claim_balance_free_coaching_job(unique_run_id,300)`. Claim at most one job at
   a time; no job means quiet completion. Preserve the returned claim token.
2. Re-read exact acceptance, full canonical history, job input and current holds.
   Check goals, experience, equipment, restriction context and recovery spacing.
   Never invent clearance, build over a changed agreement or overwrite an
   existing program. Individual clinical/programming questions become a precise
   Needs You receipt. The worker never claims MBS or sends client messages.
3. Write exact input to system temp/ignored output. Run
   `node scripts/prepare-free-coaching.cjs <input-file>` from the installed
   runtime. It selects complete video-backed library sessions, fits duration and
   checks every demo URL. It never silently deletes movements for missing demos.
   Library selection alone is not suitability: review the actual resulting plan
   against this person's context. Use individually reviewed programming when
   necessary; do not blindly release a default.
4. Run `node scripts/preview-free-coaching.cjs <plan-json> <preview-directory>
   <confirmed-timezone>`. Open the controlled preview using a temporary hidden
   local server and a separate background browser, verify the actual app calendar
   renderer, correct weekday/rest/time/session mapping and demo controls, and save
   visual proof. This preview does not create an account or grant membership.
5. Renew the lease with `heartbeat_balance_free_coaching_job(job_id,claim_token,
   run_id)` before/after verification and at least every two minutes. Require
   true. A lost lease means stop mutations and let the current owner resume.
6. Call `prepare_balance_free_coaching` with the exact job input and verified
   program. The review must include the original acceptance/schedule/equipment
   flags, `no_movement_restrictions_reported:true`, `videos_verified:true`, a real
   `reviewed_by`, `setup_job_id` and `setup_claim_token`. The server requires the
   live separate-worker lease and exact input match. Read back the prepared row,
   grant, program, invitation hash and confirmed fields. Repeated preparation is
   idempotent by thread; an interrupted worker reuses that same prepared row.
7. Call `finish_balance_free_coaching_job(job_id,claim_token,setup_id,'prepared',
   receipt)`. Receipt requires truthful `prepared_plan_verified`,
   `calendar_render_verified`, `videos_verified`, `invitation_verified`,
   `program_suitability_checked`, plus a specific `suitability_summary`,
   `verification_summary` and saved `visual_proof` path. Read back prepared status.
   This is the handback to Messenger; do not send another chat/client message.
8. On a real blocker, finish with `needs_you` and the exact `error`, source and
   attempted verification. This creates a deduplicated pending review alert.
   Cancel only on actual withdrawal/changed consent. Three abandoned leases
   become Needs You; they never loop forever. Close temporary servers/browser
   tabs after proof. No code edits, force-push, purchases or new billing.

After actual app onboarding, the dispatcher confirms only schedule changes and
asks separately about Instagram workout reminders using the installed workout
accountability contract. Acceptance is not reminder consent. Weekly coaching
reviews are included even when reminders are declined; the server queues review
cards for the weekly-client-checkin skill and permitted Inbox delivery, not
unreviewed automatic messages. Standard course/sales milestones skip this cohort.

## Measurement and verification

- Hypothesis: removing course and workout-building tasks increases completion of
  accepted organic coaching setup and first planned workouts.
- Variant: `coached_month_v1`; primary KPI: verified onboarding / accepted offer.
- Diagnostics: complete availability, prepared setup, ready-message delivery,
  account claim, onboarding completion, meal plan saved, first planned/completed
  workout, weekly review, explicitly agreed paid continuation.
- Sources: setup/acceptance/notice receipts; grant claim dates; existing onboarding
  funnel and activity events; saved meal plans and workout history. Preserve
  existing acquisition attribution, visitor/session and source message IDs.
- Guardrails: no false ready claims, duplicate sends, overwritten plans,
  unsolicited reminder enrollment or automatic billing. Never infer workout
  completion from a few sets or missing logs.
- Decision date: 7 November 2026, using cohort counts and real outcomes.
- Behavioral tests: `node --test tests/free-coaching-month.test.js
  tests/free-starter-access.test.js`; transaction-only database tests:
  `supabase/tests/free-coaching-month.sql`. Replace its program placeholder with
  the canonical builder output. All fixtures roll back; no live messages test it.
