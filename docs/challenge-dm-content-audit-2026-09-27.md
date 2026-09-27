# Challenge DM content audit — 27 September 2026

**Decision: HOLD. Review-only candidate; do not deploy or cherry-pick to production.**

Shannon's acceptance condition is preservation of the entire conversational system, with only the offer content and commercial next step changed. Structural checks pass, but real-model output has not met that condition. This report and the candidate remain in an isolated worktree. No lead messages were sent. No ads were launched. No production configuration, model, timing, calendar hours or website files were changed.

## Intended content change

New eligible Shan n Sunny / Balance IG and Facebook leads: understand the goal from the whole conversation, explain the relevant training, meal plans, Balance Learn education, accountability and community briefly, then use the existing consultation card. No redundant discovery, permission loop, default free preview, unsolicited course outline or price pitch. The offer is an eight-week plant-based transformation challenge and welcomes vegetarians and people moving toward plant-based eating. Balance Learn itself remains six weeks.

AUD $125/week is the optional support package with one weekly 30-minute live 1:1 workout; it is not a universal challenge price. The consultation is 60 minutes. Explicit product, course and price questions still deserve direct, truthful answers. Existing client and legacy campaign commitments remain valid.

The existing landing page is https://balanceneurosciencefitness.com/plant-based-challenge. The existing booking card destination is https://plantbased-balance.org/book; this candidate adds only `?source=plant_based_challenge` for attribution. Calendar hours and site UI belong to the separate task.

## Runtime and capability inventory

| Capability | Existing owner | Candidate treatment and evidence |
| --- | --- | --- |
| Full conversation, saved facts, profile and relationship memory | `ig-instant-draft.js`, `_lib/client-context.js` | Context assembly retained. Mocked actual `generateDraft` test verifies history, multi-message inbound, profile, memory and learned edits remain present. This proves inputs, not semantic recall. |
| Voice, personality and learned edits | Existing organic and paid writer prompts; edit examples; DM playbook | Original prompt is retained and content instructions appended. Paid prompt inheritance is asserted verbatim. Real-model checks show this alone does not establish behavior preservation. |
| Models and generation settings | `_lib/client-context.js`, AI router, Netlify environment | No changes. Read-only production inspection found `AI_PROVIDER=openai`, general chain and coach fallback `gpt-5.4-nano`; paid writer requests `gpt-5.4-mini`. Old `vertex-v7` labels are not reliable provider evidence. Cloud payload does not explicitly specify reasoning effort. |
| Media and voice decoding | Existing multimodal pipeline | Source unchanged; media/context holds tested. No real media generation or end-to-end voice test performed. |
| Batching, settle windows, timers, cooldown, controller claims, retry/dedup | Existing writer/controller/scheduled sender/live-worker infrastructure | No edits to timing or ownership. Worker regression passes. No customer action claimed, scheduled or sent. |
| Safety, human/manual review, customer service and client conversion | Existing review and send gates | Existing holds retained; focused hold, conversion and manual-contact tests pass. No live flags changed. |
| Rich consultation card | `send-ig-reply.js`, shared native Graph sender | Existing artwork, generic template, approved URL and text-before-card ordering verified with synthetic payloads. Native Messenger send regression passes. No real delivery attempted. |
| Other accounts and existing clients | Route selection and live identity gates | New route limited to `shan_n_sunny`, or unlabelled Messenger records with the exact verified Balance Page and subscriber prefix. Linked/purchased clients and paid/client stages excluded. Cocos, Gold Coast AI and other Pages excluded. |
| Legacy campaigns and existing promises | Existing paid Meta progression | Known ad attribution, course-keyword campaigns, explicit old-product requests and preview history retain legacy routes unless the lead explicitly opens the challenge topic. Coverage is illustrative, not exhaustive. |
| Local operator | `ig-codex-live-worker.mjs` and desktop automations | Candidate appends content policy for marked alerts. No running worker found; DM manager and browser dispatcher automations were paused. They were not restarted or updated. The cloud draft/manager path has recent activity. |

Facebook Page `561122130919678` is the verified Balance route. Public Messenger automation still has the App Review limitation recorded in CODEX; code support does not establish public permission or launch readiness.

## Candidate design

`_lib/plant-based-challenge-dm.js` adds explicit routing, a versioned content appendix, consultation-handoff metadata and final content guards. `ig-instant-draft.js` applies it to eligible leads and keeps existing model/context processing. `client-lead-manager.js` recognizes the exact marked booking URL using its existing handoff gates. The dormant live worker can inherit the same policy if later activated through its existing process.

Policy marker: `plant_based_challenge_consult_v1`. Existing native rich-card rendering is unchanged.

## Verified checks

