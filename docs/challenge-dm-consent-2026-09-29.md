# Challenge DM consent correction, 29 September 2026

Shannon's current instructions govern this scoped route. The BALANCE opener introduces the plant-based Summer Shred and workout, nutrition and accountability support, including Learn, the six-week course for lasting lifestyle change. The preferred opening question is "What are you looking to achieve over the next ten weeks?" The challenge itself lasts ten weeks; Learn remains six weeks within it. Shannon is vegetarian; historical vegan claims must not be repeated.

## Architecture

Recovered the full-conversation single-writer principle from commit 5a605899 (Simplify paid Meta conversation writer): the writer interprets all unanswered bubbles and the complete conversation, skips known facts, and owns ordinary wording. Challenge organic and paid entry now share that writer. Removed the goal/help regex progression, fixed ordinary outage replies, and post-write sentence replacement. Existing AI review and provider fallback remain; a model outage does not synthesize a canned sale.

The writer understands the goal and struggle naturally, then explains relevant support and asks permission for the call booking link. An explicit link request or acceptance authorizes the existing card. Deterministic code is restricted to routing, factual constraints, refusal/sensitive-topic boundaries and link permission. The final sender rechecks canonical conversation evidence and rejects premature cards and prohibited attachments, including late repairs and stale policy-version drafts. Other offer routes are unchanged.

No transformation photos, proof videos or synthetic voice. No mandatory vegan qualification, preview or checkout sequence. Preserve existing identity, safety, transport, pacing, claims, current inbound batching and duplicate-send controls.

## Verification

55 offline tests passed across challenge policy, full draft assembly, hybrid lane, worker, conversation-delta transport, permanent manual permissions and customer-service handoff suites. The separate legacy send-ig-reply-challenge-offer suite has an existing timing assertion failure at line 185 (08:39:00 versus 08:39:30); reproduced with the unchanged HEAD sender. That legacy scheduling calculation was not changed.

The writer-only remote-model smoke suite was updated to require invitation before card and cover the Summer Shred opener. Local execution could not obtain an unmasked model credential; no secret settings were changed. Do not describe that smoke suite as passed. End-to-end deployed testing is recorded separately after publication. Browser identity verified as littlecompanionportraits -> shan_n_sunny, using the existing test conversation. Native history is retained.

## Live-test findings and corrections

Browser tests exposed and corrected: a deterministic fast review that missed conversation readiness; generic sales timing/repair rules conflicting with the scoped offer; included Learn wording accidentally selecting the legacy photo route; old test-reset timestamps retaining a previous episode; and an inherited style-warning release. One Gen photo was delivered in the earlier test before the route correction. Native history and failed drafts remain recorded; no real lead was involved.

The September Learn flow (experiments/learn-ai/flow.cjs and presence.cjs, including bb1268dc) used medium reasoning and word-based typing pacing. The challenge writer, repair and reviewer now use that reasoning setting, with longer bounded review time. Native typing refreshes every four seconds. Text pauses use 2 seconds plus 400 ms per word, bounded to 3–30 seconds per item and the existing 20-second total inter-item budget. Draft generation already counts toward the first typing period, avoiding another artificial delay. Held challenge drafts clear typing. Native browser typing proof was captured.

The 17 September goal-heart rule in experiments/learn-ai/prompt.md is restored: a semantic challenge review decides whether the latest inbound first shares a positive goal. The sender sends a native love reaction before text, only after all send gates and a successful claim. Verified Graph inbound IDs, a persisted attempt before the network request and target receipts prevent repeats; an ambiguous reaction does not retry or create fake outgoing text. Negative/uncertain/sensitive cases default to no reaction. Three focused reaction tests cover targeting, gates, confirmation, retries and persistence failure.
