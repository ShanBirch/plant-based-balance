# Coach-assigned family meal Learn profile

The `family_lower_carb_v1` learning profile is assigned in an individual account's `user_metadata.balance_learning_profile`. It is separate from the `coach_guided` tour preference. No public enrolment, email or profile completion is created by this change.

Assigned members see Balance Learn followed immediately by a planned four-week Balance Menopause component. The five week-six food lessons retain their IDs, but receive actual rewritten introductions, key points and eight matching quiz questions each: energy balance without counting, familiar protein foods, flexible carbohydrate choices, fats and satisfying meals, and one shared family meal. All 45 Learn lessons were audited for unwanted dietary framing. Other accounts keep the existing lesson definitions and course path; switching accounts does not mutate the shared content.

The food examples use a shared protein-and-vegetable base with individual sides. No calorie target, ketogenic allowance, allergy clearance or weight-loss guarantee is assigned. Educational background: [Australian food groups](https://www.eatforhealth.gov.au/food-essentials/five-food-groups). The weekly practical-action machinery and stored completions remain intact; lesson reads do not fabricate action completion.

The menopause outline has four planned weeks: transition; food, muscle and bone; symptoms, evidence and options; ongoing routine. It contains topic headings only, no clinical lessons, no private payload and no completion controls. The original owner-only nine-week review, its server identity verification and RLS remain unchanged. Releasing a diet-inclusive four-week lesson package requires clinical review, full content adaptation and an explicit scoped entitlement implementation. Displaying the outline does not grant that access.

The assigned course screen owns its viewport and internal scroll with a 42px minimum top fallback, nonzero inset support and reachable bottom content. Existing lesson-reader layout retains its own safe-area styling. The scoped stylesheet and both dashboard script loaders have fresh versions.

Validation: profile isolation and real lesson/quiz content tests; owner-only menopause access and signout tests; existing Learn progression, theme and tour tests. Mobile review covers 360×640 and 640×360, light/dark, 0/59px top insets, opening, internal scrolling, returning/reopening and bottom clearance. A real account with incomplete essential profile setup must finish that setup with the coach; UI-isolation screenshots are not evidence that the profile questionnaire was completed.

## Phased sessions and family dinner guides

An inline coach workout may carry `availableFrom` and `availableUntil` as Brisbane date keys. Calendar rendering, today's launch, the Home recommendation and direct inline launch respect the date window. Workouts without these fields retain their existing behaviour. This permits an added Saturday session to start in week three while keeping the first two weeks free of that added session. A coaching call is not inserted as a strength workout or counted toward training totals.

The `family_lower_carb` meal-plan type is a shared dinner guide with flexible sides, not a complete daily nutrient prescription. Nullable nutrition values stay unknown rather than being guessed. Its meal cards and daily summary omit calorie/macro claims and the calorie-log button; ordinary measured meal plans keep those controls. The plan description must explicitly state its dinner-only scope. No full-day adequacy claim is made.
