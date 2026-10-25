# Explicitly requested Instagram messages through Meta Business Suite

Shannon authorised this correction on 25 October 2026 after Jess's programme
check-in and Jo's named free-offer continuation were blocked by a Messenger-only
predicate. An existing outbound is not a permanent ban on another message.
Duplicate prevention applies to the exact request/action and uncertain delivery.

Use the existing sole MBS dispatcher, manual owner, reactivation action and
`user_requested_checkin_v1` policy. Record the actual human request/evidence,
issued/expiry times (maximum 24 hours), exact reviewed text, Page/account/native
conversation, full review flags and expected latest canonical message. The source
is that actual existing message, which can be outbound; never fabricate inbound.
Linked-client status alone does not block a specifically authorised check-in.
Independent holds on known aliases, changed context, wrong ownership and prior
certain/uncertain delivery still block. This grants no recurring follow-ups.

Claim through the existing queue; check the existing action-owned function before
typing and immediately before Send. Send once and verify visible delivery, empty
composer and screenshot. Complete with the original action/token and canonical
receipt fields, including `claim_run_id`, `source_message_id`, `sent_at`, exact
`delivered_text`, `authorization_request_id`, `native_verified` and `no_repeat`.
An uncertain attempt is terminal pending reconciliation. The narrow receipt
extension supports a manual action whose exact reviewed source was outbound.

Installation: `database/mbs-authorised-instagram-messages.sql`. The migration
preserves the existing Messenger branch and global surface/claim functions.
Verification: `supabase/tests/mbs-authorised-instagram-messages.sql`, a rolled-back
database-only fixture with no live messages or lasting customer changes.
