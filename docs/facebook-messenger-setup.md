# Direct Facebook Messenger setup

Status, 14 September 2026: direct Messenger is deployed, Page-authorized, and a real inbound/draft/manual-send/outbound round trip is verified. Public ad auto-reply activation is not complete. Shannon confirmed that ManyChat is retired; do not reconnect or use it for this setup.

## Verified connection and remaining review work

- Meta app `2059731324926909`, Page **Balance APP** `561122130919678`. Ads Manager confirms this Page is the identity used with `shan_n_sunny` ads.
- Page authorization completed on 14 September. Production Functions-only secrets are configured: `FACEBOOK_APP_SECRET`, `FACEBOOK_PAGE_ACCESS_TOKEN_561122130919678`, `FACEBOOK_WEBHOOK_VERIFY_TOKEN`. `FACEBOOK_PAGE_ID` is configured for the same Page. Do not print these credentials.
- Meta successfully verified the production callback. Both Page and app-level subscriptions include `messages`, `message_echoes`, `messaging_postbacks`, and `messaging_referrals`; webhook subscriptions use v26.0. Send API remains v25.0.
- The first live inbound exposed the production unique key `(subscriber_id, channel)`; commit `ac40eda9` corrected the receiver conflict target and channel-scoped lookup. All 21 focused tests pass. Netlify deploy `6aa792831b7a2800083dd7df` is ready.
- Controlled test is Shannon's existing conversation with Balance APP, canonical thread `a5b1ef87-3eeb-45c0-a3d9-22ea8c94eaf1`. Real inbound `4abadc5a-b62c-4a39-9250-efbe69be94d6` generated alert `ac9cfce9-0e9b-4b9e-a23b-87e268b10625`; the reviewed reply was sent via the admin inbox at `2026-09-14T06:25:24.815Z`. Canonical outbound `fa6ad4fd-46cb-4389-b29d-6c94017dbc70` has `source=facebook_messenger_send`. Matching text was visibly verified in Messenger. No duplicate outbound was recorded.
- This was an **organic, manually reviewed test**, not proof of automatic paid-ad attribution, preview/media delivery, or public access approval. Do not invent ADS referral data. Paid route remains subject to real ad-path testing and Meta approval.
- New review draft: submission `2164265864473454`, requesting `pages_messaging` only (plus renewal certification of already-approved Page-list/metadata permissions). Usage description and reproduction steps are saved. No final submission has occurred.
- Remaining: new English screen recording of authorization and real end-to-end messaging; dedicated restricted reviewer access; required allowed-usage declarations; user review of prefilled data-handling claims before submission. Browser automation has no video recording capability; Shannon was asked to start a screen recording, with response still pending at this checkpoint.
- The new review draft inherited full production administrator credentials from older instructions. They were removed from this draft and replaced with Messenger-only instructions. Never copy admin credentials into a review artifact or grant reviewers broad access to unrelated customer data. Older submitted reviews were not edited.
- Existing data-handling answers name OpenAI, Google/Google Cloud, Netlify and Supabase, Shannon Rhys Birch in Australia as controller, no national-security disclosures in the preceding 12 months, and four public-authority request safeguards. These are prefilled claims requiring Shannon's confirmation, not newly verified operational facts.

## Integration

- Receiver: `https://plantbased-balance.org/.netlify/functions/facebook-webhook`.
- Set production `FACEBOOK_PAGE_ID` (or comma-separated `FACEBOOK_PAGE_IDS`), `FACEBOOK_APP_SECRET`, and `FACEBOOK_WEBHOOK_VERIFY_TOKEN`.
- Store the Page token in `app_private_secrets` under `facebook_page_access_token_<PAGE_ID>`. A scoped `FACEBOOK_PAGE_ACCESS_TOKEN_<PAGE_ID>` environment value is also supported. Never use an Instagram token for Messenger.
- Subscribe the selected Page to `messages`, `messaging_postbacks`, `messaging_referrals`, and `message_echoes`.
- Only the configured Page can create `channel=messenger` threads with `fb_graph:<PAGE_ID>:<PSID>` identity. No automatic merging with Instagram or retired ManyChat identities.
- Signed incoming events enter `ig_messages`, `coach_alerts`, and the current paid-Meta reply controller. Verified ADS referrals retain the ad ID and enter the existing paid flow. Referral-only events do not open the 24-hour reply window.
- `send-ig-reply` uses the Facebook Send API for Messenger, including native preview buttons and video/images. Existing review, client, identity, freshness, claim, receipt and duplicate checks remain in effect. Replies outside 24 hours are blocked. This integration does not request Human Agent or marketing-message tags.
- Generated voice messages remain unsupported on this Messenger path. The live paid-Meta worker already sends text; video/image proof and preview buttons are supported.
- Comment-to-message campaigns are a separate configuration, outside this click-to-Messenger rollout.

