# Decisions in the existing conversation review

This is an advisory quality check for the existing sole dispatcher's organic
business replies, and the existing daily learner. It never sends, claims, releases
a hold, changes A/B/C, or retrains model weights. Current policy and verified
facts remain authoritative. The ordinary deep review remains responsible.

`scripts/review-dm-decisions.mjs` calls the official Decisions endpoint with
`gpt-6-luna` and seven predicates: complete answer, grounding, repetition, useful
next step, natural training transition, A/B/C compliance and offer truth. It accepts only full reviewed history
or a validated summary plus complete delta. It never silently truncates context.
Only whitelisted evidence is transmitted; keep inputs and reports private.

## Existing dispatcher's pre-claim step

The installed `balance-dm-fast-reply.mjs claim` command invokes this review
automatically for organic business candidates. Pass the complete context SELECT
result as `decisionsContext` alongside existing claim fields. The helper supplies
current continuity policy and learned rules, hashes that exact policy revision,
and saves the compact review privately. A flagged candidate stops SQL generation
before any claim or send. Improve it once, or provide `decisionsResolution` with
`mode:deep_review_override`, a grounded `reason`, and every `checkedIssues` name
when the existing deep reviewer verifies that the flag is incorrect.

The standalone command below is also used by the daily learner and for offline
evaluation. It does not replace the automatic claim integration.

1. Read the existing full context and current policy. Complete ordinary review.
2. Write a private input JSON: `threadId`, `sourceMessageId`,
   `lane:organic_business`, `candidateText`, `fullThreadReviewed:true`,
   `historyProof`, optional `historySummary`, complete `messages` with exact IDs,
   `currentPolicy`, `conversationReview`, `challengeTimingExperiment`, optional
   `verifiedOfferEvidence`, and the current `learningRevision`.
3. Run `node <installed-helper> <private-input.json> <private-review.json>`,
   optionally with `--env-file <user-confirmed-private-secret-file>`.
4. Read the saved report. On `revise`, inspect the failed criteria against the
   actual conversation and make at most one useful rewrite; review the changed
   candidate afresh. On `uncertain` or `unavailable`, use the existing deep review
   and record that fallback. API outages must not strand an understood reply.
5. Recheck the newest inbound and all normal source, hold, ownership and
   delivery gates. Bind the review to the exact candidate/context with
   `validateReviewBinding`. Any changed source, context or text needs a fresh
   review. Persist the compact review/version and actual final disposition in
   the existing action reason/receipt, including any explicit deep-review
   override. Never treat `passed` as sending authority.

The 3.5-second API deadline has no retry loop. Missing credentials, refusal,
malformed data and provider errors preserve ordinary review and no-repeat.
The 0.15/0.85 thresholds are provisional triage, not calibrated response odds.

## Automatic daily learning

The existing daily reviewer reads exact delivery attribution, complete episodes,
subsequent replies and verified challenge outcomes. It may use the same helper
for retrospective quality checks, labelling those as retrospective and never
resending suggestions. Keep review ID, hashes, version, flags, actual writer
decision, final canonical outbound ID, ABC arm and subsequent outcomes together.

Use reply outcomes after 48 hours and downstream outcomes after seven days,
retaining pending/unknown and assigned-but-uninvited cases. Compare within lane,
ABC assignment and policy revision. Inspect declines and appropriate closures.
Model scores are hypotheses, not outcome labels. Promote scoped corrections
only from repeated evidence or a reproducible defect, test contrasting offline
cases, retain rollback, and revert demonstrated regressions autonomously under
the current daily-learning contract. No routine Shannon grading is required.

## Natural conversation transitions, approved 29 October

Keep chatting about the actual topic. When it naturally winds down in the
assigned A/B/C conversation, a simple gym question is appropriate. Do not require
a stated goal, blocker or help request before that opening. A stated goal does
not create a compulsory blocker interview.

If the person asks about Shannon's day, a verified actual workout can supply a
natural bridge: share it casually, then ask one relevant training question.
"Chest and bis" is a wording example, not evidence of today's training. Use only
actual known activities; avoid repeated personal-fact questions for immaterial
details. A general day question does not itself override B/C timing. A direct
inbound fitness question retains the existing documented override path.

Record `conversationReview.transition` with `kind` (`none`, `topic_wind_down_gym`,
`day_question_training_bridge`, `person_led_fitness`), exact `sourceMessageIds`,
and `selfDisclosureVerified` when applicable. The review records that label,
actual ABC arm/timing, policy hash and criteria revision. Unlabelled transitions
stay unlabelled. Daily learning checks whether the person answered the training
question, continued their previous topic, declined or went quiet, then follows
actual challenge interest and onboarding. Use mature comparable cohorts; an AI
score is not a successful transition, and silence is not proof the pivot failed.

## Activation and verification

`scripts/install-dm-decisions-review.mjs` installs the helper and patches only the
existing context field, review metadata and pre-claim invocation. It preserves an
original backup and refuses an unrecognised helper shape. Re-running is safe.
Activation requires a successful live synthetic check. Completion receipts copy
the exact source/thread-bound review automatically, so existing receipt archival
preserves the link for later learning even after the action row is reused.

Offline tests verify request construction, source/context binding, error fallback
and probability parsing. They do not verify live model quality. Activate the
existing operator's invocation only after secure credentials and a live synthetic
smoke check succeed. Record provider/model access and measured latency honestly.
If authentication is unavailable, retain the installed integration as pending;
do not claim Decisions is running. Never test by sending messages to real leads.

Official API contract: https://developers.openai.com/api/docs/guides/decisions
