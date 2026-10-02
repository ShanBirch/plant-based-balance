# Dispatcher reliability, 2 October 2026

This runtime entry supplements the live-conversation-contract.md and browser-work-handoff.md in this automation folder. Their latest conversation, consent, scope and identity policies remain authoritative. No new messaging scope is granted.

## Fast startup and coverage

Read this entry, browser-work-handoff.md, live-conversation-contract.md and meal-plan-followup-contract.md once per invocation. Read only the last 12 entries of memory.md. Use the newest Meta Business Suite run's cursor_current/cursor_end as the operational handoff. Do not reread the entire memory, old lane instructions, or the retired API-manager skill. CODEX.md and CLAUDE.md still apply; avoid repeating reads in the same invocation.

Start the runtime clock at invocation, including preflight and browser recovery. Check server time and the newest MBS owner before browser work. Healthy foreign ownership means exit quietly without opening or navigating its tab. No forced takeover. Use existing 300-second surface leases and global source/recipient claims, renew every two minutes, and check ig_browser_action_owned immediately before every native action.

Reach a verified owned inbox scan promptly, aiming within two minutes of invocation. Use one supported browser inventory call with a 30-second timeout and one bounded recovery if needed. If unavailable, persist/report the exact browser fault once and finish this invocation; the next five-minute wake retries. Do not spend the runtime repeatedly loading documentation or retrying the identical browser inventory. Never restart Chrome, change account/profile, or touch foreign tabs.

Maintain cursor_current.coverage with last_successful_inbox_scan_at, assessed_source_ids, pending_source_ids, holds and last_verified_reply_at. Update last_successful_inbox_scan_at only after an actual native scan, not on a heartbeat, database delta check or inherited cursor. Preserve unassessed carried sources and exact uncertain-send receipts. Every acquired pass checks fresh native page zero plus current canonical unanswered turns, then the saved current-scope boundary and pending continuations. A delivered receipt is delivery evidence even when Meta's webhook echo is absent.

If no actual owned inbox progress occurs for over ten minutes, record the gap and give one meaningful failure notice for that gap. A healthy lease explains ownership, not successful scanning. A local scheduler/host outage cannot be fixed by a worker that never starts. Do not claim uninterrupted 24-hour coverage from ACTIVE schedule status alone. No duplicate automation or retired API sender may be enabled as a workaround.

Fresh unanswered clients/leads and active conversations come first. Once goal and blocker are known, use the latest optional-call policy rather than extra discovery questions. Honor current price guidance in browser-work-handoff.md. Preserve current-day discovery scope, carried turns across midnight, explicit named handoffs, opt-outs, independent holds and truthful direct authenticity answers. Ordinary understood photos are in scope only after actual visual inspection. Proactive outreach remains separate. Due consented meal-plan follow-ups retain their existing narrow policy after reactive work.

While conversations are active, check them roughly every 30 seconds, group rapid inbound bubbles and use a five-minute idle deadline per person. No silence nudge. Stop new claims at minute 25, reconcile by 28, release by 30 measured from invocation. Record continuation_pending when work remains. On handled errors finalize only the owned lease; never overwrite another run.

## Canonical native delivery

Send once. Verify the exact recipient and message visibly delivered, cleared composer and Sent/Seen feedback, then save screenshot evidence. An uncertain activation stays uncertain/no_repeat for that exact recipient; it must not freeze other conversations.

Complete the exact claimed action with receipt fields:
- native_verified=true and no_repeat=true ONLY for visibly confirmed delivery.
- result=sent_attribution_pending, delivered_text as exact final text, sent_at as actual observed delivery time, screenshot path, claim_run_id, source_message_id and native_recipient when visible.
- Keep the complete action/version/token/source and independent holds.

The deployed trg_sync_ig_native_delivery_receipt trigger writes a verified native receipt to ig_messages and advances ig_threads.last_outbound_at even when Meta sends no echo. It checks exact inbound/thread, run/surface, time and evidence, labels the text balance_system and training_eligible=false, and deduplicates existing matching outbound. This is evidence reconciliation, never a send. Read receipt.canonical_outbound_message_id back after completion and verify the corresponding exact outbound. A native receipt is not a Graph echo; do not label it graph_echo_verified. If no ID is returned, retain no_repeat and record the missing proof field for repair instead of resending.

Confirmed sends must not remain claimable waiting work. An unsent or ambiguous receipt must never be promoted to delivered merely to clear the queue. Historical verified receipts were backfilled; preserve newer inbound and manual holds. External automated Meta template replies without exact source-bound proof still require native assessment, never invented history.

Notify only meaningful delivery, failure or required user action; stay quiet on unchanged healthy scans.
