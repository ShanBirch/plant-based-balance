# Balance Master

Current structure: ten weekly releases. See BALANCE_FOUR_PART_COURSES.md for the current curriculum, selected specialist lessons and migration. The notes below record the original six-stage release.

Published implementation: six self-paced stages, 18 short teaching sections, 12 knowledge-check questions, four written applications and two saved projects. Entry is through Course > Balance Master after Balance Learn completion. Before completion of Learn, members can preview the six outcomes.

## Existing content audit

The current dashboard uses `lib/learning-inline.js`. Its titles, lesson IDs and content differ from the older modular `learning-lessons.js`, which still has empty units. Use the dashboard runtime as the source of truth.

| Master stage | Existing material reused as the foundation and deeper learning |
| --- | --- |
| Know the muscles | How Your Body Moves: muscle actions, opposing pairs, posterior chain |
| Compound lifts | How Your Body Moves: bracing, hip hinge, movement quality; Train With Purpose: strength foundation |
| Build a program | Train With Purpose: progressive overload, specificity, recovery, exercise selection and hypertrophy programming |
| Build a meal | Fuel for Results: macros, protein, carbohydrates, fats and food-first nutrition |
| Plan seven days | Fuel for Results: finding balance, meal frequency and sustainable nutrition |
| Review and adjust | How Your Body Moves: minimum effective dose and consistency; Fuel for Results: sustainable nutrition |

The specialist anatomy/hypertrophy library also covers individual muscle groups, but its more detailed material is not a compulsory gate. Master provides a beginner-facing synthesis rather than copying every advanced claim into the core course.

The app already has Build a Workout, video-backed exercise selection and saved custom workouts. Its meal builder builds individual meals; it was not a learner-authored weekly planning worksheet. Master adds that worksheet.

## Projects and completion

- Workout: goal, available time/equipment/recovery, seven-day schedule linked to existing saved workouts, working sets/reps/rest/effort for every exercise, coverage rationale and progression rule. Saved workout names and exercise lists are read from the member's own workout templates. Prescriptions retain exercise names so a changed template cannot silently validate an old prescription.
- Meals: seven days of breakfast/lunch/dinner and optional snacks, ingredient/portion prompts, preferences and dietary needs, shopping quantities, prep and a backup meal. A previous-day copy action supports repetition. This form intentionally does not claim to calculate nutrition from free text.
- These are private course projects and do not activate or overwrite a coached program or existing meal plan. Saved workout templates remain usable through Movement.
- Completion requires correct knowledge-check answers, a finished application/project, successful account save, and the explicit completion action. Saving a draft does not newly complete a stage. Editing a completed project so it is incomplete removes that stage from calculated completion.
- New stages remain accessible for review at any pace. Completion is a self-directed learning milestone, not a professional qualification or a coach's assessment.
- Existing deeper-lesson links preserve the established quiz/XP behaviour; the new course worksheet does not mint XP or issue a certificate.

## Evidence and wording

The core course avoids implying compound lifts must be barbell lifts, that every person should train maximally, or that a meal name has a known nutrition value. It links to the existing lessons and these primary references:

- [ACSM 2026 resistance training guidance](https://acsm.org/resistance-training-guidelines-update-2026/)
- [Eat for Health meal planning](https://www.eatforhealth.gov.au/eating-well/tips-eating-well/meal-planning)
- [Eat for Health food groups](https://www.eatforhealth.gov.au/food-essentials/five-food-groups)

## Data and measurement

`balance_master_projects` has one private JSON document per authenticated user, owner-only select/insert/update policies, no anonymous access, no client delete privilege and a payload-size bound. No personal project text is sent in analytics events.

Hypothesis: guided applications of existing lessons help members produce usable independent plans.
Variant: `balance_master_v1`.
Primary KPI: proportion of Master starters completing both planning projects within 14 days.
Diagnostics: `master_opened`, `master_stage_opened`, `master_existing_lesson_opened`, `master_workout_builder_opened`, `master_project_saved`, `master_stage_completed`, `master_course_completed` through the existing course-event transport.
Guardrails: failed saves, completion without required fields, cross-account visibility and accidental changes to coached plans.
Decision date: 2026-09-20. No baseline or conversion uplift is claimed at launch.

## Verification

- Targeted Node tests cover valid and invalid seven-day plans, workout ownership/linkage, per-exercise prescriptions, changed exercise lists, explicit completion and account-switch/loading behaviour.
- Existing course-card, course-action, quiz retry and guided-tour checks pass.
- Live database transaction verified owner insert/update/readback, denied cross-user insert/reassignment, zero cross-user select/update and no anonymous select; all test writes rolled back.
- A 360px local browser fixture verified light/dark layouts, draft reopening, incomplete-project blocking, workout linking/prescriptions, meal-day copying and all-six-stage completion. The fixture uses a test persistence adapter, separately from the live database-policy checks.


## Compound-lift video assignment (2026-09-06)

Stage 2 now requires one submitted clip for each of squat, hinge, push and pull, alongside its existing knowledge check and reflection. Members choose suitable variations and use the existing Form Check capture/upload flow. The course supplies a movement label in the workout context; members enter the actual exercise and notes. Shannon receives the existing Needs You review card, with the video and editable draft. Feedback remains in the coach conversation.

The authenticated master-form-check-status endpoint derives the member ID from their access token and returns only submission IDs and dates for that member. It checks successful coach-alert receipts and the existing direct-message fallback. It never returns coach drafts or video URLs. Opening capture, cancelling, queued uploads and failed sends cannot satisfy the requirement. A failed status check leaves the course accessible, blocks that stage's completion and offers a retry. Existing completed courses must satisfy the new video requirement. Submission is explicitly distinct from coach approval; there is no automatic technique approval or promised review turnaround.

Variant: master_compound_video_v1. Hypothesis: four practical video submissions improve application of the compound-lift lessons. Primary KPI: percentage of stage-2 starters with all four submissions within 14 days. Diagnostics: master_form_check_opened by movement, existing form_check_submit_success/failure and master_stage_completed (stage 2). Guardrails: upload failure rate and pending form-check review age. Decision date: 2026-09-20. Existing events and review queue provide the measurement sources; course text and videos are excluded from analytics.

Validation: completion-gate tests cover missing and partial submissions, successful receipts, failed status checks and account changes. Endpoint tests cover authenticated identity scoping, privacy of returned fields and auth/database failures. Phone-sized fixture checks cover missing-video blocking and the existing Form Check handoff. No real member video or coach message was created during verification.
