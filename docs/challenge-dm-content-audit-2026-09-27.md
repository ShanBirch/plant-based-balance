# Challenge DM content audit — 27 September 2026

**Decision: release the tested, scoped conversation fix under Shannon's standing auto-ship approval.** This supersedes the initial review-only HOLD in this document. Ads, spend and campaign launch remain on hold. Paused desktop operators remain paused. No test messages were sent to real leads.

## Content and routing

Eligible new Shan n Sunny / Balance Instagram and verified Balance Facebook leads use the eight-week plant-based transformation challenge: understand the goal from the full conversation, give brief relevant support, then use the existing consultation card. Vegetarian and transitioning plant-based people are welcome. The relevant support is training, meal plans, Balance Learn education, accountability and community. Balance Learn itself remains six weeks.

The optional AUD $125/week package includes one weekly 30-minute live 1:1 workout plus challenge support and Balance Learn. It is not a universal challenge price. The consultation is 60 minutes. Explicit product/course/price questions receive factual answers without forcing a booking. There is no default preview detour, unsolicited course outline or price pitch. The marked card destination is `https://plantbased-balance.org/book?source=plant_based_challenge`.

Routing requires the Balance account or exact verified Messenger Page/subscriber prefix. Existing clients, purchases, other brands and attributed legacy campaigns keep their appropriate routes. Current explicit old-product requests and later preview promises outrank stale challenge metadata. An explicit new challenge enquiry can reopen that topic. Website and calendar files were not edited; those belong to the separate website task.

## Defects fixed after the initial hold

- Replaced conflicting offer-stage instructions only on the challenge route; retained shared personality, factual, dietary, repeated-question, identity and suspicion checks. Legacy paid prompt output was compared byte-for-byte with the baseline for both legacy variants.
- Resolve the next commercial step from the complete unanswered batch, historical goal, existing card and refusal state. No pitch after thinking time, thanks, unrelated rapport or injury/support questions. Direct requests can resend the existing card.
- Supply the card after a known-goal help enquiry without another permission/discovery loop; ask a goal question when genuinely missing. Ordinary goals such as hiking also qualify.
- Preserve direct and reciprocal answers across rapid bubbles, including the requested $125 package and Shannon's verified vegan history. Fill only missing requested package facts; do not infer the lead shares Shannon's diet or duration.
- Normalize observed booking URL errors to the existing approved destination. Query parameters no longer count as repeated conversational questions.
- Remove unwanted commercial tails from plain-text replies while retaining the substantive answer. Final guards also check repaired text, so later edits cannot reintroduce a disallowed offer.
- Clear stale preview/checkout handoff metadata and recalculate the consultation handoff from the exact final draft. Existing manual, safety, missing-media/context and reviewer holds remain authoritative.
- Retain a conservative content-aware fallback after the existing model chain fails. Unknown/complex questions remain held for recovery rather than inventing an answer. No extra model calls or approval bypass was added.
- Add the scoped policy to CODEX and the dormant worker prompt, retaining its curriculum knowledge and behavioral rules. Installed operator skills were not modified or activated.

## Verification

| Check | Result |
| --- | --- |
| Focused content, routing, history, batching, fallback, native card, safety/manual/context holds and worker tests | 37/37 passed, including 26 challenge tests. Final small worker/factual-cleanup refinements were subsequently rerun with their affected tests, all passing. |
| Broader selected DM, Messenger, qualifier, booking and handoff regression | 352 tests: 329 passed, 17 failed, 6 skipped. Baseline: 326 tests, 303 passed, the same 17 failures, 6 skipped. Normalized failure-name comparison found no new failures. This is not a claim that the entire repository suite is clean. |
| Real production-model writer checks | 60/60 passed: 15 scenarios × organic/paid lanes × two repetitions, with timestamped synthetic histories and burst messages. Replies were manually read as well as checked. |
| Formatting | `git diff --check` passed. |

Final repeated writer build: https://app.netlify.com/projects/future-balance/deploys/6ab8ced83d8845e0ac07ab2c . Its deliberately nonzero wrapper prints `WRITER_CHECK_COMPLETE_NO_PUBLISH`, so Netlify reports a failed build and skips deployment even when all 60 fixtures pass. The smoke harness permits only OpenAI Responses requests, disables usage logging, uses invented conversations without live thread IDs, and never invokes transport or calendar writes. It uses the actual `generateDraft` entry point and shared content checks. This build included the final cloud prompt/offer behavior; a subsequently added deterministic cleanup for the observed phrase “I've been for five years too” was verified locally, as was an additional dormant-worker curriculum assertion.

Earlier timestamped candidate `6ab8c58a5981579a216c47c9` passed only 7/18 and was held. Iterative checks exposed booking permission loops, premature cards, missed questions, repeated cards, package omissions and unrelated sales tails. Those failures informed the fixes and regression cases above. The final pre-release 29/30 run had one overly literal training-word assertion (“strength plan” was valid); manual review also caught a subtle unrelated support pitch, which was fixed and included in the final repeated run.

The 17 baseline failures comprise seven older website/offer expectations, six legacy Meta progression cases, and the existing voice-message, science-resource, qualifier-rapport and challenge-offer suites. Their logs and the final comparison are in the system temporary directory. No unrelated tests or production website code were changed to turn these green.

## Preserved runtime and limits

Read-only production inspection found `AI_PROVIDER=openai`, general/fallback chain `gpt-5.4-nano`, and paid writer `gpt-5.4-mini`. No model or generation configuration changed; historical `vertex-v7` labels do not identify the actual provider. Full context assembly, learned edits, memory, media decoding, batching, timing, cooldowns, controller claims/dedup, manual gates and native rich-card artwork/transport remain owned by their existing implementations. Synthetic transport tests verify payload/card ordering, not real customer delivery. Media/context hold checks do not establish full real-media interpretation quality.

The cloud draft/manager path is active. The local live worker was not running, and DM manager/browser dispatcher automations were paused; none were restarted. Facebook Page `561122130919678` is the verified Balance route, but public Facebook auto-reply activation still has the App Review limitation in CODEX. Shipping this code does not claim public campaign activation.

These checks validate the targeted content failures and retained contracts. They are not a complete live review/repair/send replay, a clinical safety certification, proof of every conversational capability, or evidence of improved sales. Existing production review and safety gates still apply to generated replies. No UI changed, so this release does not make a mobile status-bar clearance claim.

## Outcome measurement

Use `plant_based_challenge_consult_v1` and the marked booking source for lane-matched episodes. Measure completed and attended consultations, then canonical paid conversions; monitor duplicate cards, repeated questions, missed direct answers, inappropriate offers, holds and opt-outs. A reply, long chat or sent card is not a conversion. Verify source attribution survives the actual booking flow before claiming end-to-end funnel measurement. Keep spend/launch holds in place and use normal Git revert/deployment if rollback is needed, preserving conversation history.
