# Next-day meal-plan gift

Shannon explicitly authorised this follow-up and live activation on 1 October 2026. This narrow exception supersedes the browser dispatcher's reactive-only and no-silence-nudge rules only for a verified coaching call invitation left without a booking. It does not authorise general cold DMs or repeated booking invitations.

The existing five-minute Meta Business Suite operator owns delivery. No additional automation or API sender is created. `close_sale` is reused as the shared queue's existing lead-conversation action category; reason policy `meal_plan_call_followup_v1` identifies a free gift offer, not a recorded sale.

## At each wake

1. Read this contract, reconcile fresh unanswered turns and active conversations first, then call `refresh_ig_meal_plan_followups(50)` through the service-role database connector. This discovers canonical outbound booking URLs from the current lead cohort beginning 30 September Brisbane, registers a one-time opportunity and queues it only after 24 hours. It excludes the historical unread backlog. Due opportunities remain in scope across midnight.
2. Call `ig_meal_plan_review_candidates(50)` to find current invitation candidates without a URL, including yesterday's unbooked coaching leads. These keywords find possible review work only. Read each full current native/canonical exchange and register only an actual coaching call invitation using `register_ig_meal_plan_followup(thread_id, exact_outbound_message_id, review)` after delivery is canonically verified. Also register new invitations during ordinary conversation work. Review must include `call_invitation_verified: true`, current ISO `reviewed_at` and `reviewed_by`. Register the invitation only when context confirms it is a coaching call, not social chat, a support call or someone else's call. A general warm label does not qualify. Then refresh again to queue newly registered due work.
3. A source invitation must remain the latest canonical turn. A newer turn cancels the stale opportunity; if a distinct later qualifying invitation is genuinely earned and no gift offer has ever been attempted, review it and update the waiting source only through a deliberate new registration. Never resume cancelled opportunities automatically. Read complete native and canonical messages before acting; cached classifications are insufficient.
4. Reconcile booking, purchase, linked-client and identity truth using canonical records plus current native context. Booking metadata `ig_thread_id`, verified email/phone and outcome receipts are checked in the database. If identity cannot be safely matched to booking truth, hold and resolve it rather than assuming no booking. Check related verified channels/accounts to avoid cross-channel duplicates. Never match by display name alone.
5. Skip anyone booked, paid, already a client, protected/manual, opted out, asking for space/thinking time, declining further contact, wanting to wait for Shannon, safety-held, owned by another operator, or with an uncertain prior send. Don't clear a hold to make them eligible. Do not offer a generic plan where an allergy, therapeutic diet or other current context makes it unsuitable.

## One offer, one attempt

Claim the exact due `dm_manager` action through `claim_ig_next_actions` with your current verified Meta Business Suite run and its exact thread ID. Preserve the existing surface/tab lease, runtime walls, global recipient ownership and proof checks. An expired owner never sends.

Compose fresh, short wording from the person's conversation. A tone example, not a mandatory script:

> I've got a free seven-day plant-based meal plan with recipes and a shopping list. Happy to send it over if you'd find it useful 😊

Do not repeat the unanswered call invitation in this gift offer. Do not make booking, payment or an email address a condition of receiving it.

Before touching Send, call `reserve_ig_meal_plan_offer(action_id, claim_token, run_id, review)` with `native_identity_verified`, `full_thread_reviewed`, `booking_purchase_checked`, `no_decline_or_space_request` all true, plus current `reviewed_at` and the exact `final_text`. False means do not send. Reservation is durable and blocks all other claims from making another attempt. Recheck `ig_browser_action_owned` with exact tab, action/version, token and the source outbound invitation ID immediately before sending. This policy deliberately binds the follow-up to the actual invitation, rather than pretending an old inbound is unanswered. Native delivery only; do not use the source-inbound API fallback for this proactive gift.

Activate Send once. Native confirmed delivery: `record_ig_meal_plan_offer(action_id, claim_token, 'offer_sent', receipt)` with `native_verified: true`, exact delivered text, native proof, timestamp and canonical outbound ID when available. Unknown delivery: record `uncertain`, complete the shared action with a no-repeat receipt and reconcile later. A reserved opportunity after a crash is no-repeat until reconciled, even when its action lease expired. If skipped before an attempt, record a cancellation; never reset it to waiting to chase the person. Complete the existing shared action through its normal claim-token RPC with the same proof. Do not resend to obtain an echo.

## Give the PDF when accepted

Acceptance is a fresh inbound and uses the ordinary reactive ownership/claim flow. Read the gift ledger, the offer and the person's actual reply together. Explicitly asking for the meal plan also permits delivery without an extra permission question.

PDF: https://plantbased-balance.org/assets/guides/Balance-seven-day-plant-based-meal-plan.pdf

Verify the URL returns the PDF before delivery. Send the native file if the verified channel supports it reliably; otherwise send that direct downloadable link with a short natural introduction. The recipient can download the complete PDF without signing up. The guide is general adult meal inspiration, not a personalised calorie/macro prescription. Do not claim it has been tailored to the recipient or guarantees weight loss.

Check no prior delivery or uncertain attempt exists. For an accepted gift offer, atomically call `reserve_ig_meal_plan_delivery(thread_id, reactive_action_id, claim_token, run_id, review)` before native send. Review includes `meal_plan_accepted`, `native_identity_verified`, `full_thread_reviewed` all true and current `reviewed_at`. False means do not send. Then recheck the normal native action proof, send once and preserve native/canonical delivery proof. Call `record_ig_meal_plan_delivery(thread_id, claim_token, 'delivered', receipt)` with `native_verified: true` only after proof. An attempted delivery without proof is `uncertain` and no-repeat until reconciled. Readbacks must match the exact recipient, source and URL/file. The existing global reactive claim supplies mutual exclusion. An unsolicited explicit meal-plan request without an offer uses the normal reactive path, but must still get a durable pre-attempt and delivery receipt so later offers/deliveries are suppressed. Do not clear or rewrite unrelated JSON.

Continue from their reply, rather than sending a timed extra reminder. A food question gets a useful direct answer; a relevant request for personalised food/training support can earn one optional call invitation. Send the existing booking card after clear call acceptance without another link-permission question. Respect declining calls or preferring DMs. The free guide is theirs either way.

## Verification and reporting

Report registration/queue/offer/PDF delivery/reply/call booking separately. An offer is not a download, and a send is not a booking. Quiet when unchanged. Never send a real lead a test DM. Test database guards in a transaction that rolls back, and verify the production PDF bytes against the prepared file.
