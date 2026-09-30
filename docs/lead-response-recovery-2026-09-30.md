# Lead response recovery, 30 September 2026

## What failed

Inbound messages reached the database. Failures occurred after ingestion:

- The draft thread projection omitted creation time. Fresh organic conversations
  therefore missed the current Summer Ready Shred route and used the legacy flow.
- Paid challenge replies could be assigned to a dormant local Learn worker.
  No such worker was installed on the current Windows host.
- Writer/reviewer current-turn guidance prioritized the final bubble over earlier
  rapid unanswered goals/questions.
- The local manager repeatedly abandoned large canonical inbox results or
  reconstructed them incorrectly. Historical pending alerts inflated those reads.
- Direct human instructions below the automatic learning header could be replaced
  by new style learning; a slow learning write could also overwrite a newer edit.

## Changes

Load thread creation time and resolve the current challenge before deciding local
worker ownership. Current challenge enquiries use the existing cloud writer,
reviewer and guarded sender. Legacy non-challenge ownership remains scoped.

The writer, reviewer and repair prompt cover the complete unanswered turn.
Earlier unanswered questions are not downgraded to history by a final short reply.

Canonical inbox reads default to one complete conversation. Preserve all
unanswered messages and current/scheduled alerts; report historical pending alert
counts separately. Capture actual connector JSON and copy receipt identity/source
fields programmatically. Exact-thread validation cannot claim full inbox coverage.

Protect explicitly labelled Shannon directions/facts as manual authority. Apply
learning only when the stored instructions still equal the original read; skip
missing baselines and changed rows instead of overwriting them.

## Validation

74 focused checks pass across routing, loaded creation time, rapid batches,
instruction preservation/concurrent edits, canonical identity/coverage, run leases,
warning repair, customer handover, health disclosure and challenge channel timing.
A live read-only canonical capture/receipt check also verifies the connector
persistence path without sending or claiming a customer conversation.

The pre-existing send-ig-reply-challenge-offer timing assertion at line 185 fails
identically on origin/main (expected 08:39:30, actual 08:39:00); it is unrelated to
this change and has not been altered.

No policy hold, reviewer verdict, identity check, active foreign claim or booking
consent rule is relaxed. The Summer Shred conversation's existing chat remains
its owner. No customer message was sent by this repair task.
