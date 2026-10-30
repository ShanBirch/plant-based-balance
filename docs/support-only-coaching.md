# Four-week check-in-only preparation

Use only after exact accepted support alongside an existing trainer and a reserved
challenge place. Do not collect or invent workout duration, times, equipment or
restriction clearance when no workout is being assigned.

The separate worker calls `prepare_balance_support_coaching(thread, acceptance,
timezone, run_id, review)`. Review requires `full_thread_reviewed`,
`support_only_accepted`, `preserve_external_training`, `independent_holds_checked`,
`no_reminder_consent_assumed`, `reviewed_by`, `support_summary` and exact inbound
`source_message_ids`. The service-only transaction creates the exact claimed job
with a five-minute lease; it never claims another queued person's work. Preserve
and renew that lease with the existing heartbeat RPC.

Verify the private token hash, support-only onboarding, authenticated access,
Inbox route and programme preservation. Finish with
`finish_balance_support_coaching(job, token, run_id, receipt)`. Receipt requires
`support_access_verified`, `invitation_verified`, `program_preservation_verified`,
`onboarding_verified`, `inbox_path_verified`, a `verification_summary` and saved
`visual_proof`. Workout calendar/demo checks are not falsely asserted.

The existing `free_coaching_setup_due`, ready-action, sole-sender reservation,
canonical delivery and uncertain/no-repeat reconciliation paths remain unchanged.
The sender explains check-ins and keeping the existing trainer's programme; it
must not claim a new workout programme is ready. No paid pitch, charge, automatic
billing or reminder consent is created. Paid continuation is a separate later
case-specific decision under the current operator policy.

Claiming binds the exact account and coaching relationship, starts 28 days, and
does not insert/update workout programmes or workout calendar facts. Existing
paused relationships, identity conflicts, holds, expiry and revoked invitations
remain guarded. No real customer account is used for tests.

Validation: `node --test tests/free-starter-access.test.js tests/free-coaching-month.test.js`
and transaction-only `supabase/tests/support-only-coaching.sql` through the
authenticated connector. The latter rolls back every fixture and side effect.
