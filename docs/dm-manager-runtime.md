# Local DM manager runtime

The ten-minute Codex automation is the reviewing operator. There is no required
database run-lock RPC or separate guarded-runner MCP tool. SQL handles inbox
reads and exact per-action claims; the existing production `send-coach-reply`
HTTP endpoint handles guarded delivery.

Use Node 24+ and `scripts/dm-manager-lease.cjs` for the local run lease. The
installed copy is at `C:/Users/shann/.codex/automations/balance-lead-client-dm-manager/runtime/dm-manager-lease.cjs`.
All checkouts use the same SQLite state file under that automation directory.

1. Run `node <script> acquire`. Only `acquired` authorizes a pass. Save its token.
2. `manager_already_running` is a clean overlap exit. Other errors are failures
   to report, never healthy `DONT_NOTIFY` runs.
3. Read the live inbox, including older unresolved inbound batches. A zero-row
   new-message delta does not mean the unanswered queue is empty.
4. Run `node <script> check <token>` before a per-action claim and immediately
   before guarded delivery. Respect `can_claim` and `can_send` respectively.
5. Stop claiming at minute seven; reconcile and release by minute nine using
   `node <script> release <token>`. A vanished run expires after 15 minutes.
   An old token cannot release its successor's lease.

Keep paid-Meta worker ownership separate. Preserve all exact identity, media,
manual, client, controller, stale-inbound and no-double-send checks. Use the
canonical production endpoint, UTF-8 Base64 reply fields, manager source and
`forceText=true`. Never execute a workspace sender as production code.

Browser dispatch remains paused. Story replies still require native context;
the compatibility RPC `route_story_reply_inbound_to_browser_dispatcher` now
routes these to manual Needs You with a visible reason. It preserves active
claims, newer messages, manual holds and opt-outs. Do not infer authority to
restart the browser, clear a personal-boundary hold or send generic Story text.
Other API-window/browser-only work must likewise surface for manual handling.

Record successful live reads separately from completed action passes. A missing
transport, failed lease, unreadable inbox or failed media recovery is not a
healthy pass. Deduplicate an unchanged failure notice by its exact signature,
but continue safe recovery and report a changed failure or recovered service.
