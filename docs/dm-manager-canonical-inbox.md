# Canonical inbox identity and coverage

## Manager transport does not require a local service credential

The guarded production endpoint `send-coach-reply` uses the exact pending alert
UUID as its one-use capability (see its authorization comment and handler).
Supabase service keys and Graph credentials live on the server. The manager must
not look for, copy or extract them into its local runtime. A missing local model,
admin or service key is not a blocker for this supported transport.

On 30 September 2026, a POST using the manager source and a nonexistent test alert
returned HTTP 404 `{"error":"Alert not found"}` without an Authorization header.
This verifies server/database reachability and the actual credential contract;
it does not authorize or prove customer delivery.

For a real eligible reply, validate the fresh exact-thread receipt, check the run
lease, acquire/check the exact controller claim, make the bounded repair/review
and POST `alertId`, `source=balance_lead_client_manager_cron`, `forceText=true`,
`replyTextUtf8Base64` and `draftTextUtf8Base64` to
`https://plantbased-balance.org/.netlify/functions/send-coach-reply`.
Then verify canonical history and finish the exact claim. Do not call a random
alert or the readiness probe a send. Current human takeover holds always win.

The 29 September 2026 local manager paired Mazzie's new message/thread IDs with
Arunima's name and an unrelated workout quote. It then treated a fresh eligible
conversation as permanently manual and the next delta-only scan skipped it.
The Graph webhook and draft writer had received both messages correctly.

`scripts/dm-manager-inbox.cjs` provides read-only joined SQL packets plus a
fail-closed receipt validator. The installed runtime copy is
`C:/Users/shann/.codex/automations/balance-lead-client-dm-manager/runtime/dm-manager-inbox.cjs`.
It requires Node only. It does not send, authorize delivery, or replace existing
identity, safety, transport, run-lease or controller-claim checks.

## Reliable bounded persistence (30 September 2026)

The helper defaults to one full conversation per page. It includes every exact
unanswered message and current alert, every scheduled alert, all coach instructions
and relevant policy flags. Old pending alerts created before the last outbound
are represented by `stale_pending_alert_count`; fetch their full records only
when investigating those historical alerts. They are not new unanswered work.

Save the ACTUAL connector return with `tools.apply_patch` inside the same
`functions.exec` that receives it. Do not pass a large JSON payload through a
Windows command argument, print it to reconstruct it, or retype SQL/identities.
Use unique run/page files, then the helper's capture and receipt commands:

```text
node <runtime-helper> sql 0
node <runtime-helper> capture raw-tool-result.json snapshot.json
node <runtime-helper> sql 0 <exact-thread-uuid>
node <runtime-helper> capture exact-raw-tool-result.json exact-snapshot.json
node <runtime-helper> receipt exact-snapshot.json <exact-thread-uuid> waiting "Concrete current decision" receipts.json
node <runtime-helper> validate exact-snapshot.json receipts.json
```

Pass the SQL command's `output.trim()` unchanged to Supabase; require exit code
zero. Save the raw return as JSON before capture. The capture command understands
the actual connector envelope, rejects incomplete/stale/error results, and
validates canonical thread/message pairing. Receipt creation copies all identity
and source fields directly from the snapshot. It never grants send permission.
After real delivery, add verified readback evidence to the receipt and validate
again. Use `--partial` for page/scan coverage.

An exact-thread decision reports `thread_pass_complete=true` but
`action_pass_complete=false`: it cannot establish that the whole inbox was
assessed. Preserve fresh-page and older continuation work, lease checks, claims,
manual/client/Story/safety holds and guarded delivery.

## Every local manager pass

1. Acquire the existing run lease. Run `node <runtime-helper> sql`, execute the
   emitted SQL with the connected Supabase tool, and save the returned `snapshot`
   object as UTF-8 JSON in the automation runtime folder. Preserve the actual tool
   result, not a reconstruction from memory. No credentials belong in these files.
2. Read each packet as a unit. Identity, exact unanswered messages, alerts and
   controller belong to that single thread. Never zip independent query arrays or
   attach names/quotes from prior prose. Memory supplies history, never identity.
   Freshest conversations come first. Scan older pages using the returned offset
   as time allows; save the unassessed thread IDs for continuation, reloading them
   with the exact-thread query on the next pass. Always scan fresh page zero too.
