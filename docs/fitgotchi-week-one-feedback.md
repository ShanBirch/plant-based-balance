# Week 1 FitGotchi feedback action

## Product contract

After paid onboarding, Week 1 includes View Your FitGotchi in To do next and the Balance Learn action checklist. The shared gold/cream guide takes the member to Settings, requires Show FitGotchi to be enabled, returns Home, and explains XP, gamification and optional visibility. Finish persists the action in the member's existing social_journey_progress.settings.fitgotchi_intro record. Opening, skipping, or a failed save does not earn credit. Hiding the character later does not revoke credit. Members already past Week 1 are not retrospectively locked by the new action.

This is deliberately outside the required onboarding/payment tour. It awards no onboarding XP and cannot advance the checkout gate.

## Measurement

- Hypothesis: explaining the character as optional visual feedback will help Week 1 members understand XP and use it as motivation.
- Variant: fitgotchi_feedback_v1.
- Events: fitgotchi_course_started, fitgotchi_course_completed, fitgotchi_course_closed (completed flag).
- Primary metric: unique Week 1 members with persisted completion / unique members starting the walkthrough.
- Guardrails: no pre-payment appearance, no course credit from simply opening, no additional onboarding XP, no loss of credit after hiding, and no new lock for members beyond Week 1.
- Review date: 18 September 2026. Keep if completion is reliable and support reports show no blocked navigation; revise copy/placement if starts repeatedly end without completion.

## Verification

Automated coverage: eligibility, incomplete/complete checklist, visibility gate, listener cleanup, no credit on open, persistence failure rollback/retry, missing connection, account-switch guard, idempotent completion, hiding after completion, previous-week exemption, discovery separation, script parsing and asset versions. Reuse the shared tour navigation and gold-theme regression suites. Live mobile click-through recorded in the task after deployment.
