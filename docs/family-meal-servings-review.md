# Family Meal Servings Review

Status: local review only. Do not deploy or change client meal-plan rows until
Shannon has reviewed the prepared result.

8 October review direction: every scheduled meal needs a working meal photo.
Jennie's plan uses three base days repeated Thursday–Saturday; Sunday combines
the base meals. Keep favourites across weeks and introduce one or two genuinely
new meals each week. Shannon confirmed exactly two on 8 October. Week 2 adds
herb chicken and spinach omelette; week 3 adds chicken tray bake and kiwi yoghurt;
week 4 adds boiled eggs/cucumber and beef rice bowl; week 5 adds egg/potato lunch
and orange/pumpkin seeds; week 6 adds chicken quinoa and kiwi/seed snack cup.
Label both new meals in each week's view; verify that they are new to the plan,
not merely returning from an earlier week.
The recipe serving panel offers measured quantities or approximate hand and
household measures, with cooked protein/rice labels for visual portions. Keep
shopping quantities and cooking instructions measured. Hand size and cooking
vary, so do not imply exact equivalence or apply these adult portions to children.

Shared recipes use measured ingredient JSON with `personal_quantity`,
`other_quantity`, `unit` and the ordinary `amount` field. The family batch is the
personal portion plus `other_quantity * (batch portions - 1)`. Personal quantities
never change when batch size changes. This supports different carbohydrate sides
without counting the personal portion twice. Existing recipes are unchanged.

The recipe panel compares both columns. Shopping can use personal or family
quantities and omit meals tagged `Optional snack`. Checklist state is separated
by week, shopping mode, batch size and snack selection.

The private ten-week draft, source evidence, review builder and visual proof live
in ignored `output/jennie-meal-review/`. The preview uses the real app recipe and
shopping renderers; it makes no production requests or database writes.
Review locally at http://127.0.0.1:8891/output/jennie-meal-review/index.html.

Before assignment, retain all existing unrelated plan rows. Map the draft to the
existing plan/week/meal columns explicitly; `review` and `portion_note` are local
review fields, not database columns. Keep meal nutrition null and the established
`family_lower_carb` renderer while calorie needs are unconfirmed. The measured
ingredient JSON survives the existing plan loader without a schema migration.

Hypothesis: explicit personal and shared quantities make family meal preparation
easier and reduce serving questions. Variant: `family_servings_v1`. Initial
success measure: the reviewed client can identify her portion and create a batch
shopping list without separate cooking. Guardrails: no excluded foods, no
unsupported calorie targets, no personal data committed, no changes to ordinary
meal quantities, and mobile safe-area/theme checks. Review at the first weekly
check-in after any approved release.

Verification: focused unit/regression tests; ten-week navigation; opening,
scrolling, recipe reopening, batch changes, shopping selection and optional snack
selection across small portrait, landscape and desktop layouts in light/dark
themes, with zero and nonzero top insets. Private proof is stored with the draft.

8 October: extend Jennie's reviewed journey to ten weeks. Weeks 7–10 each add
two new recipes while keeping the within-week three-day repeat and Sunday mix.
The full 70-day list is saved beside the draft in ten-week-meal-list.md.
