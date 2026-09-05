# Balance Master

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
