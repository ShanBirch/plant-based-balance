# Direct Facebook Messenger setup

Status, 14 September 2026: code prepared for the direct Meta integration. Public Messenger activation is not complete. Shannon confirmed that ManyChat is retired; do not reconnect or use it for this setup.

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

The Balance app (`2059731324926909`) has the Messenger use case but no connected Facebook Page or Messenger webhook. The older Shanbot app also showed no connected Messenger Page/webhook.

Balance's `pages_show_list` and `pages_manage_metadata` were approved. `pages_messaging` was rejected. The reviewer said the use case is allowed, but the screencast did not clearly demonstrate messages being sent and received between the app and Messenger inbox. See submission `2083149019251806` in the Balance app's review feedback.

The connection dialog is pending. It requests Page messaging access. Finish Page authorization, provision the secrets above, validate webhook verification, and test with an app-role account before resubmitting for public access. Do not direct paid Facebook traffic here until real Messenger delivery is verified and Meta approval is in place.

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
