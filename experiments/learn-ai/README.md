# Isolated Learn AI comparison

This experiment leaves the existing Instagram webhook, writer, reviewer, conversation state and schedule intact. One model call reads the conversation, verified offer facts and approved asset descriptions, and proposes the next ordered messages. No second model reviews or repairs its wording. There are no word-count, keyword or inferred-stage delivery vetoes.

The small transport layer still validates action format, resolves approved assets, records actual delivery, rejects duplicate/stale sends and stops for another sender. Those checks protect delivery; they do not decide the sales conversation.

## Entry points

- `flow.cjs`: generation only. Local default is `gpt-5.4-mini`; the protected endpoint defaults to `gpt-5.4`. Pass the model explicitly for comparisons.
- `prompt.md` and `prompt.json`: readable and runtime copies; keep identical when editing.
- `evaluate.cjs`: synthetic replay, never sends. `LEARN_REPLAY_BASELINES` can add private recorded failures. Keep private conversations and credentials out of Git.
- `live.cjs`: manually invoked test transport, restricted to Gold Coast AI Solutions → Shan n Sunny. Requires the exact test identity, an unexpired session flag and temporary original-flow opt-out. It is not automatically connected to incoming webhooks.
- `netlify/functions/learn-ai-experiment.js`, exposed through its modern-functions wrapper: bearer-protected generation and explicit test `status`/`send` modes. Access expires at the time in `access.json`; only the token hash is stored here.

Run `node --test experiments/learn-ai/flow.test.cjs` for transport and failure-handling checks.

## Evaluation boundaries

On 16 September 2026 the final frozen prompt/facts produced 65 responses: 19 single-turn scenarios (including five recorded failing contexts) and ten simulated multi-turn journeys. Mechanical sequence checks passed 19/19 and 10/10. This is a development suite, not an unseen benchmark or a production success rate. Manual review still found generic praise, omitted client names, weak introductions and one unsupported suggestion that a proof client's progress involved imperfect weeks. A clean sequence is not a flawless sales response.

The first live trial uncovered a transport defect: Graph webhook message IDs had an `ig_graph:` prefix, causing our own acknowledgement to look like human intervention and blocking the next photo. Receipt-based normalized-ID reconciliation fixes that without treating arbitrary matching text as our message. The failed attempt remains in the private evidence. Provider-uncertain deliveries are never automatically retried.

The preview card opens the course website first. Its message explains that the button at the bottom leads to app download and preview setup. The mirror transformation is Kristy after 26 weeks of coaching with Shannon; this is separate from Learn's six-week duration.

## Operating a bounded live comparison

Coordinate exclusive ownership with the existing tester. Save the test thread's previous flag state; set an expiring experiment session and opt out only that thread from the original responder. Feed canonical inbound/history to generation, retain the raw plan, then explicitly execute ordered actions while collecting receipts. Check the recipient's actual inbox. After testing, restore only the flags owned by this session and return ownership to the original tester. Do not enable this transport for customers or edit the original automation merely to run the comparison.

Detailed raw results, versions, failures and transcript review are kept in the requesting task's private `outputs` directory, rather than publishing test-account messages in this repository.
