# Weekly check-in training days

Variant: weekly_checkin_training_days_v1. Decision date: 30 November 2026.

Hypothesis: letting members choose next week's workout days improves planned session completion and reduces manual rescheduling.

Primary KPI: completed planned sessions / planned sessions in the week following a check-in, compared with the member's previous weeks.

Diagnostics: weekly_checkin_submitted now includes training_days_selected (count) and training_schedule_week (Monday date). Compare check-in completion and schedule-change support requests. The authenticated endpoint saves the dated selection to the weekly check-in and its coach receipt before applying it to user_facts.additional_data.weekly_workout_day_orders.

Guardrails: preserve session count, source order, exercise prescriptions, fixed activity/dated appointments, completed workout logs, baseline recurring schedule and all weeks outside the selected coming week. Reject stale signatures and unavailable plans. Existing clients without the new field can still submit check-ins. Unsupported/unsaved calendars show an explanation and continue without rescheduling.

Verification: server-side selection and endpoint tests cover authentication, owner scoping, 35 possible three-day selections, fixed appointments, retries, stale requests, readback failures and failed saves. Mobile visual checks cover 320x568, 390x844 and 844x390, light/dark, zero and 59px top insets, scrolling and reopening. No live member schedule was changed during testing.
