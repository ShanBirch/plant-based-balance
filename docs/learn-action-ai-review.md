# Weekly action evidence review

The member's submitted weekly check-in, current-enrollment reflection and action criteria are reviewed automatically. The former “How your course tick appears” block is removed; incomplete actions have no replacement instruction block at the bottom.

## Completion contract

- Run only after the saved check-in's coaching receipt has been read back successfully.
- Model must identify the action as discussed, meet its specific criteria, and provide grounded quotes for every required field with at least one substantive check-in quote. Reflection alone, intentions for actions that require an attempt, unrelated updates, copied instructions, ungrounded quotes and low-confidence results do not earn a tick.
- Observation is sufficient in week 1; observation plus a proposed change in week 2. Improvement is never required. Week 6 retains the owned saved-meal and personal-target checks.
- Use the existing production model route. Only synthetic data is used in developer fixtures.
- AI decisions have their own JSON evidence, receipt, source revision and `ai_evidence_review` audit event. They never impersonate a coach.
- The service-only SQL function checks current enrollment, delivered receipt ownership, action/week/revision and the original check-in snapshot. No member endpoint accepts an AI decision.
- Completed/legacy credit is immutable and duplicate calls cannot award twice. A model failure leaves evidence intact; reopening the action retries unchanged pending evidence. Ordinary coach check-in replies are unchanged.

## Verification — 13 September 2026

- Browser: saved a reflection without credit, submitted a specific attempt to show Completed, closed/reopened to retain it, submitted a plan-only report to show More information needed. Used real member UI and validator with simulated AI responses in an isolated fixture, not account writes.
- Browser screenshots: cream/gold and charcoal/gold, 320×568 portrait and 667×375 landscape, scrolling to the bottom action, zero-inset fallback and simulated 59px notch. Header controls remained below the status bar; no horizontal overflow. Existing theme CSS was preserved.
- Database: transaction/rollback test for receipt binding, stale revision rejection, explicit AI provenance, idempotency and denied anon/member execution. Applied migration and checked security advisors; no action-review findings.
- A local live-model probe could not use production secrets because Netlify CLI returns masked values. Its authentication failures are not evidence of a broken production key. No real member check-in or model response was fabricated to claim full production end-to-end verification.
- Regression suite covers all six action weeks, unrelated/plan-only/injected evidence, grounded quotes, short neutral outcomes, unavailable model, account/enrollment/revision isolation, existing course progress, weekly check-ins and the prior weigh-in fix.
