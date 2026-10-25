# Exact native-only owed reply

Shannon's 25 October request to resolve the 21 shortlisted owed conversations
includes one native-only incoming turn from `forster.alice`. Her real Instagram
Direct ID and MBS conversation ID are distinct and must remain distinct. There
is no canonical thread, subscriber or inbound message UUID. Do not invent one.

The additive service-only helpers in
`20261025074000_exact_native_only_owed_reply.sql` support only this exact reviewed
recipient, native conversation, incoming text, displayed local time and actual
referenced Story. `native_source_key` is an internal composite evidence key, not
a claimed Instagram message ID. The action remains `dm_manager/reply_inbound`,
with legitimate null canonical thread/source. Existing claim paths and the shared
`ig_browser_action_owned` function are unchanged. No inbox row is manufactured.

The sole MBS operator first rechecks full native history, profile identity,
Following, actual incoming source, no later reply, canonical aliases, independent
holds and existing live/archive attempts. It may decide the exchange is already
closed; this installation does not require a send or a challenge pitch.

For a genuinely owed eligible reply, use `upsert_ig_next_action` with null
thread/source, `p_supersede=false`, exact handle, owner `dm_manager`, action type
`reply_inbound`, and reason policy `native_only_owed_reply_20261025_v1`.
Include the exact native identity/source fields enforced by the migration;
true full-thread/identity/Following/hold review, pending inbound and no-later-reply
assertions; nonempty proof/gate references and authorization request ID; this
chat's actual authorization; fresh `native_reviewed_at` within five minutes,
authority expiring within 24 hours, actual `balance-reactive-` run and final text.
Never set review flags before doing the actual review.

Call `claim_ig_exact_native_owed_reply(action_id, version, run, own_tab, final_text)`
once and require the matching row/token. Check the existing owned guard with a
null canonical source before filling. Recheck native context and exact ownership
immediately before reserving through `reserve_ig_exact_native_owed_reply`.
Require one fresh reservation, then use the existing native SendONCE guard and
one activation. Every reservation is permanently no-repeat, including a failed
pre-activation check. No live-person test or second attempt is authorized.

Verify native delivery/composer clearance and the unique correct canonical echo
from ordinary ingestion. Complete the original exact claim with native proof,
actual canonical outbound UUID, no-repeat and activation evidence. If the echo
is delayed, retain the immutable reservation and reconcile without resending.
Do not claim a Graph echo from a synthesized receipt. Keep technical failure
visible rather than inventing delivery or weakening eligibility.

Run the isolated PostgreSQL tests with `PGLITE_MODULE` pointing to the existing
external PGlite installation and `node --test tests/exact-native-owed-reply.test.cjs`.
They create no production data, messages or browser actions.