3. Before a claim, delivery, dismissal, manual hold, notification, or skip, run
   `sql 0 <thread-uuid>` and save that fresh exact-thread snapshot. An empty packet
   means the conversation changed or was answered: re-read it, do not act on the
   previous packet. Read additional live history/account policy when required.
4. Write a receipt array for the exact-thread snapshot. Copy `thread_id`,
   `ig_username`, `profile_name`, `linked_user_id`, `latest_inbound_id` and the
   **entire exact `unanswered` array** directly from that packet, plus `outcome`
   and a concrete `reason`. Never type identity/quoted message fields from memory.
   Outcomes: `sent`, `scheduled`, `needs_you`, `waiting`, `no_reply`,
   `external_owner`, `failed`. Before transport use `waiting`; after transport
   update only with verified canonical readback (`readback_verified`, `evidence_id`).
5. Run `node <runtime-helper> validate snapshot.json receipts.json` before the
   decision takes effect. Failure means reload and correct the mismatch, not bypass
   validation. Permanent-person holds must use `hold_kind=permanent_manual` and
   `manual_user_id` equal to the packet's exact linked user; an explicit live thread
   manual flag is also valid. A name-only match never establishes that exception.
   Other genuine personal, Story, safety, identity and client policy holds remain.
6. Keep receipts in a structured per-thread ledger, including source IDs and exact
   text. Reuse an unchanged notification receipt only after matching its thread,
   identity and source batch to a fresh canonical packet. Never use “notified” as
   “answered”, or a notification cursor as the inbox coverage boundary.
7. Validate the page snapshot and all its receipts with `--partial` at the end.
   Persist its actual `action_pass_complete`, `missing_thread_ids`, `more_pages`
   and `next_offset` output. A partial page/scan is never a completed inbox audit.
   Bound the pass by the existing seven/nine-minute limits. A later page alone
   cannot establish full coverage. No-fresh-delta is not no-unanswered-work.

Ordinary unlinked text with a style warning should be repaired from the full
unanswered batch and reviewed under the existing manager rules, not left behind
the cursor. Do not loosen a real hold to clear the backlog. A waiting outcome is
an assessment receipt, not evidence of a sent reply.

## Reply execution after review

A ready action with owner `dm_manager` belongs to this manager; it is not evidence
that a different worker is handling it. For an eligible ordinary text reply,
claim that exact thread with `claim_ig_next_actions('dm_manager',1,300,run_id,
ARRAY[thread_id]::uuid[])`, repair the wording from live context, and use the
existing guarded production `send-coach-reply` HTTP endpoint with
`source=balance_lead_client_manager_cron`, `forceText=true`, `alertId`, and the
UTF-8 Base64 text fields. Check the run lease and exact claim before delivery.
Verify canonical outbound history, then complete that exact claim. These are
existing SQL RPC and HTTPS capabilities, not separately named connector tools.
Their absence from a tool-name search is not a delivery blocker.

Do not finish with `waiting for bounded review` merely because a normal draft
needs shortening. Perform one bounded repair and review now; if still genuinely
blocked, save the concrete remaining issue and surface it as required. An active
foreign claim, new inbound/outbound, or live safety/manual hold still wins.

The cloud fallback reserves half its scan for newest pending messages and the
rest for older work. A two-bubble reaction with an unrequested conditional offer
may have that second bubble deleted, then receive a fresh real review before it
can schedule. Explicitly negated readiness is not buyer intent; later actual
purchase questions retain their sales handling. No failed review is promoted.

## Incident resolution

Mazzie's batch (`81f214a5-0ce3-41cb-8ea9-786451696792`,
`653fb194-8c9a-49c2-9635-5e4d245ce074`) belongs to thread
`459cf1d5-fe11-4f7d-8114-99746e06cd43`, handle `mazzie_maz_wellness`, unlinked.
The old 09:09 UTC automation memory entry attributing it to Arunima is invalid.
One manager-reviewed text reply was delivered at 09:53 UTC and verified as
`ebefac3b-ff92-4894-98b6-ec17cab0e36f`. Alert
`8014e05d-bc47-4851-b723-7113d443d691` is sent and the exact controller claim was
completed. Do not resend this batch or notify it as Arunima's workout.

Verification: `node --test tests/dm-manager-inbox.test.cjs tests/dm-manager-lease.test.cjs`.
Tests cover cross-person name/text mixing, invalid manual attribution, incomplete
batches/coverage, stale reads, readback requirements and SQL input validation.
