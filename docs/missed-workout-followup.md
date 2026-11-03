# Missed-workout follow-up, 3 November 2026

Shannon authorised this new Instagram support lane for Joanne Glasby
(@joanne_aka_jo_) and verified new organic challenge clients from her intake
onwards. He confirmed Joanne when asked about “Joe”. Nat and Shane remain
excluded. Use positive `organic_outreach_cohort_allowed` evidence; age, names,
missing payments or an ordinary coach assignment do not establish eligibility.
This does not change established clients' reminders or agreements.

Use the existing five-minute `refresh_workout_accountability()` materialiser and
sole native Instagram messenger. No second sender or additional scheduler.
`database/missed-workout-followup.sql` extends the existing evening event,
preparation, phase eligibility and immediate pre-Send ownership path.

New due time: **19:30 in the member's verified timezone**, or 90 minutes after
the agreed workout start if later. Existing clients keep their old timing.
Expire at the existing 22:30 quiet-hour boundary; never catch up tomorrow.

After verified completed onboarding, exact native linkage, active programme,
reminder enrollment, support choices and independent hold review, call
`configure_missed_workout_followup(enrollment_id,program_id,review)` with truthful
`shannon_authorized`, `exact_identity_verified`, `current_program_reviewed`,
`support_choices_reviewed`, `independent_holds_checked` and `reviewed_by`.
No fabricated member consent, automatic reminder enrollment or hold release.
App after-session-off/both-off blocks this lane immediately. App choices still
need the existing reconciliation/configuration path. Unknown support permissions
require review. For an opt-out set `missed_workout_followup.enabled=false` and
read back; retain the row and receipts so old evening permission cannot revive it.

At each owned safe boundary after fresh inbound/service work:

1. Refresh and read `workout_accountability_due()` as usual. For an evening event
   with a `missed_workout_followup` row, read the row, current saved programme,
   timezone, support preferences, workout evidence and complete current native
   conversation. Verify the actual session is scheduled today and its start has
   passed. Rest days, any logged activity, an in-progress session, self-reported
   completion, already-discussed absence or an active conversation suppress it.
   No missing-log accusation. Recovery-sensitive cases go to Shannon.
2. Offer the smallest useful next step. Example only: “Hey Jo, I haven't seen
   today's workout logged. Did you get a chance to do it, or would moving it to
   tomorrow help?” Personalise naturally. Only offer tomorrow after checking
   that it is a safe empty day, inside the supported same-week move window and
   the member's access dates. Otherwise ask which day would suit, without
   promising an unsupported move. Never reschedule without their actual reply.
3. Preparation additionally requires true `app_context_reviewed`,
   `opt_out_reviewed`, `live_conversation_reviewed`,
   `cross_channel_contact_reviewed`, `no_completion_reported`, `not_in_progress`,
   `purpose_not_already_covered`, and truthful `reviewed_by`.
   Preserve ordinary fresh native identity/source, account restrictions, holds,
   lease, exact action/version, reservation and one-activation proof.
4. Before Send, `reserve_workout_accountability` and the normal owned guard must
   both pass. Three unanswered attempted optional workout contacts is the ceiling
   across enrollment versions, including uncertain sends. The database serialises
   this budget check. It excludes only this exact event from its own count, so
   the third reservation stays ownable. Human outbounds, read receipts, a
   restart, programme edit or reconfiguration cannot reset the streak. A genuine
   later inbound resets the count, but cannot clear an opt-out or another hold.
   At most one evening event per training day; no repeated reminder for one miss.
5. Verify native and canonical delivery and record through the existing receipt
   RPC. Uncertain means reconcile without resending. A server event is queued
   work, not delivery; desktop/browser unavailability remains a real boundary.

If they agree, use `move_workout_accountability_session` with the exact inbound,
unambiguous target date/time, current programme version and safety review.
Default to this session only. Preserve occupied-day, same-week, recovery and
programme-edit guards; route unsupported cases to the existing repair review.
Read back programme and reminders before saying it moved. Do not invent a
training time from a bare yes or claim success from a queued request.

Measurement: hypothesis `missed_workout_recovery_20261103_v1` is that optional,
bounded help improves the next planned/completed workout without repeated silent
chasing. Event IDs, reservation timestamps, native/canonical receipts and exact
inbound/move receipts are the evidence. Primary KPI: completed recovery workout
after a delivered offer and accepted move. Diagnostics: due/held/expired,
delivered/uncertain, replies, accepted moves and successful verified moves.
Guardrails: zero fourth unanswered attempts, duplicate sends, excluded clients,
opt-out sends or unconsented moves. Review on 10 November 2026; missing data is
unknown, never success or a conversion-lift claim.

Verification: run `database/tests/missed-workout-followup.sql` in one transaction
followed by rollback. It uses exact source-verified enrollment fixtures, changes
no lasting client state and sends no messages. No UI change or Feature Drop.