## Meta prerequisites observed

At initial inspection, the Balance app (`2059731324926909`) and older Shanbot app had no connected Messenger Page/webhook. Balance's connection is now configured as recorded above.

Balance's `pages_show_list` and `pages_manage_metadata` were approved. `pages_messaging` was rejected. The reviewer said the use case is allowed, but the screencast did not clearly demonstrate messages being sent and received between the app and Messenger inbox. See submission `2083149019251806` in the Balance app's review feedback.

Page authorization, credential provisioning, webhook verification, and an app-admin messaging round trip are complete. Finish the remaining review evidence and restricted reviewer access before resubmitting for public access. Do not direct paid Facebook traffic here until the complete paid path is verified and Meta approval is in place.

## Review submission draft

Balance uses the Messenger Platform to respond to people who initiate a conversation with its Facebook Page, including people arriving through click-to-Messenger ads. A signed Page webhook records each incoming message in the Balance admin inbox. The existing reply system uses the current conversation to prepare and review a response, then sends it directly through the Messenger Send API. Shannon can review conversations and reply from the admin inbox. The system also sends requested program preview links as native buttons and relevant explainer media. Automated replies are limited to the standard 24-hour messaging window. The integration does not send unsolicited messages or use the Human Agent tag for automation.

Record a new English-language demonstration showing Page authorization, a test user sending a message in Messenger, that exact inbound appearing in the Balance admin inbox, a reply sent through Balance, the reply arriving in Messenger, and a follow-up message completing the same cycle. Include a native preview-button check. Do not show access tokens or unrelated customer conversations in the recording. Clearly explain the server-to-server component and distinguish the permission request from the older Instagram/Human Agent submission.

## Measurement and activation check

- Hypothesis: Facebook ad conversations can complete the same qualified preview/purchase journey as Instagram while maintaining reply quality and delivery reliability.
- Variant: `facebook_messenger_direct_v1`.
- Primary KPI: purchases per verified Facebook ad conversation.
- Diagnostics: first-response time, inbound-to-outbound delivery, qualified conversations, requested preview delivery, preview opens, checkout and purchase attribution.
- Guardrails: zero duplicate sends, wrong-channel recipients, unintroduced proof attachments, or automated sends outside the allowed window.
- Decision date: seven days after approved activation; no experiment has started yet.
- Confirm canonical Facebook ad ID and platform, message ID, alert ID, outbound Graph receipt, and downstream preview/checkout attribution on one controlled test before enabling ad delivery.

## Validation

`node --test tests/facebook-messenger.test.js tests/facebook-messenger-send.test.js tests/ig-acquisition-mode.test.js tests/ig-instant-draft-background.test.js tests/send-ig-reply-conversation-delta.test.js`

The new tests use simulated services; they are not evidence of live Messenger delivery. The pre-existing `send-ig-reply-challenge-offer` test fails on a timestamp expectation in unchanged mainline code; broader paid-flow copy tests also contain existing expectation mismatches. Record deployment and live-test receipts when activation is completed.

### 23 September 2026 reviewer access update
The review recording, separate connected-Page screenshot and notes are uploaded in draft2164265864473454. Reviewer self-pairing now supports a private invitation and a short session bound to the reviewer's own signed Messenger inbound, with no older history or linked-client access. Meta's general guide says reviewers use their own test accounts, while the pages_messaging form separately asks for a real account with Tester role. Do not supply Shannon's personal login or claim that this unresolved Messenger-specific requirement is waived. No final submission or public ad auto-reply activation has occurred.
