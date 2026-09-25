# Little Companion Instagram assistant

Account: `littlecompanionportraits`, immutable Instagram ID `17841422424052111`.
This account was formerly routed as Gold Coast AI. Portrait events are removed
from both generic webhooks before coaching or comment-campaign processing.
The generic draft endpoint also rejects the portrait account on recovery paths.

The AI classifies the incoming question and recent portrait-only conversation.
It cannot invent prices or checkout URLs: replies are rendered from the verified
catalogue in `_lib/lcp-dm-knowledge.js`. Live shop availability and delivery
windows are loaded from the storefront's `offer-config.js` on every reply.
Prices must be updated here when the shop catalogue changes.

Single pet: A$49 digital / A$89 unframed / A$119 framed.
Two subjects: A$69 / A$109 / A$139. Three or four: A$89 / A$129 / A$159.
GST included; physical print prices include Australian delivery.
Optional artwork message A$5; design-your-own A$20 for three choices, additional
to the portrait purchase. The order URL preserves photo intake and preview before
Stripe checkout. Never generate a generic payment link that bypasses the order.

Current operational state: draft-only until Meta authentication and live testing.
Enable only after `lcp-dm-admin` reports the correct connected identity and a
configured signature secret. `lcp_dm_settings.enabled` is the kill switch.
Set `starts_at` at activation so old messages are never backfilled.

Server-only secrets in `app_private_secrets`: `lcp_ig_access_token` and
`lcp_ig_app_secret` (the Instagram app secret for the subscribed Meta app).
These have no fallback to another business's token. All webhooks must have a
valid Meta HMAC signature. `lcp-dm-admin` requires the existing service-role bearer
credential and returns no secrets. Its `preview` action does not send anything.

`lcp_dm_events` stores inbound IDs, reply drafts, delivery receipts and holds.
Duplicate webhook IDs are ignored, only inbound messages inside 24 hours qualify,
and leases prevent concurrent replies. Delivery uncertainties are held, never
blindly retried. No outbound prospecting, comment-to-DM campaign or ad changes.
Media/story messages and existing-order issues pause for human assistance.
`lcp_dm_conversations.paused` is the per-conversation manual hold; set it false
only after the human issue is resolved. All three tables use RLS and grant access
only to the server service role. Schema is in `docs/lcp-dm-schema.sql`.

Run `node --test tests/lcp-dm.test.js` for account isolation, signature, timing,
pricing, pause, link and length tests. Run authenticated previews in production
before activation; verify a user-owned test conversation end to end.