- 23 focused tests pass, including 12 new route/content/inheritance/hold/card tests and existing worker, full-memory, known-context, customer-service, permanent-manual and Messenger tests.
- The broader selected DM regression suite has 326 tests: 303 pass, 17 fail, 6 skip. Running the same selection against the original source produced the same 17 failures. They are pre-existing failures, not a clean full-suite pass. Baseline output was retained in the system temporary directory.
- `git diff --check` passes.
- Actual synthetic writer calls run inside an isolated non-production Netlify branch build. The test blocks all `fetch` destinations except OpenAI's Responses endpoint, disables usage logging, supplies only invented fixture conversations and does not invoke transport or the webhook handler. A wrapper deliberately exits nonzero before deployment even when all fixtures pass.
- First build: https://app.netlify.com/projects/future-balance/deploys/6ab8c4286a0dca18eb96b1b5 — 7/18 fixture checks passed. Some histories lacked timestamps, so history-dependent failures in this first run are not treated as reliable evidence. Fresh single-turn failures were independent of that defect.
- Timestamped repeat: https://app.netlify.com/projects/future-balance/deploys/6ab8c58a5981579a216c47c9 — **7/18 checks passed, 11 failed**, with realistic timestamps. Both organic and paid replies still pitched after thinking-time requests and repeated a delivered card. Both missed the reciprocal vegan question. Organic also missed the expected booking card after a known-goal enquiry and produced capitalized booking URLs. Both invited booking before understanding an unknown goal. Netlify confirmed `published_at=null`, branch-deploy context, and deployment skipped. The production published deployment remains separate (`6ab8c2f352e0400008d9ee7f`, commit `5b47ef17d18f710f2f3e7b52509b98cdce69cb9e` at the final read).

These are writer-only checks, not a replay of the complete review/repair/send pipeline. Passing unit tests must not be represented as proving final conversation quality or every capability.

## Representative timestamped output

These are invented fixture conversations, not customer messages. They are final writer outputs before the existing reviewer/repair pipeline.

- Known goal, organic: the reply correctly recalled night shifts and vegetarian muscle-building, then asked “Want me to send the booking card?” instead of providing the next step.
- “Not now, I need time to think,” organic: the reply acknowledged thinking time, then pitched the challenge and supplied the booking link. The new autonomy guard detected it.
- “Thanks!” after an already delivered card, paid: the reply supplied the consultation link again. The new duplicate-card guard detected it.
- Batched strength/vegetarian question including “Are you vegan?”, followed by food/night-shift context: both lanes omitted the direct personal question. Merely preserving all prompt input did not preserve the response behavior.

The 7 automated passes are not 7 fully approved conversations: manual reading also found repetitive inclusions, unnecessary questions and permission language in some passing outputs. The checks are a lower bound on defects.

## Concrete blockers

1. The initial real-model replies still contained permission loops such as asking whether to send the booking card after a known goal/help request. A fresh generic challenge enquiry also received a card before understanding the goal. Some outputs used an incorrect or capitalized URL that would not produce the approved card. The new guard now catches the observed malformed URL variants; it does not repair all output quality.
2. The existing paid contract function contains both old sales-stage requirements and useful behavior checks (direct question/identity answers, repeated questions, dietary answers and suspicion handling). The candidate's early scoped return bypasses that bundle. Retaining the original prompt is not enough to prove those capabilities remain protected.
3. Disabling the old deterministic course/preview fallback prevents the wrong product from being inserted, but also removes that fallback's availability on the new route. That is a capability tradeoff and does not satisfy the preservation requirement without an equivalent content-aware fallback.
4. Full unanswered-turn semantics, stale coalesced handoff metadata, prior autonomy holds and cross-route transitions need broader final-pipeline fixtures. Current illustrative regex guards are not a complete semantic guarantee.
5. The installed operator skills still contain historical course-first instructions. They were read but not modified outside this isolated worktree or activated. A release needs one consistent content source without losing their detailed behavioral rules.

## Required work before release

Separate offer-specific stages/facts from the shared behavior checks and deterministic availability path, preserving the latter. Replace only the mapped legacy offer content for the challenge route rather than assuming an appended contradiction is sufficient. Add synthetic full-pipeline regressions for direct and reciprocal questions, known goals, burst messages, refusals and later autonomy state, returning legacy buyers, course questions, clients, media/context failure and card delivery/retry.

Then run same-input baseline/candidate model comparisons with realistic timestamped history, review all final drafts, repeat the established deterministic tests and rebase on the current production branch. No model change, weaker hold, live lead test or timing change is authorized as a shortcut. Only ship after these acceptance conditions are met.

## Measurement plan once a safe rollout is eligible

Hypothesis: a relevant short challenge explanation followed by the existing consultation card increases completed consultation bookings without increasing repetitive questions, sales pressure, support failures or abandonment. This is unproven; synthetic output is not business evidence.

Use the policy version and booking source to compare complete, lane-matched episodes. Primary outcome: completed consultation booking per eligible lead, then attended consultation and downstream paid conversion where canonical records exist. Also track duplicate cards, opt-outs/complaints, repeated questions, inappropriate offers, human-review holds and unanswered direct questions. A reply, friendly tone, long conversation, model stage or card send is not a conversion.

Before activation, verify that query-source attribution survives the real booking flow and connects to canonical outcomes; this audit did not establish that linkage end to end. Keep ad spend and campaign launch on hold. Review initial episodes before expansion and use the existing tested production behavior as rollback, without force-pushing or deleting conversation history.
