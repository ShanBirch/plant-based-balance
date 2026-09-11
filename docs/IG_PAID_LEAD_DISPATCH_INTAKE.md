# Paid ad lead registration and dispatcher intake

Every real Instagram ad conversation belongs in the existing `ig_threads` lead
record. Graph and ManyChat inbound handlers merge `paid_lead_dispatch` into that
record when verified attribution and the Shannon account are known. Repeated
messages keep the first registration and any later dispatcher metadata intact.
This does not modify lead stage, consent, auto-send flags or `ig_next_actions`.

## Mandatory dispatcher preflight

On every wake, after the lease check and before lane zero-inventory caches, run
`scripts/ig-paid-lead-dispatch-intake.sql` against live Supabase. This read-only
query also finds older attributed conversations and referrals that arrived after
the message. It requires a canonical inbound, excludes internal tests and merged
threads, and exposes current holds rather than losing those contacts.

Record newly observed thread IDs in the shift's `next_resume.paid_lead_intake`:
`observed_at`, `registered_thread_ids`, `held_thread_ids` with reasons, and
`pending_nurture_thread_ids`. Merge/deduplicate by canonical thread ID across
wakes; preserve the existing weighted cursor. For large inventories, page the
SQL by `t.id > <last UUID>` with a limit of 200 and retain that intake cursor
until the boundary; never rescan only the first page. Reset at a completed
boundary so changed permissions, new usernames and delayed attribution are seen.

Newly registered IDs invalidate relevant relationship/ranked Story inventory
caches. Registration needs no Story, follow-back, warm score or purchase signal.
Do not open Instagram merely to register someone.

Only `review_for_nurture` rows may be considered for the pending nurture list.
On the relationship Story lane, inspect these leads' current Stories even if
they sent only one ad message. If actual lead-authored qualification evidence
exists, the ranked lane can use it under its usual contract. One ad message
alone never promotes commercial stage or buyer intent. No live Story means
retain membership for another appropriate opportunity; it does not permit a
cold Direct follow-up or an invented Story interaction.

Immediately before collecting any proposed action, apply every existing live
identity, ownership, payment/client, opt-out, operator-lock, cooldown, unanswered
message, no-repeat and manual-review gate. This SQL is intake, not a complete
send-eligibility evaluator. Reuse the existing action controller only after those
checks. Registration must never supersede a DM-manager or Shannon-owned action.
The existing DM approval policy still applies. Nothing in this handoff sends a
message, starts a new automation or resumes a paused dispatcher.

## Verification

Run `node --test tests/ig-paid-lead-dispatch-intake.test.js` and the existing
Graph/ManyChat acquisition and webhook suites. Run the intake SQL read-only in
production. Validate SQL dispositions with read-only typed fixture CTEs; do not
insert test contacts, submit test DMs or trigger any send endpoint.
