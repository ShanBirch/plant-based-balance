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

Operational state on 26 September 2026: enabled after verified owner test delivery.
The earlier plain-text price response has been replaced by a native Instagram
image card with a web_url button and card tap action, following Balance's generic
template format. Simple one-pet pricing uses one card; more detailed questions
keep one readable text response plus the relevant card. Custom-design and refund
questions receive their specific destination. Paragraphs are preserved and text
is split only at the API's 1000-character limit, not every 240 characters.

For future reconnections, keep draft-only until Meta authentication and live testing.
Enable only after `lcp-dm-admin` reports the correct connected identity and a
configured signature secret. `lcp_dm_settings.enabled` is the kill switch.
Set `starts_at` at activation so old messages are never backfilled.

Meta delivery uses the existing Balance app (2059731324926909), where the
portrait account is already subscribed to messages at `instagram-webhook`.
Its original Balance signature is verified again by the portrait worker.
The Shanbot connection provides the portrait-scoped send token. Its old ngrok
callback and Shan/Sunny subscription are unchanged; do not enable a duplicate
Shanbot webhook subscription for this account.

Server-only secrets in `app_private_secrets`: `lcp_ig_access_token` and
`lcp_ig_app_secret` (the Instagram app secret for the subscribed Meta app).
The subscribed delivery app is Balance-IG; the sending token is Shanbot-IG.
The daily `lcp-dm-refresh` job renews the sending token when seven days old,
verifies the exact account, and saves it in the existing server-only secrets table.
It never logs tokens or overwrites a more recently saved connection.
Protected production Functions variables `LCP_IG_ACCESS_TOKEN` and
`LCP_IG_APP_SECRET` are supported as initial connection fallbacks.
These have no fallback to another business's token. All webhooks must have a
valid Meta HMAC signature. `lcp-dm-admin` requires the existing service-role bearer
credential and returns no secrets. Its `preview` action does not send anything.

`lcp_dm_events` stores inbound IDs, reply drafts, delivery receipts and holds.
Duplicate webhook IDs are ignored, only inbound messages inside 24 hours qualify,
and leases prevent concurrent replies. Delivery uncertainties are held, never
blindly retried. No outbound prospecting, comment-to-DM campaign or ad changes.
The per-minute recovery function drains queued messages after contention; a
manual Instagram reply pauses the conversation. RLS intentionally has no client
policies because all portrait tables are server-only, verified by explicit grants.
Media/story messages and existing-order issues pause for human assistance.
`lcp_dm_conversations.paused` is the per-conversation manual hold; set it false
only after the human issue is resolved. All three tables use RLS and grant access
only to the server service role. Schema is in `docs/lcp-dm-schema.sql`.

Run `node --test tests/lcp-dm.test.js` for account isolation, signature, timing,
pricing, pause, link and length tests. Run authenticated previews in production
before activation; verify a user-owned test conversation end to end.
