# Independent Instagram public comments

Shannon requested this separate post-first workflow on 14 October 2026 and then explicitly requested ownership that can run alongside the existing workers. Existing Story and Meta Business Suite leases and schedules remain intact. No worker is restarted or paused.

## Ownership

`ig_public_comment_runs` supplies a dedicated renewable five-minute lease, immutable native `shan_n_sunny` tab binding and durable cursor. It may coexist with healthy Story and MBS owners on **different tabs**. Cross-table tab guards share the existing transaction lock solely for atomic acquisition. Unclassified legacy ownership still excludes new native work. The worker never navigates, closes, focuses or takes over foreign tabs.

Recipient ownership remains shared in `ig_next_actions`, including exact normalized handle keys and canonical thread uniqueness. Supported RPCs are `start_ig_public_comment_run`, `checkpoint_ig_public_comment_run`, `claim_ig_public_comment`, `ig_public_comment_action_owned`, `reserve_ig_public_comment_send` and `reconcile_ig_public_comment`. Claims select the exact action ID/version/handle/post/text; NULL-thread exact-handle actions are supported without broad queue claims or invented thread IDs. A public claim may still exclude its recipient from another worker; existing worker startup rules may conservatively defer on an active proactive claim. Separate surface ownership does not remove that protection.

Reserve each attempt before native input; obtain the **one-use** Send reservation immediately before exactly one activation. Every reserved/activated/uncertain attempt consumes capacity and protects the exact post for life. No repeated activation to repair attribution. Verified reconciliation requires exact native author/post/sender/text, reload screenshot, readback and observation time, followed by canonical queue readback. Never set proof fields from a test, composer clear, queued action or assumed delivery. A missing/expired claim leaves durable uncertainty and never authorizes a resend. Only the owning run checkpoints/finalizes itself.

The new tables have RLS enabled and no public/anon/authenticated grants. New RPCs are service-role only. Existing generic claim and Story send RPCs are unchanged.

## Discovery and policy

Use a dedicated tab and actual Following feed where available; otherwise collect native home-feed posts with native Following verification. Collect at most40 distinct posts or15 minutes, whichever first; these are ceilings, never quotas. Reject Explore, ads, suggested/unfollowed accounts and unverifiable/native ages beyond72h. Review actual full relevant media/audio and caption. Then prioritise meaningful eligible prior relationships **within that observed batch**. Never start from the hot-lead profile list, reopen profiles looking for posts or claim the sample covers everyone followed.

Read complete relevant history, all duplicate exact-handle canonical threads, live and archived receipts, purchases/client policy, protected/manual/personal/safety/opt-out and unanswered-inbound/outreach boundaries. Honour seven-day public-comment and existing cross-worker person cooldowns. Clients require their actual community support policy and24h outbound/community cooldown, never an assumed blanket inclusion. Comments are short specific supportive statements, question-free by default, with no pitch/link, generic praise, invented experience or private relationship details. No DMs, Story replies or Like fallback.

Pilot ceiling5 total reserved attempts, preserved across interruptions/dates. Daily mode is gated on a verified pilot; default ceiling10 reserved attempts per Brisbane day. Runtime workflow must also verify all pilot/ownership/cooldown gates before enabling any scheduler. One proposed morning pass08:15 Australia/Brisbane, subject to fresh schedule review; no automatic same-day discovery/restart loop. Use automation_update only after live acceptance; keep unchanged nonactionable wakes quiet.

The pure `scripts/ig-public-comment-policy.mjs` collector bounds actual observed inventory and preserves no-repeat/capacity without opening a browser or sending. It does not manufacture eligibility evidence. Local durable operator contract/cursor/receipts are under `C:/Users/shann/.codex/ig-public-comments/`.

## Acceptance status, 14 October2026

The base ownership migration was applied successfully. The follow-up one-use reservation migration is prepared and passed local PostgreSQL regression checks; **live application and complete live verification remain pending** because management database connections timed out. Six pure policy tests pass; local PostgreSQL tests use minimal dependency fixtures, not proof of production delivery. The initial live rollback test timed out while aggregating historical runs; its result is unknown. Its replacement limits snapshots to active ownership fields and enforces8s statement/2s lock timeouts. Exact cancellation of that test session was attempted but also timed out; no foreign session was targeted.

Dedicated Chrome tab485799501 was created and native signed-in shan_n_sunny navigation was observed. No comment ownership lease, real recipient claim, Send, successful public comment or recurring automation has been established. Pilot0/5; no discovery batch was represented as inspected. Do not claim the workflow live until both migration/ownership verification and actual pilot receipts succeed. Existing Story/MBS workers independently reported connection timeouts; no claims were cleared and no automation controls changed.

Run `node --test tests/ig-public-comment-policy.test.mjs`. Run `supabase/tests/ig_public_comment_ownership.sql` only against the permitted correct project; it rolls back synthetic fixtures and must never be used as native account/media/delivery evidence. No foreign lease state is modified by that test.
