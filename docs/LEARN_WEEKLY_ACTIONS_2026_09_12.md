> The self-confirmation behavior below is superseded by [coach-reviewed action records](LEARN_ACTION_COACH_REVIEW.md). Retained as implementation history.

# Balance Learn weekly actions

Approved direction implemented 12 September 2026. Each week has five actions. Meal counts mean individual logged meals across the whole course week, never days or calorie prescriptions. Movement follows the member's program; a completed history workout or positive-duration logged movement counts, at most once per day, so exercise sets and duplicate imports cannot inflate the count.

| Week | Meals | Movement | Course experiment | Community | Report |
| --- | --- | --- | --- | --- | --- |
| 1 | 3 | 1 | Notice a repeating pattern and its immediate cue | Introduce yourself in Feed | Weekly check-in |
| 2 | 5 | 2 | Notice sleep, hunger or stress affecting a choice; try one adjustment | Comment on another member's post | Weekly check-in |
| 3 | 5 | 2 | Attach a small action to an existing routine and try it three times | Share a completed workout | Weekly check-in |
| 4 | 7 | 2 | Notice craving circumstances; change one part of the routine | Share a logged meal | Weekly check-in |
| 5 | 7 | 3 | Set up one thing that makes a meal or workout easier | Achieve and share an exercise PB | Weekly check-in |
| 6 | 7 | 3 | Choose realistic food and movement routines to continue | Share course reflections | Weekly check-in |

Getting started retains the same saved IDs for the FitGotchi introduction, front/side/back photos, and verified watch connection or honest no-watch option. It appears separately under Your Week and does not crowd the five recurring actions. Existing onboarding remains in place.

## Reporting and completion

The existing Friday–Sunday weekly form owns reporting. Its existing `course_learning` answer now has the current experiment prompt and an explicit tried-it checkbox. The experiment tick requires a saved nonempty answer, the checkbox, the correct course week and a weekly submission timestamp inside that course week. A weekly check-in can still be sent without completing the experiment. Opening an action never grants meal, workout or reporting credit.

Course weeks can start on any day, whereas weekly check-ins use Monday keys. Progress reads the Monday row preceding a course start and matches actual submission time. The server verifies the current course week and rejects a stale form. Review edits restore existing answers and preserve diary and Wednesday data. Save/readback must succeed; the coach receipt is updated while pending, or a changed answer after review creates a revision receipt. Both the answer and the coach receipt are read back before success.

No new table, form or database migration is required. The JSON reporting fields use the existing daily_checkins/coach_alerts path. One-time `settings.learn_actions_v2` records earlier completed weeks and the effective week at rollout. Earlier credit is explicitly labelled; new actions are not retroactively required in elapsed weeks. Setup saves separately as `learn_setup_progress`.

The course refreshes saved progress on Learn entry and after reporting. Its action rows show full instructions and counts, and completed rows tick in Your Week and the full course overview.

## Existing daily features verified

- Mood check-in: three daily windows, stored in `mood_logs`; 1,002 live records, latest 12 September. This is not a written experiment report.
- Fitness Diary: the Home end-of-day action opens it after 6 pm; saved in `daily_checkins.additional_data.fitness_diary`. There were 99 live diary rows, latest 9 September. It remains independent of Learn reporting.
- Separate New Reflection/journal: reachable from the reflection area but saves in localStorage only. It is not a dependable coach reporting route.
- Weekly form: seven existing live weekly records, latest 11 September UTC. Its response reaches the existing Needs You flow.
- Lesson reflections: writes verify their saved answer. The coach client view calls `loadMasterAssessments`, which displays Saved lesson reflections. A live authenticated test-account write after a completed quiz and Shannon-role read returned one matching record; the transaction was rolled back. The policy correctly rejected an arbitrary lesson without a completed quiz first.

## Verification

- 57 focused Node tests pass across weekly actions, complete save handler, reporting, Feed/PB evidence, setup, photos and availability.
- Headless Chrome component checks use the real app CSS and rendering functions: 320×568, 390×844 and 740×360; light/dark; simulated 0/59 px top inset and 0/34 px bottom inset; opening, scrolling, returning and reopening. All 12 combinations pass. Screenshots and receipts are in ignored `output/learn-weekly/`.
- Screenshots caught truncated instructions; rows now wrap full instructions and show progress on its own line. Mobile Your Week owns its scroll; review and setup overlays use status-bar fallback clearance.
- Browser checks are controlled component fixtures, not a physical native-device test. Full endpoint tests use an isolated database transport; live database checks verify existing schema, records and permissions without leaving test data.

## Measurement

Hypothesis: five small recurring actions and one specific course experiment make Learn follow-through easier to understand and review. Variant: `learn_weekly_actions_v2`. Primary measure: weekly action completion by course week from saved snapshots. Diagnostics: meals/movement progress and `weekly_checkin_submitted` events with course week and experiment completion. Guardrails: no click-only completion, no retroactive relocking, no duplicate written report. Review after two course weeks of actual member use; do not treat pre-rollout exemptions as newly completed behavior.
