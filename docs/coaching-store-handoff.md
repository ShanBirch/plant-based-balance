# Coaching store-link handoff

Shannon, 30 October 2026: Timothy's combined-store message displayed only the
App Store preview. Ask which phone they use, then send one matching store link.
This replaces the earlier unknown-phone instruction to send both stores.

- Reuse a confirmed answer; otherwise ask “Are you on iPhone or Android?” while
  collecting missing setup facts, before queueing/preparing the ready notice.
- Keep the exact same-thread inbound answer ID. Do not infer a device from a
  name, country, profile, or a guess.
- Ready review supplies `phone_platform` (`ios`/`android`),
  `phone_platform_confirmed: true`, and `phone_platform_source_message_id`.
- Put the matching official store URL on its own line before the separate
  verified private activation URL. Do not include the other store.
- Instagram controls preview rendering. Text preparation is not proof a card
  appeared; verify actual native delivery. Preserve private activation and all
  ownership, freshness, hold, one-use reservation and no-repeat checks.

Already queued work with an unknown phone stays pending until an eligible setup
turn obtains the answer. Do not fake phone evidence, send a silence chase, or
resend a completed handoff merely to change its formatting.

`coaching-app-handoff.js` rejects unknown platforms. The production
`prepare_free_coaching_ready` guard requires the confirmed platform and inbound
source, rejects the opposite store URL, and retains its existing delivery gates.
