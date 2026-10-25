# Finite shortlist Direct check-ins

The 25 October campaign permits casual catch-ups after old unanswered messages,
including former clients. It excludes unanswered messages sent within seven days,
independent holds and pending inbound owned by the existing responder.

Some reviewed recipients have native Instagram conversations but no canonical
thread. The existing `user_requested_checkin_v1` policy requires a real canonical
thread and latest message. Do not create placeholder subscribers or message IDs.

The separate `shortlist_native_direct_20261025_v1` branch is restricted to eleven
named recipients in that finite campaign. It requires fresh native identity,
Following and full-history review, exact native conversation, saved independent
gate evidence, explicit campaign authority, and empty canonical identity/history.
A canonical identity appearing requires the canonical policy and another review.
It does not change the existing canonical-thread policy.

Create a `manual/reactivation` action with null `thread_id` and null
`source_message_id`, through the existing upsert without superseding holds.
Claim **that exact action** with `claim_ig_shortlist_native_action`; use `SELECT *
FROM function(...)` to invoke a composite-returning mutation once. The claim
requires the exact version/run/tab/final text and the shared Instagram lease.
Existing `ig_browser_action_owned` accepts the legitimate null source through
the policy predicate. `reserve_ig_shortlist_native_send` reserves once; expired
reservations, competing owners, live and archived campaign attempts stay blocked.
All new functions are invoker functions, executable only by `service_role` and
the database owner. No browser lease or existing sender permission is broadened.

Native Send still requires fresh exact account/recipient/composer checks and one
tab-bound activation. Record native proof and the unique canonical echo created
by normal ingestion. Never insert a subscriber ID based on a native Direct ID,
retry a reservation, or use a Story/welcome action to send this opener. The
existing responder owns any actual inbound reply.

Offline regression tests execute the migration against in-memory PostgreSQL
using `@electric-sql/pglite` 0.5.11. Install the test dependency outside the repo
or in a development environment and run:

```powershell
$env:PGLITE_MODULE = '<absolute path to pglite/dist/index.cjs>'
node --test tests/shortlist-native-direct.test.cjs
```

These tests use an isolated fixture database and never connect to production or
contact people. They cover authority, scope, timestamps, seven-day exclusion,
identity/source integrity, hold/owner conflicts, legacy behavior, exact claims,
one-use reservation, expired retry protection and restricted privileges.

The final shortlist also contains `yadi.z95`, whose real canonical thread
`ded9b806-8598-4a44-878a-45e8e94177ef` has no canonical messages. Migration
`20261025034230_shortlist_exact_empty_canonical.sql` permits that exact existing
identity through the same native Direct path, retaining a null source message.
It requires zero history across the handle and Graph aliases, the matching
Instagram identity, no linked client or independent hold, and every existing
native review, authority, ownership and no-repeat check. A new canonical
message or second identity blocks this exception and requires fresh review.
This does not authorize a send without reviewing the native conversation and
current Story availability.
