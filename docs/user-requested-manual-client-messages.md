# User-requested messages for manual clients

A recipient may have `custom_data.user_requested_messages_enabled=true` only
after Shannon explicitly asks to permit requested messages while automatic
replies remain off. This setting never authorizes an automatic reply.

Keep `manual_review_only`, `auto_send_enabled` and automatic-reply pause settings
unchanged. The existing native manual `reactivation` action with
`policy=user_requested_checkin_v1` must still carry a fresh, specific human
authorization, evidence reference, exact final text, full conversation and native
identity review, expected latest message, and expiration within 24 hours.

Use the dedicated `user_requested_messages` browser lane for a direct human
request. It shares the existing native sender and queue, has no schedule, and
accepts only reviewed manual requested-message actions. Its session scope is
independent from automated Messenger and Story work. Same-tab collisions,
recipient claims and all send guards remain shared. Do not borrow their tabs.

The Instagram requested-message validator ignores only `manual_review_only` on
an explicitly configured recipient. Every other independent hold, alias check,
source freshness, no-repeat receipt, browser/action ownership, and shared daily
message reservation remains enforced. The ordinary automatic-reply path is
unchanged. Do not clear recipient protection flags to perform a requested send.

Run `supabase/tests/user_requested_manual_client_messages.sql` with service-role
database access. It uses an existing manual-review thread, sends nothing, and
rolls back all test data edits.
